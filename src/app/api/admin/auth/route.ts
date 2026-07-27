import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import bcrypt from "bcryptjs";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function log(data: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  try { await (supabase.from("admin_logs") as any).insert(data); } catch { /* silent */ }
}

const FALLBACK_ADMIN_ID = "__env_superadmin__";

function isFallbackAdminLogin(username: string, password: string) {
  const fallbackUsername = process.env.ADMIN_FALLBACK_USERNAME;
  const fallbackPassword = process.env.ADMIN_FALLBACK_PASSWORD;
  return !!fallbackUsername && !!fallbackPassword && username === fallbackUsername && password === fallbackPassword;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { username, password, platform, language, screen, timezone, referrer, page_url, touch_device } = body;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
  const user_agent = req.headers.get("user-agent") ?? null;

  const logBase = {
    admin_id_attempt: username ?? null,
    ip_address: ip, user_agent,
    platform: platform ?? null, language: language ?? null,
    screen: screen ?? null, timezone: timezone ?? null,
    referrer: referrer ?? null, page_url: page_url ?? null,
    touch_device: touch_device ?? null,
  };

  if (!username || !password) {
    return NextResponse.json({ ok: false, message: "กรุณากรอก username และรหัสผ่าน" }, { status: 400 });
  }

  // ── Try DB admin lookup ──────────────────────────────────────────────────
  const { data: admin, error: dbError } = await supabase
    .from("admins")
    .select("id, admin_id, username, password_hash, role, first_name, last_name, nickname, email, phone, entry_year, department, avatar, admin_status, google_email, created_at")
    .eq("username", username)
    .single();

  if (!dbError && admin) {
    if (admin.admin_status !== "active") {
      await supabase.from("admin_logs").insert({ ...logBase, status: "failed", reason: "account_inactive" });
      return NextResponse.json({ ok: false, message: "บัญชีนี้ถูกปิดการใช้งาน" }, { status: 403 });
    }
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      await supabase.from("admin_logs").insert({ ...logBase, status: "failed", reason: "wrong_password" });
      return NextResponse.json({ ok: false, message: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }
    await supabase.from("admin_logs").insert({ ...logBase, status: "success" });
    return NextResponse.json({
      ok: true,
      admin: {
        admin_id: admin.admin_id, username: admin.username, role: admin.role,
        first_name: admin.first_name, last_name: admin.last_name, nickname: admin.nickname,
        avatar: admin.avatar ?? null,
        email: (admin as Record<string, unknown>).email ?? null,
        phone: (admin as Record<string, unknown>).phone ?? null,
        entry_year: (admin as Record<string, unknown>).entry_year ?? null,
        department: (admin as Record<string, unknown>).department ?? null,
        created_at:   (admin as Record<string, unknown>).created_at   ?? null,
        google_email: (admin as Record<string, unknown>).google_email ?? null,
      },
    });
  }

  // ── Fallback: ADMIN_PASSWORD env var (when admins table is empty / not yet seeded) ──
  if (isFallbackAdminLogin(username, password)) {
    void log({ ...logBase, status: "success", reason: "env_fallback" });
    return NextResponse.json({
      ok: true,
      admin: {
        admin_id: FALLBACK_ADMIN_ID,
        username,
        role: "superadmin",
        first_name: "Super Admin",
        last_name: null,
        nickname: "ผู้ดูแลสูงสุด",
        avatar: null,
        email: null,
        phone: null,
        entry_year: null,
        department: null,
        created_at: null,
        google_email: null,
      },
    });
  }

  // Legacy fallback: ADMIN_PASSWORD env var (when admins table is empty / not yet seeded)
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && username === "admin" && password === envPassword) {
    void log({ ...logBase, status: "success", reason: "env_fallback" });
    return NextResponse.json({
      ok: true,
      admin: { admin_id: envPassword, username: "admin", role: "superadmin", first_name: "Admin", last_name: null, nickname: null },
    });
  }

  void log({ ...logBase, status: "failed", reason: "user_not_found" });
  return NextResponse.json({ ok: false, message: "ไม่พบบัญชีผู้ใช้นี้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
}
