import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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
    const { student_id, student_phone, first_name, last_name, nickname, program, entry_year, department } = body;

    if (!student_id || !student_phone || !first_name || !last_name || !program || !entry_year || !department) {
      return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
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

    const { error } = await supabase.from("students").insert({
      student_id: student_id.trim(),
      student_phone: student_phone.trim(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      nickname: nickname?.trim() || null,
      program: program.trim(),
      entry_year: String(entry_year),
      department: department.trim(),
      card_status: "inactive",
      uid,
    });

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    const { data: student } = await supabase
      .from("students").select("*").eq("student_id", student_id.trim()).single();

    return NextResponse.json({ status: "success", data: student });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
