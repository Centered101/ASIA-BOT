import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import bcrypt from "bcryptjs";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("admins") as any)
    .select("admin_id, username, role, first_name, last_name, nickname, email, phone, entry_year, department, avatar, admin_status, created_at, username_changed_at, linked_student_id")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const me = await getRequester(req);
  if (!me) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  if (me.role !== "superadmin")
    return NextResponse.json({ status: "error", message: "ต้องเป็น Superadmin เท่านั้น" }, { status: 403 });

  const { username, password, role, first_name, last_name, nickname, email, phone, entry_year, department, linked_student_id, avatar } = await req.json();

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("admins") as any).insert({
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
    avatar: avatar?.trim() || null,
    linked_student_id: linked_student_id?.trim() || null,
  });

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", admin_id: newId });
}
