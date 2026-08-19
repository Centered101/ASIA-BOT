import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { CARD_PROFILE_FIELDS, phoneMatches, type CardProfile } from "@/lib/student-card";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * ยืนยันตัวตนนักเรียนด้วยรหัสนักเรียน + เบอร์โทร (แบบเดียวกับหน้าเข้าสู่ระบบ)
 * แล้วส่งข้อมูลเดิมกลับไปเติมในฟอร์มลงทะเบียนบัตร
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const studentId = String(body.student_id ?? "").trim();
    const phone     = String(body.student_phone ?? "").trim();

    if (!studentId || !phone) {
      return NextResponse.json({ status: "error", message: "กรุณากรอกรหัสนักเรียนและเบอร์โทร" }, { status: 400 });
    }

    const { data: student, error } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();

    if (error)    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    if (!student) return NextResponse.json({ status: "error", message: "ไม่พบรหัสนักเรียนนี้ในระบบ" }, { status: 404 });

    if (!phoneMatches(student.student_phone, phone)) {
      return NextResponse.json({ status: "error", message: "เบอร์โทรไม่ตรงกับรหัสนักเรียนนี้" }, { status: 401 });
    }

    // เติมเฉพาะฟิลด์ที่ฟอร์มใช้ ไม่ส่งข้อมูลอื่นออกไปเกินจำเป็น
    const row = student as unknown as Record<string, unknown>;
    const profile = Object.fromEntries(
      CARD_PROFILE_FIELDS.map(field => [field, String(row[field] ?? "")])
    ) as CardProfile;

    return NextResponse.json({
      status: "success",
      data: {
        student_id:  student.student_id,
        full_name:   `${student.first_name} ${student.last_name}`.trim(),
        photo_url:   student.photo_url,
        card_status: student.card_status,
        uid:         student.uid,
        profile,
      },
    });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
