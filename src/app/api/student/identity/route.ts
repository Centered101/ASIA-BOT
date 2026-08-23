import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { resolveOwnStudentId } from "@/lib/server/student-identity";

/**
 * ข้อมูลประจำตัวสำหรับการ์ด "บัญชีของคุณ" ที่โผล่ในหลายหน้า
 *
 * มีอยู่เพราะ session ใน localStorage ตอบไม่ครบ — มันเก็บทั้งแถว students ไว้ก็จริง
 * แต่ห้องเรียนเก็บเป็น class_group_id (uuid) ไม่ใช่ชื่อห้อง หน้าไหนอยากโชว์ "ปวช.3/2"
 * จึงต้องยิงถามเอง ผลคือแต่ละหน้าโชว์ไม่เท่ากัน บางหน้ามีสาขา บางหน้ามีแต่ชื่อเล่น
 *
 * ตอบชุดเดียวให้ทุกหน้าใช้ร่วมกัน (ดู StudentIdentityCard) — เพิ่มฟิลด์ที่นี่
 * ที่เดียวแล้วขึ้นพร้อมกันทุกหน้า
 */
export const GET = withAuth(
  async (_req, { principal }) => {
    const studentId = await resolveOwnStudentId(principal);
    if (!studentId) {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ไม่ได้ผูกกับนักเรียน" },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();
    const { data: student, error } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, nickname, program, department, entry_year, student_phone, photo_url, google_email, class_group_id")
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
    if (!student) {
      return NextResponse.json({ status: "error", message: "ไม่พบนักเรียน" }, { status: 404 });
    }

    // ห้องเป็น FK จึงต้องแปลงเป็นชื่อ ไม่งั้นการ์ดจะโชว์ uuid ให้เจ้าตัวอ่าน
    // เหมือนที่เคยเกิดกับไทม์ไลน์ (ดู withTimelineLabels)
    let classGroup: string | null = null;
    if (student.class_group_id) {
      const { data: group } = await supabase
        .from("class_groups")
        .select("name")
        .eq("id", student.class_group_id)
        .maybeSingle();
      classGroup = group?.name ?? null;
    }

    return NextResponse.json({
      status: "success",
      data: {
        student_id: student.student_id,
        first_name: student.first_name,
        last_name: student.last_name,
        nickname: student.nickname,
        program: student.program,
        department: student.department,
        entry_year: student.entry_year,
        phone: student.student_phone,
        photo_url: student.photo_url,
        google_email: student.google_email,
        class_group: classGroup,
      },
    });
  },
  { permission: "student.view_own" }
);
