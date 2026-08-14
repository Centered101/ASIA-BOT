import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";

/**
 * Student 360 — ดึงข้อมูลนักเรียนหนึ่งคนแบบครบทุกด้านในครั้งเดียว
 *
 * แยกจาก /api/admin/students/[id] เดิมโดยตั้งใจ: เส้นทางเดิมคืนแถวใน
 * `students` ล้วน ๆ และถูกใช้ในหน้าแก้ไขข้อมูลซึ่งต้องการแค่นั้น
 * ถ้าไปเพิ่ม join เข้าไปจะทำให้ทุกหน้าที่เรียกมันช้าลงโดยไม่ได้ประโยชน์
 *
 * ยิง query แยกกันแทน join เดียว เพราะตารางลูกทั้งหมดเป็น one-to-many
 * การ join พร้อมกันหลายตัวจะทำให้จำนวนแถวคูณกัน
 */
export const GET = withAuth<{ id: string }>(
  async (_req, { params }) => {
    const studentId = decodeURIComponent(params.id).trim();
    if (!studentId) {
      return NextResponse.json(
        { status: "error", message: "ไม่ได้ระบุรหัสนักเรียน" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data: student, error } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
    if (!student) {
      return NextResponse.json({ status: "error", message: "ไม่พบนักเรียน" }, { status: 404 });
    }

    // ดึงส่วนที่เหลือพร้อมกัน แต่ละอันไม่ขึ้นต่อกัน
    const [guardians, education, timeline, achievements, positions, classGroup, advisor] =
      await Promise.all([
        supabase
          .from("guardians")
          .select("*")
          .eq("student_id", studentId)
          .order("is_primary", { ascending: false })
          .order("created_at"),
        supabase
          .from("student_education_history")
          .select("*")
          .eq("student_id", studentId)
          .order("graduated_year", { ascending: false }),
        supabase
          .from("student_status_changes")
          .select("*")
          .eq("student_id", studentId)
          .order("effective_date", { ascending: false })
          .limit(50),
        supabase
          .from("student_achievements")
          .select("*")
          .eq("student_id", studentId)
          .order("event_date", { ascending: false }),
        supabase
          .from("student_positions")
          .select("*")
          .eq("student_id", studentId)
          .order("started_on", { ascending: false }),
        // ห้องเรียนกับครูที่ปรึกษายังว่างทั้งระบบจนกว่าจะจัดรายชื่อ
        // จึงต้องรองรับกรณี null ไม่ใช่ถือว่าต้องมีเสมอ
        student.class_group_id
          ? supabase
              .from("class_groups")
              .select("id, name, program, grade, section, department")
              .eq("id", student.class_group_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        student.advisor_teacher_id
          ? supabase
              .from("teachers")
              .select("id, full_name, nickname, phone, email, department")
              .eq("id", student.advisor_teacher_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const positionRows = positions.data ?? [];

    // ถ้า query ตารางลูกตัวใดล้ม ต้องไม่ปล่อยให้กลายเป็น "ไม่มีข้อมูล" เงียบ ๆ
    // เพราะหน้าจอจะแสดงว่ายังไม่มีผู้ปกครองทั้งที่จริงคือตารางหาย/สิทธิ์ไม่พอ
    const partialErrors = (
      [
        ["guardians", guardians],
        ["education_history", education],
        ["status_timeline", timeline],
        ["achievements", achievements],
        ["positions", positions],
      ] as const
    )
      .filter(([, r]) => "error" in r && r.error)
      .map(([name, r]) => `${name}: ${(r as { error: { message: string } }).error.message}`);

    return NextResponse.json({
      status: "success",
      ...(partialErrors.length ? { partial_errors: partialErrors } : {}),
      data: {
        student,
        class_group: classGroup.data ?? null,
        advisor: advisor.data ?? null,
        guardians: guardians.data ?? [],
        education_history: education.data ?? [],
        status_timeline: timeline.data ?? [],
        achievements: achievements.data ?? [],
        positions: positionRows,
        // นับให้ฝั่ง UI ใช้แสดงหัวข้อได้เลย โดยไม่ต้องดึงข้อมูลทั้งก้อนมานับเอง
        summary: {
          guardian_count: guardians.data?.length ?? 0,
          achievement_count: achievements.data?.length ?? 0,
          active_positions: positionRows.filter((p) => !p.ended_on).length,
        },
      },
    });
  },
  { permission: "student.view_all" }
);
