import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { hasPermission } from "@/lib/rbac/definitions";
import type { ClassAttendanceStatus } from "@/types/database";

/**
 * การเข้าเรียนรายวิชาของนักเรียนคนหนึ่ง พร้อมงานที่ค้างจากวันที่ขาด
 *
 * ตอบสองคำถามที่นักเรียนถามจริง:
 *   1. ฉันขาดวิชาไหนไปกี่คาบแล้ว ใกล้ติด มส. หรือยัง
 *   2. วันที่ฉันขาด ครูสั่งงานอะไรไว้บ้าง
 *
 * ข้อสองเป็นเหตุผลที่ class_assignments ผูกกับคาบไม่ใช่ผูกกับวิชา — พอรู้ว่า
 * ขาดคาบไหนวันไหน ก็ดึงงานของคาบนั้นวันนั้นได้ตรง ๆ โดยไม่ต้องเดา
 *
 * นักเรียนดูได้เฉพาะของตัวเอง ยกเว้นคนที่มีสิทธิ์ attendance.view_all
 * ซึ่งส่ง student_id มาดูของคนอื่นได้ (ครูที่ปรึกษา ฝ่ายวิชาการ)
 */

/** เกณฑ์เตือนว่าเริ่มเสี่ยง ใช้ค่าเดียวกับที่โรงเรียนมักใช้พิจารณา มส. */
const ABSENCE_WARN_THRESHOLD = 3;

type Row = {
  attend_date: string;
  status: ClassAttendanceStatus;
  note: string | null;
  class_schedules: {
    id: string; subject: string | null; teacher: string | null;
    room_name: string; start_time: string; end_time: string;
  } | null;
};

/**
 * รูปร่างของงานที่ query คืน — ต้องประกาศเองเพราะ database.ts ใส่
 * Relationships: [] ไว้กับตารางใหม่ ตัว typed client จึงแปลง join ไม่ได้
 */
type AssignmentRow = {
  id: string; class_schedule_id: string; assigned_date: string;
  title: string; description: string | null; due_date: string | null;
  attachment_url: string | null;
  class_schedules: { subject: string | null; teacher: string | null } | null;
};

export const GET = withAuth(
  async (req, { principal }) => {
    const url = new URL(req.url);
    const requested = url.searchParams.get("student_id")?.trim();

    // ดูของคนอื่นได้เฉพาะคนที่มีสิทธิ์ ไม่งั้นบังคับเป็นของตัวเองเสมอ
    // ไม่ใช้ค่าจาก query โดยไม่ตรวจ ไม่งั้นนักเรียนเปลี่ยนรหัสใน URL แล้วดูของเพื่อนได้
    const canSeeOthers = hasPermission(principal.permissions, "attendance.view_all");
    const studentId = canSeeOthers && requested ? requested : principal.subjectId;

    if (!canSeeOthers && principal.subjectType !== "student") {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ไม่มีข้อมูลการเข้าเรียน" },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("class_attendance")
      .select("attend_date, status, note, class_schedules(id, subject, teacher, room_name, start_time, end_time)")
      .eq("student_id", studentId)
      .order("attend_date", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as Row[];

    // สรุปรายวิชา — นักเรียนสนใจว่า "วิชานี้ขาดไปกี่คาบ" ไม่ใช่ยอดรวมทั้งหมด
    // เพราะเกณฑ์ มส. คิดแยกรายวิชา
    const bySubject = new Map<string, {
      subject: string; teacher: string | null;
      present: number; late: number; absent: number; leave: number; activity: number;
      total: number;
    }>();

    for (const r of rows) {
      const key = r.class_schedules?.subject ?? "ไม่ระบุวิชา";
      const cur = bySubject.get(key) ?? {
        subject: key, teacher: r.class_schedules?.teacher ?? null,
        present: 0, late: 0, absent: 0, leave: 0, activity: 0, total: 0,
      };
      cur[r.status] += 1;
      cur.total += 1;
      bySubject.set(key, cur);
    }

    const subjects = [...bySubject.values()]
      .map((s) => ({
        ...s,
        // เปอร์เซ็นต์เข้าเรียนนับ ลา และ ไปกิจกรรม เป็นการเข้าเรียน
        // เพราะทั้งสองอย่างได้รับอนุญาต ไม่ควรทำให้ตัวเลขดูแย่เกินจริง
        attend_rate: s.total ? Math.round(((s.present + s.late + s.leave + s.activity) / s.total) * 100) : 100,
        at_risk: s.absent >= ABSENCE_WARN_THRESHOLD,
      }))
      .sort((a, b) => b.absent - a.absent);

    // วันที่ขาดหรือสาย — ใช้ไปหางานที่ค้างต่อ
    const missed = rows.filter((r) => r.status === "absent" || r.status === "late");

    let assignments: AssignmentRow[] = [];
    if (missed.length) {
      // ดึงงานเฉพาะคาบและวันที่ตรงกับที่ขาดจริง ไม่ใช่งานทั้งหมดของวิชา
      // ไม่งั้นนักเรียนจะเห็นงานที่ตัวเองอยู่ในคาบและรับโจทย์ไปแล้ว
      const scheduleIds = [...new Set(missed.map((m) => m.class_schedules?.id).filter(Boolean))] as string[];
      const dates = [...new Set(missed.map((m) => m.attend_date))];

      if (scheduleIds.length && dates.length) {
        const { data: aData } = await supabase
          .from("class_assignments")
          .select("id, class_schedule_id, assigned_date, title, description, due_date, attachment_url, class_schedules(subject, teacher)")
          .in("class_schedule_id", scheduleIds)
          .in("assigned_date", dates)
          .order("due_date", { ascending: true });

        // ต้องกรองอีกชั้นเพราะ .in() สองตัวให้ผลคูณกัน — งานของคาบ A วันที่ 2
        // จะติดมาด้วยแม้ว่านักเรียนขาดคาบ A วันที่ 1 และขาดคาบ B วันที่ 2
        const missedPairs = new Set(missed.map((m) => `${m.class_schedules?.id}|${m.attend_date}`));
        assignments = ((aData ?? []) as unknown as AssignmentRow[]).filter((a) =>
          missedPairs.has(`${a.class_schedule_id}|${a.assigned_date}`)
        );
      }
    }

    const totals = {
      present: rows.filter((r) => r.status === "present").length,
      late: rows.filter((r) => r.status === "late").length,
      absent: rows.filter((r) => r.status === "absent").length,
      leave: rows.filter((r) => r.status === "leave").length,
      activity: rows.filter((r) => r.status === "activity").length,
    };

    return NextResponse.json({
      status: "success",
      data: {
        student_id: studentId,
        totals,
        subjects,
        // งานที่ค้างจากวันที่ขาด — คำตอบของ "ไม่รู้ว่าครูสั่งอะไร"
        missed_assignments: assignments,
        recent: rows.slice(0, 30),
        at_risk_subjects: subjects.filter((s) => s.at_risk).map((s) => s.subject),
        warn_threshold: ABSENCE_WARN_THRESHOLD,
      },
    });
  },
  { permission: "attendance.view_own" }
);
