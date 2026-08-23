import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { resolveOwnStudentId } from "@/lib/server/student-identity";

/**
 * ยกเลิกการเชื่อมบัญชี LINE ของตัวเอง
 *
 * ไม่มี POST คู่กันโดยตั้งใจ — การ "เชื่อม" ทำจากฝั่งแชทเท่านั้น (นักเรียนพิมพ์
 * รหัสนักเรียนส่งเข้า LINE OA แล้ว webhook เขียน line_user_id ให้ ดู
 * /api/line/webhook) เพราะ line_user_id เป็นรหัสที่ LINE ออกให้ เจ้าตัวไม่มีทาง
 * รู้ค่าของตัวเอง ต่อให้มีช่องให้กรอกก็กรอกไม่ได้ และถ้าเปิดให้กรอกได้จริง
 * ใครที่รู้รหัสของคนอื่นก็ดักรับแจ้งเตือนแทนเขาได้
 *
 * แต่ "ยกเลิก" ต้องทำเองได้ เพราะคนเปลี่ยนบัญชี LINE หรือเปลี่ยนเครื่องเป็นเรื่องปกติ
 * ถ้าต้องรอแอดมินปลดให้ แจ้งเตือนส่วนตัวจะยังวิ่งไปเข้าบัญชีเก่าอยู่
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
      .select("student_id, line_user_id")
      .eq("student_id", studentId)
      .maybeSingle();

    if (!before?.line_user_id) {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ยังไม่ได้เชื่อม LINE" },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("students")
      .update({ line_user_id: null, updated_at: new Date().toISOString() })
      .eq("student_id", studentId);

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({
        status: "success",
        message: "ยกเลิกการเชื่อม LINE แล้ว จะไม่ได้รับแจ้งเตือนทาง LINE อีก",
      }),
      audit: { entityId: studentId, before: { line_user_id: before.line_user_id } },
    };
  },
  {
    permission: "student.update_own",
    audit: { action: "student.line_unlink", entityType: "student" },
  }
);
