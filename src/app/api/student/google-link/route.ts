import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { resolveOwnStudentId } from "@/lib/server/student-identity";

/**
 * ยกเลิกการเชื่อมบัญชี Google ของตัวเอง
 *
 * คู่กับ /api/student/line-link ที่ทำแบบเดียวกันกับ LINE — คนเปลี่ยนอีเมล
 * เปลี่ยนบัญชี หรือเผลอผูกผิดบัญชี เป็นเรื่องปกติ ถ้าต้องรอแอดมินปลดให้
 * เจ้าตัวจะค้างอยู่กับบัญชีที่ตัวเองไม่ได้ใช้แล้ว
 *
 * ต่างจาก LINE ตรงที่ Google เป็น "ทางเข้าระบบ" ไม่ใช่แค่ช่องทางแจ้งเตือน
 * ปลดทิ้งโดยไม่มีทางเข้าสำรอง = ล็อกตัวเองออกจากระบบถาวร จึงต้องเช็กก่อนว่า
 * ยังเหลือทางเข้าด้วยรหัสนักเรียน + เบอร์โทรอยู่จริง
 */
export const DELETE = withAuth(
  async (_req, { principal }) => {
    const studentId = await resolveOwnStudentId(principal);
    if (!studentId) {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ไม่ได้ผูกกับนักเรียน" },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();
    const { data: before } = await supabase
      .from("students")
      .select("student_id, google_email, google_id, student_phone")
      .eq("student_id", studentId)
      .maybeSingle();

    if (!before?.google_id && !before?.google_email) {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ยังไม่ได้เชื่อม Google" },
        { status: 409 }
      );
    }

    // ไม่มีเบอร์โทร = ล็อกอินด้วยรหัส+เบอร์ไม่ได้ ปลด Google ทิ้งตอนนี้แปลว่า
    // เข้าระบบไม่ได้อีกเลย ต้องให้กรอกเบอร์ไว้ก่อนถึงจะยอมปลด
    if (!before.student_phone) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "ยกเลิกไม่ได้ เพราะ Google เป็นทางเข้าระบบทางเดียวของบัญชีนี้ — กรอกเบอร์โทรในข้อมูลส่วนตัวก่อน แล้วค่อยยกเลิก",
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("students")
      .update({
        google_email: null,
        google_id: null,
        google_name: null,
        google_avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId);

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({
        status: "success",
        message: "ยกเลิกการเชื่อม Google แล้ว ครั้งต่อไปเข้าระบบด้วยรหัสนักเรียนและเบอร์โทร",
      }),
      audit: {
        entityId: studentId,
        before: { google_email: before.google_email, google_id: before.google_id },
      },
    };
  },
  {
    permission: "student.update_own",
    audit: { action: "student.google_unlink", entityType: "student" },
  }
);
