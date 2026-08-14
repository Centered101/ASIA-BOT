import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import type { Database } from "@/types/database";

type StudentUpdate = Database["public"]["Tables"]["students"]["Update"];
type StatusChangeInsert = Database["public"]["Tables"]["student_status_changes"]["Insert"];

/**
 * จัดนักเรียนเข้าห้องเรียนและกำหนดครูที่ปรึกษา
 *
 * นี่คือตัวปลดล็อกของ roadmap: `class_groups` มี 19 ห้องและ `class_schedules`
 * มี 39 คาบอยู่แล้ว แต่ไม่มีนักเรียนคนไหนผูกกับห้องเลย ตราบใดที่
 * students.class_group_id ยังว่าง งานครูที่ปรึกษา โฮมรูม เช็กชื่อรายวิชา
 * คะแนนพฤติกรรม และการเยี่ยมบ้าน ทำไม่ได้สักอย่าง
 *
 * ทุกการย้ายถูกบันทึกลง student_status_changes โดยอัตโนมัติ ฝ่ายทะเบียนจึงเห็น
 * ว่าใครย้ายห้องเมื่อไหร่ ไม่ใช่เห็นแค่ค่าปัจจุบัน
 */

const AssignSchema = z.object({
  student_ids: z.array(z.string().trim().min(1)).min(1, "ต้องระบุนักเรียนอย่างน้อย 1 คน").max(200),
  // null = ถอดออกจากห้อง (เช่น ลาออกแล้ว) จึงต้องแยกจาก undefined ที่แปลว่าไม่แตะ
  class_group_id: z.string().uuid().nullable().optional(),
  advisor_teacher_id: z.string().uuid().nullable().optional(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD").optional(),
  academic_year: z.string().trim().nullable().optional(),
  reason: z.string().trim().nullable().optional(),
});

export const POST = withAuth<Record<string, string>>(
  async (req, { principal }) => {
    const parsed = await parseBody(req, AssignSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    if (body.class_group_id === undefined && body.advisor_teacher_id === undefined) {
      return NextResponse.json(
        { status: "error", message: "ต้องระบุ class_group_id หรือ advisor_teacher_id อย่างน้อยหนึ่งอย่าง" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // ตรวจว่าห้องและครูมีอยู่จริงก่อนแตะข้อมูลนักเรียน ถ้าปล่อยให้ FK เด้ง
    // ผู้ใช้จะได้ error 500 ที่อ่านไม่รู้เรื่องแทนคำอธิบายว่าอะไรผิด
    if (body.class_group_id) {
      const { data } = await supabase
        .from("class_groups").select("id").eq("id", body.class_group_id).maybeSingle();
      if (!data) {
        return NextResponse.json({ status: "error", message: "ไม่พบห้องเรียนที่ระบุ" }, { status: 404 });
      }
    }
    if (body.advisor_teacher_id) {
      const { data } = await supabase
        .from("teachers").select("id").eq("id", body.advisor_teacher_id).maybeSingle();
      if (!data) {
        return NextResponse.json(
          // ตาราง teachers ยังว่างทั้งระบบ ข้อความนี้จึงบอกทางออกไว้ด้วย
          { status: "error", message: "ไม่พบครูที่ระบุ — ต้องเพิ่มข้อมูลครูในแท็บ teachers ก่อน" },
          { status: 404 }
        );
      }
    }

    const { data: students, error: readError } = await supabase
      .from("students")
      .select("student_id, class_group_id, advisor_teacher_id")
      .in("student_id", body.student_ids);

    if (readError) {
      return NextResponse.json({ status: "error", message: readError.message }, { status: 500 });
    }

    const found = students ?? [];
    const missing = body.student_ids.filter(
      (id) => !found.some((s) => s.student_id === id)
    );
    if (missing.length) {
      return NextResponse.json(
        { status: "error", message: `ไม่พบรหัสนักเรียน: ${missing.join(", ")}` },
        { status: 404 }
      );
    }

    const update: StudentUpdate = {};
    if (body.class_group_id !== undefined) update.class_group_id = body.class_group_id;
    if (body.advisor_teacher_id !== undefined) update.advisor_teacher_id = body.advisor_teacher_id;

    const { error: updateError } = await supabase
      .from("students")
      .update(update)
      .in("student_id", body.student_ids);

    if (updateError) {
      return NextResponse.json({ status: "error", message: updateError.message }, { status: 500 });
    }

    // บันทึกไทม์ไลน์ เฉพาะคนที่ค่าเปลี่ยนจริง ไม่ใช่ทุกคนที่อยู่ใน request
    // ไม่งั้นการกดยืนยันซ้ำจะสร้างประวัติปลอมขึ้นมาเรื่อย ๆ
    const effectiveDate = body.effective_date ?? new Date().toISOString().slice(0, 10);
    const actor = principal.subjectId;
    const changes: StatusChangeInsert[] = [];

    for (const s of found) {
      if (body.class_group_id !== undefined && s.class_group_id !== body.class_group_id) {
        changes.push({
          student_id: s.student_id,
          change_type: "class_group",
          from_value: s.class_group_id,
          to_value: body.class_group_id,
          effective_date: effectiveDate,
          academic_year: body.academic_year ?? null,
          reason: body.reason ?? null,
          recorded_by: actor,
        });
      }
      if (body.advisor_teacher_id !== undefined && s.advisor_teacher_id !== body.advisor_teacher_id) {
        changes.push({
          student_id: s.student_id,
          change_type: "advisor",
          from_value: s.advisor_teacher_id,
          to_value: body.advisor_teacher_id,
          effective_date: effectiveDate,
          academic_year: body.academic_year ?? null,
          reason: body.reason ?? null,
          recorded_by: actor,
        });
      }
    }

    if (changes.length) {
      const { error: logError } = await supabase.from("student_status_changes").insert(changes);
      // ข้อมูลนักเรียนถูกอัปเดตไปแล้ว การบันทึกไทม์ไลน์ล้มจึงไม่ควรทำให้
      // ผู้ใช้คิดว่าการย้ายห้องไม่สำเร็จ แต่ต้องไม่เงียบ — ส่งกลับไปใน response
      if (logError) {
        return {
          response: NextResponse.json({
            status: "success",
            updated: found.length,
            logged: 0,
            warning: `ย้ายสำเร็จแต่บันทึกประวัติไม่ได้: ${logError.message}`,
          }),
          audit: { after: { ...update, student_ids: body.student_ids } },
        };
      }
    }

    return {
      response: NextResponse.json({
        status: "success",
        updated: found.length,
        logged: changes.length,
      }),
      audit: { after: { ...update, student_ids: body.student_ids, logged: changes.length } },
    };
  },
  {
    permission: "student.update",
    audit: { action: "roster.assign", entityType: "student" },
  }
);

/** รายชื่อนักเรียนต่อห้อง และจำนวนคนที่ยังไม่ถูกจัดเข้าห้อง */
export const GET = withAuth<Record<string, string>>(
  async (req) => {
    const classGroupId = new URL(req.url).searchParams.get("class_group_id")?.trim();
    const supabase = getServiceClient();

    let q = supabase
      .from("students")
      .select("student_id, first_name, last_name, nickname, program, department, entry_year, student_status, class_group_id, advisor_teacher_id")
      .order("student_id");

    // ?class_group_id=unassigned คือคำถาม "ใครยังไม่มีห้อง" ซึ่งเป็นสิ่งแรก
    // ที่ฝ่ายทะเบียนต้องรู้ตอนเริ่มจัดห้อง
    if (classGroupId === "unassigned") q = q.is("class_group_id", null);
    else if (classGroupId) q = q.eq("class_group_id", classGroupId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    return NextResponse.json({
      status: "success",
      data: rows,
      count: rows.length,
      unassigned: rows.filter((s) => !s.class_group_id).length,
    });
  },
  { permission: "student.view_all" }
);
