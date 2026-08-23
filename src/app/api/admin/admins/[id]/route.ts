import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import bcrypt from "bcryptjs";
import { ADMIN_DIVISIONS } from "@/lib/modules/nav";
import { canHaveDivision } from "@/lib/modules/nav-access";
import { LEGACY_ADMIN_ROLE_MAP } from "@/lib/rbac/definitions";

/**
 * เปลี่ยน admins.role แล้วต้องย้าย user_roles ตามด้วย
 *
 * ระบบมีสองชั้นที่ต่างคนต่างอ่าน: route เก่าใช้ hasAdminRole() อ่าน admins.role
 * ส่วน route ที่ย้ายมาใช้ withAuth({permission}) อ่าน user_roles ผ่าน
 * resolvePrincipal ถ้าอัปเดตแค่ชั้นแรก คนที่เพิ่งถูกเลื่อนเป็น admin จะเห็นเมนู
 * ครบแต่กดแล้วได้ 403 จาก API ชุดใหม่ เพราะ user_roles ยังเป็นของเดิม
 *
 * ลบเฉพาะ role ที่มาจากการ map ของฝั่ง admin (SUPER_ADMIN/ADMIN/ACADEMIC)
 * แถวอื่นเช่น STUDENT ของคนที่เป็นทั้งนักเรียนและเจ้าหน้าที่ต้องอยู่ต่อ
 */
const LEGACY_ROLE_KEYS = [...new Set(Object.values(LEGACY_ADMIN_ROLE_MAP))];

async function syncUserRole(adminId: string, newRole: string): Promise<void> {
  const mapped = LEGACY_ADMIN_ROLE_MAP[newRole];
  if (!mapped) return;
  try {
    const { data: admin } = await supabase
      .from("admins").select("account_id").eq("admin_id", adminId).maybeSingle();
    const accountId = (admin as { account_id?: string | null } | null)?.account_id;
    if (!accountId) return; // ยังไม่ได้ผูกบัญชีกลาง ชั้น RBAC จะ fallback ไป admins.role เอง

    await supabase.from("user_roles").delete()
      .eq("account_id", accountId).in("role_key", LEGACY_ROLE_KEYS).is("scope_type", null);
    await supabase.from("user_roles").insert({ account_id: accountId, role_key: mapped });
  } catch {
    // ฐานที่ยังไม่ได้รัน 0003_rbac ไม่มีตาราง user_roles — ชั้นเก่ายังทำงานได้ปกติ
  }
}

/** ต้องตรงกับ CHECK ใน 0019_admin_division.sql — ค่าที่ไม่รู้จักถือว่าไม่ระบุฝ่าย */
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
  // division ไม่อยู่ในชุดนี้ เพราะเป็นเรื่องสิทธิ์ไม่ใช่ข้อมูลส่วนตัว ดูด้านล่าง
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
  // ฝ่ายเปลี่ยนได้เฉพาะ superadmin ไม่งั้นใครก็ย้ายตัวเองไปฝ่ายที่อยากเห็นเมนูได้
  // คนอื่นส่งมาก็เมินเฉย ๆ ไม่ตอบ 403 เพราะหน้าแก้โปรไฟล์ส่งทุกฟิลด์มาพร้อมกัน
  // การตีกลับทั้งก้อนจะทำให้แก้ชื่อตัวเองไม่ได้ไปด้วย
  //
  // สภานักเรียนไม่สังกัดฝ่าย (ดู canHaveDivision) role ที่ใช้ตัดสินคือค่าใหม่ถ้า
  // กำลังเปลี่ยนยศอยู่ ไม่งั้นอ่านค่าปัจจุบันจากฐาน — และการลดยศลงมาเป็น staff
  // ต้องล้างฝ่ายเดิมทิ้งด้วย ไม่งั้นค่าจะค้างอยู่ในแถวโดยไม่มีทางแก้ผ่านหน้าจอ
  if (("division" in body && isSuperAdmin) || patch.role === "staff") {
    const effectiveRole =
      "role" in patch
        ? String(patch.role)
        : (await supabase.from("admins").select("role").eq("admin_id", id).maybeSingle()).data?.role ?? "staff";

    if (!canHaveDivision(effectiveRole)) patch.division = null;
    else if ("division" in body && isSuperAdmin) patch.division = cleanDivision(body.division);
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ status: "error", message: "ไม่มีข้อมูลที่จะแก้ไข" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const save = (p: Record<string, any>) => (supabase.from("admins") as any).update(p).eq("admin_id", id);
  let { error } = await save(patch);
  // ฐานที่ยังไม่ได้รัน 0019 ยังแก้โปรไฟล์ได้ แค่ตั้งฝ่ายไม่ได้
  if (error && "division" in patch && /division/i.test(error.message ?? "")) {
    const { division: _skip, ...withoutDivision } = patch;
    void _skip;
    ({ error } = await save(withoutDivision));
  }
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  // ย้าย role ในชั้น RBAC ตามด้วย ไม่งั้นสองชั้นจะไม่ตรงกัน (ดูหัวไฟล์)
  if ("role" in patch) await syncUserRole(id, patch.role as string);

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
