import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { MAX_AGE, MIN_AGE, calcAge } from "@/lib/student-grade";
import { isValidThaiNationalId } from "@/lib/student-validate";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCardCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      student_id, student_phone, first_name, last_name, nickname, program, entry_year, department,
      birth_date, gender, national_id, address,
      google_email, google_id, google_name, google_avatar_url,
    } = body;

    if (!student_id || !student_phone || !first_name || !last_name || !program || !entry_year || !department) {
      return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    // ตรวจซ้ำฝั่งเซิร์ฟเวอร์ ห้ามเชื่อ client อย่างเดียว
    // ทั้งสี่ช่องนี้ไม่บังคับ ตรวจเฉพาะตอนที่ส่งค่ามา
    const cleanNationalId = String(national_id ?? "").replace(/\D/g, "");
    if (cleanNationalId) {
      if (cleanNationalId.length !== 13) {
        return NextResponse.json({ status: "error", message: "เลขประจำตัวประชาชนต้องมี 13 หลัก" }, { status: 400 });
      }
      if (!isValidThaiNationalId(cleanNationalId)) {
        return NextResponse.json({ status: "error", message: "เลขประจำตัวประชาชนไม่ถูกต้อง" }, { status: 400 });
      }
    }
    if (birth_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birth_date))) {
        return NextResponse.json({ status: "error", message: "รูปแบบวันเกิดไม่ถูกต้อง" }, { status: 400 });
      }
      const age = calcAge(String(birth_date));
      if (!age) {
        return NextResponse.json({ status: "error", message: "วันเกิดไม่ถูกต้อง" }, { status: 400 });
      }
      if (age.years < MIN_AGE) {
        return NextResponse.json({ status: "error", message: `ผู้สมัครต้องมีอายุอย่างน้อย ${MIN_AGE} ปี` }, { status: 400 });
      }
      if (age.years > MAX_AGE) {
        return NextResponse.json({ status: "error", message: "อายุไม่สมเหตุสมผล กรุณาตรวจสอบวันเกิด" }, { status: 400 });
      }
    }
    if (gender && !["male", "female", "other"].includes(String(gender))) {
      return NextResponse.json({ status: "error", message: "เพศไม่ถูกต้อง" }, { status: 400 });
    }

    const { data: existing } = await supabase.from("students").select("id").eq("student_id", student_id.trim()).single();
    if (existing) {
      return NextResponse.json({ status: "duplicate", message: "รหัสนักเรียนนี้มีในระบบแล้ว" });
    }

    // Generate unique card UID: {student_id}-{random 10-char hex} — retry on collision
    const sid = student_id.trim();
    let uid = `${sid}-${generateCardCode()}`;
    for (let i = 0; i < 5; i++) {
      const { data: taken } = await supabase.from("students").select("id").eq("uid", uid).single();
      if (!taken) break;
      uid = `${sid}-${generateCardCode()}`;
    }

    const basePayload = {
      student_id: student_id.trim(),
      student_phone: student_phone.trim(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      nickname: nickname?.trim() || null,
      birth_date: birth_date ? String(birth_date) : null,
      gender: gender ? String(gender) : null,
      national_id: cleanNationalId || null,
      address: address?.trim() || null,
      program: program.trim(),
      entry_year: String(entry_year),
      department: department.trim(),
      card_status: "inactive",
      uid,
    };

    const googlePayload = google_email ? {
      google_email: String(google_email).trim().toLowerCase(),
      google_id: google_id ? String(google_id).trim() : null,
      google_name: google_name ? String(google_name).trim() : null,
      google_avatar_url: google_avatar_url ? String(google_avatar_url).trim() : null,
      photo_url: google_avatar_url ? String(google_avatar_url).trim() : null,
    } : {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { error } = await (supabase.from("students") as any).insert({ ...basePayload, ...googlePayload });

    if (error && google_email && (error.code === "42703" || error.code === "PGRST204" || /google_|photo_url/i.test(error.message))) {
      // Database has not been migrated for Google Auth yet. Register still works,
      // but Google login will require the migration below to find this student later.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retry = await (supabase.from("students") as any).insert(basePayload);
      error = retry.error;
    }

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    const { data: student } = await supabase
      .from("students").select("*").eq("student_id", student_id.trim()).single();

    return NextResponse.json({ status: "success", data: student });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
