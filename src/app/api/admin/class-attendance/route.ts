import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import type { ClassAttendanceStatus } from "@/types/database";

/**
 * เช็กชื่อรายคาบ
 *
 * รายชื่อนักเรียนในคาบไม่ได้มาจากตารางลงทะเบียนแยก แต่มาจาก
 * students.class_group_id ที่ตรงกับ class_schedules.class_group_id
 * ทำให้ไม่มีสองที่ที่ต้องคอยซิงก์กัน — ย้ายนักเรียนเข้าห้องแล้วรายชื่อในทุกคาบ
 * ของห้องนั้นเปลี่ยนตามทันที
 *
 * ผลที่ตามมาคือ ถ้ายังไม่ได้จัดนักเรียนเข้าห้อง คาบจะไม่มีใครให้เช็ก
 * GET จึงส่ง needs_roster กลับไปเพื่อให้หน้าจอบอกทางแก้ได้ ไม่ใช่ขึ้นว่างเปล่า
 */

const StatusEnum = z.enum(["present", "late", "absent", "leave", "activity"]);

const SaveSchema = z.object({
  class_schedule_id: z.string().uuid(),
  attend_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD"),
  entries: z
    .array(z.object({
      student_id: z.string().trim().min(1),
      status: StatusEnum,
      note: z.string().trim().nullable().optional(),
    }))
    .min(1, "ต้องมีรายชื่ออย่างน้อยหนึ่งคน")
    .max(200),
});

/** รายชื่อของคาบหนึ่งในวันหนึ่ง พร้อมผลที่เคยเช็กไว้ */
export const GET = withAuth(
  async (req) => {
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("class_schedule_id")?.trim();
    const date = url.searchParams.get("attend_date")?.trim()
      || new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

    if (!scheduleId) {
      return NextResponse.json(
        { status: "error", message: "ต้องระบุ class_schedule_id" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data: schedule, error: scheduleError } = await supabase
      .from("class_schedules")
      .select("id, class_group_id, subject, teacher, room_name, day_of_week, start_time, end_time")
      .eq("id", scheduleId)
      .maybeSingle();

    if (scheduleError) {
      return NextResponse.json({ status: "error", message: scheduleError.message }, { status: 500 });
    }
    if (!schedule) {
      return NextResponse.json({ status: "error", message: "ไม่พบคาบเรียนนี้" }, { status: 404 });
    }

    const [rosterRes, markedRes, groupRes] = await Promise.all([
      supabase
        .from("students")
        .select("student_id, first_name, last_name, nickname, photo_url")
        .eq("class_group_id", schedule.class_group_id)
        .eq("student_status", "studying")
        .order("student_id"),
      supabase
        .from("class_attendance")
        .select("student_id, status, note")
        .eq("class_schedule_id", scheduleId)
        .eq("attend_date", date),
      supabase
        .from("class_groups")
        .select("id, name, program, department")
        .eq("id", schedule.class_group_id)
        .maybeSingle(),
    ]);

    if (rosterRes.error) {
      return NextResponse.json({ status: "error", message: rosterRes.error.message }, { status: 500 });
    }

    const roster = rosterRes.data ?? [];
    const marked = new Map(
      (markedRes.data ?? []).map((m) => [m.student_id, { status: m.status, note: m.note }])
    );

    return NextResponse.json({
      status: "success",
      data: {
        schedule,
        class_group: groupRes.data ?? null,
        attend_date: date,
        // ค่าตั้งต้นเป็น present เพราะโดยปกตินักเรียนส่วนใหญ่มาเรียน
        // ครูจึงกดเฉพาะคนที่ไม่มา ซึ่งเร็วกว่าการกดทีละคนทั้งห้อง
        students: roster.map((s) => ({
          ...s,
          status: (marked.get(s.student_id)?.status ?? "present") as ClassAttendanceStatus,
          note: marked.get(s.student_id)?.note ?? null,
        })),
        already_recorded: marked.size > 0,
        // บอกหน้าจอว่าให้แนะนำอะไร แทนที่จะขึ้นตารางว่างแล้วผู้ใช้งงว่าพังไหม
        needs_roster: roster.length === 0,
      },
    });
  },
  { permission: "attendance.view_all" }
);

/** บันทึกทั้งคาบในครั้งเดียว เช็กซ้ำคือแก้ของเดิม ไม่ใช่เพิ่มแถว */
export const POST = withAuth(
  async (req, { principal }) => {
    const parsed = await parseBody(req, SaveSchema);
    if (!parsed.ok) return parsed.response;
    const { class_schedule_id, attend_date, entries } = parsed.data;

    const supabase = getServiceClient();

    // ยืนยันว่าทุกคนที่ส่งมาอยู่ในห้องของคาบนี้จริง กันการเช็กชื่อข้ามห้อง
    // ด้วยการยิง student_id มั่ว ๆ เข้ามา
    const { data: schedule } = await supabase
      .from("class_schedules")
      .select("class_group_id")
      .eq("id", class_schedule_id)
      .maybeSingle();

    if (!schedule) {
      return NextResponse.json({ status: "error", message: "ไม่พบคาบเรียนนี้" }, { status: 404 });
    }

    const { data: roster } = await supabase
      .from("students")
      .select("student_id")
      .eq("class_group_id", schedule.class_group_id);

    const allowed = new Set((roster ?? []).map((r) => r.student_id));
    const strays = entries.filter((e) => !allowed.has(e.student_id));
    if (strays.length) {
      return NextResponse.json(
        {
          status: "error",
          message: `มีนักเรียนที่ไม่ได้อยู่ในห้องของคาบนี้: ${strays.map((s) => s.student_id).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // upsert บน unique (คาบ, นักเรียน, วันที่) — ครูเช็กซ้ำได้โดยยอดขาดไม่นับซ้ำ
    const { error } = await supabase
      .from("class_attendance")
      .upsert(
        entries.map((e) => ({
          class_schedule_id,
          student_id: e.student_id,
          attend_date,
          status: e.status,
          note: e.note ?? null,
          recorded_by: principal.subjectId,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "class_schedule_id,student_id,attend_date" }
      );

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const absent = entries.filter((e) => e.status === "absent").length;
    const late = entries.filter((e) => e.status === "late").length;

    return {
      response: NextResponse.json({
        status: "success",
        saved: entries.length,
        summary: { absent, late, present: entries.length - absent - late },
        message: `บันทึกแล้ว ${entries.length} คน · ขาด ${absent} · สาย ${late}`,
      }),
      audit: {
        entityId: class_schedule_id,
        after: { attend_date, count: entries.length, absent, late },
      },
    };
  },
  {
    permission: "attendance.update",
    audit: { action: "class_attendance.record", entityType: "class_schedule" },
  }
);
