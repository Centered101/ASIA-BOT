import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { admin_id, google_id, google_email, avatar_url } = await req.json().catch(() => ({}));

  if (!admin_id || !google_email) {
    return NextResponse.json({ ok: false, message: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  // ตรวจสอบ admin
  const { data: admin } = await (supabase.from("admins") as any)
    .select("id, admin_id, admin_status, google_email")
    .eq("admin_id", admin_id)
    .maybeSingle();

  if (!admin) return NextResponse.json({ ok: false, message: "ไม่พบบัญชีผู้ดูแล" }, { status: 404 });
  if (admin.admin_status !== "active") return NextResponse.json({ ok: false, message: "บัญชีนี้ถูกปิดการใช้งาน" }, { status: 403 });

  // ตรวจสอบว่า email นี้ถูกใช้กับบัญชีอื่นแล้วหรือไม่
  const { data: conflict } = await (supabase.from("admins") as any)
    .select("admin_id")
    .eq("google_email", google_email)
    .neq("admin_id", admin_id)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json({
      ok: false,
      message: `Google email นี้ผูกกับบัญชี ${conflict.admin_id} อยู่แล้ว`,
    }, { status: 409 });
  }

  const updates: Record<string, unknown> = {
    google_email,
    ...(google_id ? { google_id } : {}),
    ...(avatar_url && !admin.avatar ? { avatar: avatar_url } : {}),
  };

  const { error } = await (supabase.from("admins") as any)
    .update(updates)
    .eq("admin_id", admin_id);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
