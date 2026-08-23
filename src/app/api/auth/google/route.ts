import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { attachSessionCookie } from "@/lib/server/session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const googleId = String(body.google_id ?? "").trim();
    const name = String(body.name ?? "").trim();
    const avatarUrl = String(body.avatar_url ?? "").trim();

    if (!email) {
      return NextResponse.json({ status: "error", message: "ไม่พบอีเมลจาก Google" }, { status: 400 });
    }

    const { data, error } = await (supabase.from("students") as any)
      .select("*")
      .eq("google_email", email)
      .maybeSingle();

    if (error) {
      const missingColumn = error.code === "42703" || error.code === "PGRST204" || /google_email/i.test(error.message);
      return NextResponse.json({
        status: missingColumn ? "needs_setup" : "error",
        message: missingColumn
          ? "ระบบยังไม่พร้อมเชื่อมบัญชี Google กรุณาติดต่อผู้ดูแล"
          : error.message,
        profile: { email, google_id: googleId, name, avatar_url: avatarUrl },
      }, { status: missingColumn ? 200 : 500 });
    }

    let student = data;
    if (!student && googleId) {
      const { data: byGoogleId, error: googleIdError } = await (supabase.from("students") as any)
        .select("*")
        .eq("google_id", googleId)
        .maybeSingle();

      if (googleIdError) {
        const missingColumn = googleIdError.code === "42703" || googleIdError.code === "PGRST204" || /google_id/i.test(googleIdError.message);
        return NextResponse.json({
          status: missingColumn ? "needs_setup" : "error",
          message: missingColumn
            ? "ระบบยังไม่พร้อมเชื่อมบัญชี Google กรุณาติดต่อผู้ดูแล"
            : googleIdError.message,
          profile: { email, google_id: googleId, name, avatar_url: avatarUrl },
        }, { status: missingColumn ? 200 : 500 });
      }

      student = byGoogleId;
    }

    if (!student) {
      return NextResponse.json({
        status: "needs_register",
        message: "ยังไม่มีนักเรียนที่เชื่อมกับบัญชี Google นี้",
        profile: { email, google_id: googleId, name, avatar_url: avatarUrl },
      });
    }

    // ออกคุกกี้ session ให้ด้วย ไม่ใช่คืนแถวนักเรียนอย่างเดียว
    //
    // เดิมทางเข้าด้วย Google เก็บแต่ localStorage ฝั่งเบราว์เซอร์ ซึ่งพอมี Mycer
    // ที่เรนเดอร์ฝั่งเซิร์ฟเวอร์และอ่านตัวตนจากคุกกี้อย่างเดียว คนที่ล็อกอินด้วย
    // Google จะโดนเด้งกลับหน้าล็อกอินวนไปเรื่อย ๆ ทั้งที่เพิ่งล็อกอินสำเร็จ
    //
    // ทางเข้าด้วยรหัส+เบอร์โทร (/api/auth/login) ออกคุกกี้อยู่แล้ว ตรงนี้จึงแค่
    // ทำให้สองทางเข้าเท่ากัน — attachSessionCookie เงียบเองถ้าบัญชียังไม่ถูกผูก

    const res = NextResponse.json({ status: "success", data: student });
    await attachSessionCookie(res, req, "student", student.student_id);
    return res;
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
