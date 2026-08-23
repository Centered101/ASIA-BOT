import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { attachSessionCookie } from "@/lib/server/session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { google_id, email, name, avatar_url } = await req.json().catch(() => ({}));

  if (!email) return NextResponse.json({ ok: false, message: "ไม่พบ email จาก Google" }, { status: 400 });

  // ค้นหา admin ด้วย google_email หรือ email ตรงกัน
  const { data: admin } = await (supabase.from("admins") as any)
    .select("id, admin_id, username, role, first_name, last_name, nickname, email, phone, entry_year, department, avatar, admin_status, google_id, google_email, created_at")
    .or(`google_email.eq.${email},email.eq.${email}`)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({
      ok: false,
      message: "ไม่พบบัญชีผู้ดูแลที่ผูกกับ Google นี้ กรุณาติดต่อ Superadmin",
    }, { status: 404 });
  }

  if (admin.admin_status !== "active") {
    return NextResponse.json({ ok: false, message: "บัญชีนี้ถูกปิดการใช้งาน" }, { status: 403 });
  }

  // อัปเดต google_id เท่านั้น ไม่เอารูปจาก Google มาบันทึก
  const updates: Record<string, unknown> = {};
  if (google_id && !admin.google_id) updates.google_id = google_id;
  if (!admin.google_email)           updates.google_email = email;
  if (Object.keys(updates).length > 0) {
    await (supabase.from("admins") as any).update(updates).eq("id", admin.id);
  }

  // Log success
  try {
    await (supabase.from("admin_logs") as any).insert({
      admin_id_attempt: admin.admin_id,
      status: "success",
      reason: "google_oauth",
    });
  } catch { /* silent */ }

  const res = NextResponse.json({
    ok: true,
    admin: {
      admin_id:   admin.admin_id,
      username:   admin.username,
      role:       admin.role,
      first_name: admin.first_name,
      last_name:  admin.last_name,
      nickname:   admin.nickname,
      avatar:     admin.avatar ?? null,
      email:        admin.email ?? email,
      phone:        admin.phone ?? null,
      entry_year:   admin.entry_year ?? null,
      department:   admin.department ?? null,
      created_at:   admin.created_at ?? null,
      google_email: admin.google_email ?? email,
    },
  });

  // ล็อกอินด้วย Google ต้องได้คุกกี้เหมือนล็อกอินด้วยรหัสผ่าน (ดู /api/admin/auth)
  // ที่นี่เคยตกหล่น แอดมินที่เข้าด้วย Google จึงมีแต่ session ใน localStorage
  // ทำงานได้เพราะ x-admin-id ตัวเก่ายังเปิดอยู่ แต่วันที่ Phase 14 ปิดมัน
  // คนกลุ่มนี้จะเข้าไม่ได้ทั้งหมด และตอนนี้ก็เรียก API ที่อ่านคุกกี้อย่างเดียวไม่ได้
  await attachSessionCookie(res, req, "admin", admin.admin_id);
  return res;
}
