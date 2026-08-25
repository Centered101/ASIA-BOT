import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { resolveOwnStudentId } from "@/lib/server/student-identity";

/** รหัสมีอายุสั้น ๆ พอให้สลับไปเปิดแอป LINE แล้วพิมพ์ทัน */
const TTL_MINUTES = 10;

/**
 * ออกรหัสยืนยัน 6 หลักสำหรับผูกบัญชี LINE
 *
 * นี่คือครึ่งแรกของการอุดช่องโหว่เดิม: ของเก่าให้พิมพ์ "รหัสนักเรียน" เข้าแชท
 * แล้วผูกให้เลย ทั้งที่รหัสนักเรียนพิมพ์อยู่บนบัตรและใช้เป็น username ตอนล็อกอิน
 * ใครรู้รหัสของคนอื่นจึงสวมสิทธิ์รับแจ้งเตือนและถาม AI แทนเขาได้
 *
 * รหัสที่ออกจากที่นี่ต่างออกไปตรงที่ต้อง "ล็อกอินเว็บสำเร็จก่อน" ถึงจะได้มา
 * ใช้ได้ครั้งเดียว และหมดอายุใน 10 นาที คนที่รู้แค่รหัสนักเรียนของคนอื่นจึง
 * ผูกไม่ได้อีกต่อไป
 *
 * ออกใบใหม่ทีไรจะล้มใบเก่าที่ยังไม่ถูกใช้ทิ้งเสมอ เพื่อไม่ให้มีรหัสลอยค้าง
 * หลายใบพร้อมกันต่อคนหนึ่งคน
 */
export const POST = withAuth(
  async (_req, { principal }) => {
    const studentId = await resolveOwnStudentId(principal);
    if (!studentId) {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ไม่ได้ผูกกับนักเรียน" },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();

    const { data: student } = await supabase
      .from("students")
      .select("student_id, line_user_id")
      .eq("student_id", studentId)
      .maybeSingle();

    if (student?.line_user_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "บัญชีนี้เชื่อม LINE อยู่แล้ว ถ้าจะเปลี่ยนบัญชี ให้กดยกเลิกการเชื่อมก่อน",
        },
        { status: 409 }
      );
    }

    // ล้มใบเก่าที่ยังไม่ถูกใช้ โดยทำให้หมดอายุย้อนหลังแทนการลบ จะได้ยังเห็น
    // ร่องรอยว่าเคยขอรหัสไปกี่ครั้งเวลาไล่ตรวจย้อนหลัง
    await supabase
      .from("line_link_codes")
      .update({ expires_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString());

    // randomInt เป็น CSPRNG — Math.random() เดาลำดับต่อไปได้ ไม่เหมาะกับรหัสยืนยัน
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();

    const { error } = await supabase
      .from("line_link_codes")
      .insert({ student_id: studentId, code, expires_at: expiresAt });

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({
        status: "success",
        code,
        expires_at: expiresAt,
        expires_in_minutes: TTL_MINUTES,
      }),
      // ตัวรหัสไม่ลง audit log โดยตั้งใจ — log อ่านได้โดยแอดมินหลายคน
      audit: { entityId: studentId },
    };
  },
  {
    permission: "student.update_own",
    audit: { action: "student.line_link_code_issued", entityType: "student" },
  }
);
