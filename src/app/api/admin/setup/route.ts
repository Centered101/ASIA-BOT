import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import bcrypt from "bcryptjs";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — check if setup is still needed
export async function GET() {
  const { count } = await supabase
    .from("admins")
    .select("id", { count: "exact", head: true });
  return NextResponse.json({ needed: (count ?? 0) === 0 });
}

export async function POST(req: NextRequest) {
  try {
    // Block if any admin already exists
    const { count } = await supabase
      .from("admins")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0)
      return NextResponse.json(
        { ok: false, message: "ระบบมี Admin อยู่แล้ว ไม่สามารถสมัครเพิ่มได้" },
        { status: 403 }
      );

    const body = await req.json();
    const { secret, username, password, first_name, last_name, nickname } = body;

    const envSecret = process.env.ADMIN_SECRET;
    if (!envSecret || secret !== envSecret)
      return NextResponse.json({ ok: false, message: "ADMIN_SECRET ไม่ถูกต้อง" }, { status: 401 });

    if (!username?.trim() || !password)
      return NextResponse.json({ ok: false, message: "กรุณากรอก username และรหัสผ่าน" }, { status: 400 });
    if (password.length < 6)
      return NextResponse.json({ ok: false, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });

    const password_hash = await bcrypt.hash(password, 12);
    const admin_id = `ADM-${Date.now()}`;

    const { error } = await supabase.from("admins").insert({
      admin_id,
      username: username.trim().toLowerCase(),
      password_hash,
      role: "superadmin",
      admin_status: "active",
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
      nickname: nickname?.trim() || null,
    });

    if (error)
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, admin_id });
  } catch {
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
