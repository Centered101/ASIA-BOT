import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import bcrypt from "bcryptjs";
import { ADMIN_DIVISIONS } from "@/lib/modules/nav";

/**
 * ฝ่ายที่รับได้ต้องตรงกับ CHECK ใน 0019_admin_division.sql
 * ค่าที่ไม่รู้จักเก็บเป็น null ดีกว่าปล่อยให้ DB โยน 23514 กลับมาเป็น error ดิบ
 */
function cleanDivision(value: unknown): string | null {
  const v = typeof value === "string" ? value.trim() : "";
  return (ADMIN_DIVISIONS as string[]).includes(v) ? v : null;
}

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getRequester(req: NextRequest) {
  const id = req.headers.get("x-admin-id");
  if (!id) return null;
  const { data } = await supabase
    .from("admins")
    .select("admin_id, role, admin_status")
    .eq("admin_id", id)
    .single();
  if (!data || data.admin_status !== "active") return null;
  return data;
}

export async function GET(req: NextRequest) {
  const me = await getRequester(req);
  if (!me) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  // ที่นี่ระบุชื่อคอลัมน์แทน * เพราะต้องกัน password_hash ไม่ให้หลุดออกไป
  // แต่ division เพิ่งเพิ่มใน 0019 และ RUNBOOK ให้ deploy โค้ดก่อนรัน migration
  // จึงลองแบบมี division ก่อน ถ้าฐานยังไม่มีคอลัมน์ค่อยถอยไปชุดเดิม
  const BASE_COLS = "admin_id, username, role, first_name, last_name, nickname, email, phone, entry_year, department, avatar, admin_status, created_at, username_changed_at, linked_student_id";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (cols: string) => (supabase.from("admins") as any).select(cols).order("created_at", { ascending: true });

  let { data, error } = await list(`${BASE_COLS}, division`);
  if (error && /division/i.test(error.message ?? "")) {
    ({ data, error } = await list(BASE_COLS));
  }

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const me = await getRequester(req);
  if (!me) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  if (me.role !== "superadmin")
    return NextResponse.json({ status: "error", message: "ต้องเป็น Superadmin เท่านั้น" }, { status: 403 });

  const { username, password, role, first_name, last_name, nickname, email, phone, entry_year, department, division, linked_student_id, avatar } = await req.json();

  if (!username?.trim() || !password)
    return NextResponse.json({ status: "error", message: "กรุณากรอก username และรหัสผ่าน" }, { status: 400 });
  if (password.length < 6)
    return NextResponse.json({ status: "error", message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim()))
    return NextResponse.json({ status: "error", message: "Username: a-z, 0-9, _ ยาว 3-20 ตัว" }, { status: 400 });

  const { data: existing } = await supabase
    .from("admins").select("admin_id").eq("username", username.trim().toLowerCase()).single();
  if (existing)
    return NextResponse.json({ status: "error", message: "Username นี้มีอยู่แล้ว" }, { status: 409 });

  const password_hash = await bcrypt.hash(password, 12);
  const newId = `ADM-${Date.now()}`;
  const row = {
    admin_id: newId,
    username: username.trim().toLowerCase(),
    password_hash,
    role: role ?? "staff",
    admin_status: "active",
    first_name: first_name?.trim() || null,
    last_name: last_name?.trim() || null,
    nickname: nickname?.trim() || null,
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    entry_year: entry_year?.trim() || null,
    department: department?.trim() || null,
    division: cleanDivision(division),
    avatar: avatar?.trim() || null,
    linked_student_id: linked_student_id?.trim() || null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insert = (r: Record<string, unknown>) => (supabase.from("admins") as any).insert(r);
  let { error } = await insert(row);
  // ฐานที่ยังไม่ได้รัน 0019 ยังเพิ่มผู้ดูแลได้ แค่ไม่ได้ฝ่ายติดไปด้วย
  if (error && /division/i.test(error.message ?? "")) {
    const { division: _skip, ...withoutDivision } = row;
    void _skip;
    ({ error } = await insert(withoutDivision));
  }

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", admin_id: newId });
}
