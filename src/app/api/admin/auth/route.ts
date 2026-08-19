import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import bcrypt from "bcryptjs";
import { attachSessionCookie } from "@/lib/server/session";
import { checkAdminAuth } from "@/lib/admin-auth";

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

/**
 * role/ฝ่ายปัจจุบันของคนที่กำลังเรียก — ใช้ซิงก์ session ฝั่ง client
 *
 * session ใน localStorage เก็บ role ตอนล็อกอินไว้ 8 ชม. ถ้าระหว่างนั้นมีคน
 * เปลี่ยน role ในฐานข้อมูล หน้าเว็บจะยังโชว์เมนูและปุ่มตามสิทธิ์เก่า กดแล้ว
 * ได้ 403 ทุกครั้งโดยไม่มีอะไรอธิบาย — ฝั่ง server อ่าน admins.role สดเสมอ
 * จึงให้ client มาถามค่าจริงตอนเปิดหน้าแทนที่จะเชื่อของที่จำไว้
 */
export async function GET(req: NextRequest) {
  const session = await checkAdminAuth(req);
  if (!session) {
    return NextResponse.json({ ok: false, message: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  }

  // division เพิ่งเพิ่มใน 0019 ฐานที่ยังไม่ได้รัน migration จะไม่มีคอลัมน์นี้
  // ให้ถือว่าไม่ระบุฝ่ายแทนที่จะทำให้ทั้ง request พัง
  let division: string | null = null;
  try {
    const { data } = await supabase
      .from("admins")
      .select("division")
      .eq("admin_id", session.admin_id)
      .maybeSingle();
    division = (data as { division?: string | null } | null)?.division ?? null;
  } catch { /* ยังไม่มีคอลัมน์ ถือว่าไม่ระบุฝ่าย */ }

  return NextResponse.json({
    ok: true,
    admin: { admin_id: session.admin_id, role: session.role, division },
  });
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
    // ใช้ * แทนการไล่ชื่อคอลัมน์ เพราะ division เพิ่งเพิ่มใน 0019 และ RUNBOOK
    // ให้ deploy โค้ดก่อนรัน migration — ถ้าระบุชื่อคอลัมน์ที่ยังไม่มี query จะ error
    // แล้วล็อกอินหลังบ้านพังทั้งระบบ ส่วน * จะได้เท่าที่ฐานมีจริง
    // ค่าที่ตอบกลับประกอบทีละฟิลด์อยู่แล้ว คอลัมน์ที่เกินมาจึงไม่หลุดออกไป
    .select("*")
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
    const res = NextResponse.json({
      ok: true,
      admin: {
        admin_id: admin.admin_id, username: admin.username, role: admin.role,
        first_name: admin.first_name, last_name: admin.last_name, nickname: admin.nickname,
        avatar: admin.avatar ?? null,
        email: (admin as Record<string, unknown>).email ?? null,
        phone: (admin as Record<string, unknown>).phone ?? null,
        entry_year: (admin as Record<string, unknown>).entry_year ?? null,
        department: (admin as Record<string, unknown>).department ?? null,
        // ฝ่ายที่สังกัด — เมนูหลังบ้านใช้ค่านี้กรองว่าจะโชว์งานของฝ่ายไหน
        division: (admin as Record<string, unknown>).division ?? null,
        created_at:   (admin as Record<string, unknown>).created_at   ?? null,
        google_email: (admin as Record<string, unknown>).google_email ?? null,
      },
    });
    // Phase 1: also hand out a signed httpOnly session cookie. No-ops until the
    // migrations have run, so the existing localStorage flow is unaffected.
    await attachSessionCookie(res, req, "admin", admin.admin_id);
    return res;
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
        // superadmin ทำงานข้ามฝ่ายอยู่แล้ว ค่านี้จึงไม่มีผลกับ fallback
        division: null,
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
