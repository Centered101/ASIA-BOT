import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import bcrypt from "bcryptjs";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function checkSecret(secret: string) {
  const env = process.env.ADMIN_SECRET;
  if (!env) return false;
  return secret === env;
}

// POST — multi-action recovery
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, action } = body;

    if (!checkSecret(secret))
      return NextResponse.json({ ok: false, message: "ADMIN_SECRET ไม่ถูกต้อง" }, { status: 401 });

    // ── list: return all admin usernames + roles ──────────────────────────────
    if (action === "list") {
      const { data, error } = await supabase
        .from("admins")
        .select("admin_id, username, role, first_name, last_name, admin_status")
        .order("created_at", { ascending: true });
      if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, admins: data ?? [] });
    }

    // ── reset: reset password for a given username ────────────────────────────
    if (action === "reset") {
      const { username, newPassword } = body;
      if (!username || !newPassword)
        return NextResponse.json({ ok: false, message: "กรุณาระบุ username และรหัสผ่านใหม่" }, { status: 400 });
      if (newPassword.length < 6)
        return NextResponse.json({ ok: false, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });

      const password_hash = await bcrypt.hash(newPassword, 12);
      // Check user exists first
      const { data: existing } = await supabase
        .from("admins")
        .select("id")
        .eq("username", username.trim().toLowerCase())
        .single();
      if (!existing)
        return NextResponse.json({ ok: false, message: `ไม่พบ username "${username}"` }, { status: 404 });

      const { error } = await supabase
        .from("admins")
        .update({ password_hash, admin_status: "active" })
        .eq("username", username.trim().toLowerCase());

      if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

      return NextResponse.json({ ok: true });
    }

    // ── create: create a new superadmin (only when all admins deleted) ────────
    if (action === "create") {
      const { username, password, first_name, last_name, nickname } = body;
      if (!username?.trim() || !password)
        return NextResponse.json({ ok: false, message: "กรุณาระบุ username และรหัสผ่าน" }, { status: 400 });
      if (password.length < 6)
        return NextResponse.json({ ok: false, message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim()))
        return NextResponse.json({ ok: false, message: "Username ต้องเป็น a-z, 0-9, _ ยาว 3-20 ตัว" }, { status: 400 });

      const password_hash = await bcrypt.hash(password, 12);
      const { error } = await supabase.from("admins").insert({
        admin_id: `ADM-${Date.now()}`,
        username: username.trim().toLowerCase(),
        password_hash,
        role: "superadmin",
        admin_status: "active",
        first_name: first_name?.trim() || null,
        last_name: last_name?.trim() || null,
        nickname: nickname?.trim() || null,
      });
      if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, message: "action ไม่ถูกต้อง" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
