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
    .select("admin_id, role, admin_status, password_hash")
    .eq("admin_id", id)
    .single();
  if (!data || data.admin_status !== "active") return null;
  return data;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getRequester(req);
  if (!me) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const isSelf = me.admin_id === id;
  const isSuperAdmin = me.role === "superadmin";

  // role change — superadmin only, not on self, requires confirm_password
  if ("role" in body) {
    if (!isSuperAdmin || isSelf)
      return NextResponse.json({ status: "error", message: "ต้องเป็น Superadmin และไม่สามารถแก้ role ตัวเองได้" }, { status: 403 });
    if (!body.confirm_password)
      return NextResponse.json({ status: "error", message: "กรุณายืนยันรหัสผ่านเพื่อเปลี่ยน Role" }, { status: 400 });
    const valid = await bcrypt.compare(body.confirm_password, me.password_hash ?? "");
    if (!valid)
      return NextResponse.json({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  // admin_status — superadmin only, not on self
  if ("admin_status" in body && (!isSuperAdmin || isSelf))
    return NextResponse.json({ status: "error", message: "ต้องเป็น Superadmin และไม่สามารถแก้ไขตัวเองได้" }, { status: 403 });
  // avatar — self or superadmin
  if ("avatar" in body && !isSelf && !isSuperAdmin)
    return NextResponse.json({ status: "error", message: "ไม่มีสิทธิ์" }, { status: 403 });

  // username change — self only, 1x per 7 days
  if ("username" in body) {
    if (!isSelf && !isSuperAdmin)
      return NextResponse.json({ status: "error", message: "ไม่มีสิทธิ์เปลี่ยน username" }, { status: 403 });
    const newUsername = body.username?.trim().toLowerCase();
    if (!newUsername || !/^[a-zA-Z0-9_]{3,20}$/.test(newUsername))
      return NextResponse.json({ status: "error", message: "Username: a-z, 0-9, _ ยาว 3-20 ตัว" }, { status: 400 });

    // Check rate limit from DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: current } = await (supabase.from("admins") as any).select("username_changed_at").eq("admin_id", id).single();
    if (current?.username_changed_at) {
      const daysSince = (Date.now() - new Date(current.username_changed_at).getTime()) / 86400000;
      if (daysSince < 7)
        return NextResponse.json({ status: "error", message: `เปลี่ยน username ได้อีกใน ${Math.ceil(7 - daysSince)} วัน` }, { status: 429 });
    }

    const { data: existing } = await supabase.from("admins").select("admin_id").eq("username", newUsername).single();
    if (existing && existing.admin_id !== id)
      return NextResponse.json({ status: "error", message: "Username นี้มีอยู่แล้ว" }, { status: 409 });
  }

  // password change — self or superadmin
  if ("new_password" in body) {
    if (!isSelf && !isSuperAdmin)
      return NextResponse.json({ status: "error", message: "ไม่มีสิทธิ์เปลี่ยนรหัสผ่าน" }, { status: 403 });
    if (!body.new_password || body.new_password.length < 6)
      return NextResponse.json({ status: "error", message: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }

  // profile fields — self or superadmin
  const profileKeys = ["first_name", "last_name", "nickname", "email", "phone", "entry_year", "department", "linked_student_id"];
  if (profileKeys.some(k => k in body) && !isSelf && !isSuperAdmin)
    return NextResponse.json({ status: "error", message: "ไม่มีสิทธิ์" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  if ("role" in body) patch.role = body.role;
  if ("admin_status" in body) patch.admin_status = body.admin_status;
  if ("avatar" in body) patch.avatar = body.avatar ?? null;
  if ("username" in body) {
    patch.username = body.username.trim().toLowerCase();
    patch.username_changed_at = new Date().toISOString();
  }
  if ("new_password" in body) {
    patch.password_hash = await bcrypt.hash(body.new_password, 12);
  }
  for (const k of profileKeys) {
    if (k in body) patch[k] = body[k]?.trim?.() || body[k] || null;
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ status: "error", message: "ไม่มีข้อมูลที่จะแก้ไข" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("admins").update(patch as any).eq("admin_id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getRequester(req);
  if (!me) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  if (me.role !== "superadmin")
    return NextResponse.json({ status: "error", message: "ต้องเป็น Superadmin" }, { status: 403 });
  if (me.admin_id === id)
    return NextResponse.json({ status: "error", message: "ไม่สามารถลบตัวเองได้" }, { status: 400 });

  const { error } = await supabase.from("admins").delete().eq("admin_id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
