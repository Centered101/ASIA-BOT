import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function isFallbackLogin(studentId: string, password: string) {
  const fallbackUsername = process.env.ADMIN_FALLBACK_USERNAME;
  const fallbackPassword = process.env.ADMIN_FALLBACK_PASSWORD;
  return !!fallbackUsername && !!fallbackPassword && studentId === fallbackUsername && password === fallbackPassword;
}

function fallbackStudentSession(studentId: string) {
  return {
    id: "env-fallback-student",
    student_id: studentId,
    first_name: "Super",
    last_name: "Admin",
    nickname: "ผู้ดูแลสูงสุด",
    program: "ระบบสำรอง",
    department: "ผู้ดูแลระบบ",
    entry_year: String(new Date().getFullYear()),
    student_phone: null,
    uid: null,
    photo_url: null,
    card_status: "active",
    created_at: null,
    updated_at: null,
    google_email: null,
    line_user_id: null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { student_id, student_phone } = await req.json();

    if (!student_id || !student_phone) {
      return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    const normalizedPhone = String(student_phone).trim().replace(/^0+/, "");

    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", student_id.trim())
      .single();

    if (error || !data) {
      if (isFallbackLogin(student_id.trim(), student_phone.trim())) {
        await logLogin(student_id, "success", "env fallback", req);
        return NextResponse.json({ status: "success", data: fallbackStudentSession(student_id.trim()) });
      }
      await logLogin(student_id, "failed", "student not found", req);
      return NextResponse.json({ status: "error", message: "ไม่พบรหัสนักเรียนนี้ในระบบ" });
    }

    const storedPhone = String(data.student_phone ?? "").replace(/^0+/, "");
    if (storedPhone !== normalizedPhone && data.student_phone !== student_phone.trim()) {
      if (isFallbackLogin(student_id.trim(), student_phone.trim())) {
        await logLogin(student_id, "success", "env fallback", req);
        return NextResponse.json({ status: "success", data: fallbackStudentSession(student_id.trim()) });
      }
      await logLogin(student_id, "failed", "wrong phone", req);
      return NextResponse.json({ status: "error", message: "เบอร์โทรไม่ถูกต้อง" });
    }

    await logLogin(student_id, "success", "login ok", req);
    return NextResponse.json({ status: "success", data });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}

async function logLogin(student_id: string, status: string, reason: string, req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  try {
    await supabase.from("login_logs").insert({
      student_id_attempt: student_id,
      status,
      reason,
      ip_address: ip,
      user_agent: req.headers.get("user-agent") ?? "",
    });
  } catch { /* silent */ }
}
