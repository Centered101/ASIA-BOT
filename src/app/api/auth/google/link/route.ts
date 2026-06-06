import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const studentId = String(body.student_id ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const googleId = String(body.google_id ?? "").trim();
    const name = String(body.name ?? "").trim();
    const avatarUrl = String(body.avatar_url ?? "").trim();

    if (!studentId || !email || !googleId) {
      return NextResponse.json({ status: "error", message: "ข้อมูล Google หรือรหัสนักเรียนไม่ครบ" }, { status: 400 });
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();

    if (studentError) {
      return NextResponse.json({ status: "error", message: studentError.message }, { status: 500 });
    }

    if (!student) {
      return NextResponse.json({ status: "error", message: "ไม่พบนักเรียนที่จะเชื่อม Google" }, { status: 404 });
    }

    const { data: existingByEmail, error: emailError } = await (supabase.from("students") as any)
      .select("student_id")
      .eq("google_email", email)
      .maybeSingle();

    if (emailError) {
      const missingColumn = emailError.code === "42703" || emailError.code === "PGRST204" || /google_email/i.test(emailError.message);
      return NextResponse.json({
        status: missingColumn ? "needs_setup" : "error",
        message: missingColumn ? "ระบบยังไม่พร้อมเชื่อมบัญชี Google กรุณาติดต่อผู้ดูแล" : emailError.message,
      }, { status: missingColumn ? 200 : 500 });
    }

    if (existingByEmail && existingByEmail.student_id !== studentId) {
      return NextResponse.json({ status: "error", message: "Google บัญชีนี้ถูกผูกกับนักเรียนคนอื่นแล้ว" }, { status: 409 });
    }

    const { data: existingById, error: idError } = await (supabase.from("students") as any)
      .select("student_id")
      .eq("google_id", googleId)
      .maybeSingle();

    if (idError) {
      const missingColumn = idError.code === "42703" || idError.code === "PGRST204" || /google_id/i.test(idError.message);
      return NextResponse.json({
        status: missingColumn ? "needs_setup" : "error",
        message: missingColumn ? "ระบบยังไม่พร้อมเชื่อมบัญชี Google กรุณาติดต่อผู้ดูแล" : idError.message,
      }, { status: missingColumn ? 200 : 500 });
    }

    if (existingById && existingById.student_id !== studentId) {
      return NextResponse.json({ status: "error", message: "Google บัญชีนี้ถูกผูกกับนักเรียนคนอื่นแล้ว" }, { status: 409 });
    }

    const updateData: Record<string, string> = {
      google_email: email,
      google_id: googleId,
      google_name: name,
      google_avatar_url: avatarUrl,
    };
    if (!student.photo_url && avatarUrl) updateData.photo_url = avatarUrl;

    const { data: updated, error: updateError } = await (supabase.from("students") as any)
      .update(updateData)
      .eq("student_id", studentId)
      .select("*")
      .single();

    if (updateError) {
      const missingColumn = updateError.code === "42703" || updateError.code === "PGRST204" || /google_/i.test(updateError.message);
      return NextResponse.json({
        status: missingColumn ? "needs_setup" : "error",
        message: missingColumn ? "ระบบยังไม่พร้อมเชื่อมบัญชี Google กรุณาติดต่อผู้ดูแล" : updateError.message,
      }, { status: missingColumn ? 200 : 500 });
    }

    return NextResponse.json({ status: "success", data: updated });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
