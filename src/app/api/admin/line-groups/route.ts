import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategoryKey(value: unknown) {
  return cleanString(value).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_:-]/g, "") || "admin";
}

async function unsetDefaultForCategory(categoryKey: string, exceptId?: string) {
  let query = (supabase as any)
    .from("line_notification_channels")
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .eq("category_key", categoryKey);

  if (exceptId) query = query.neq("id", exceptId);
  await query;
}

export async function GET(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });

  const category = req.nextUrl.searchParams.get("category");
  const [channelsRes, categoriesRes] = await Promise.all([
    (supabase as any)
      .from("line_notification_channels")
      .select("*")
      .order("category_key", { ascending: true })
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("line_notification_categories")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  let data = channelsRes.data ?? [];
  if (category) {
    data = data.filter((row: { category_key?: string }) => row.category_key === category);
  }

  if (channelsRes.error) return NextResponse.json({ status: "error", message: channelsRes.error.message }, { status: 500 });
  if (categoriesRes.error) return NextResponse.json({ status: "error", message: categoriesRes.error.message }, { status: 500 });

  return NextResponse.json({
    status: "success",
    data,
    categories: categoriesRes.data ?? [],
    can_manage: hasAdminRole(admin, ["superadmin"]),
    env_fallback: {
      admin: process.env.LINE_GROUP_ADMIN || null,
      attendance: process.env.LINE_GROUP_ATTEND || null,
    },
  });
}

export async function POST(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });
  if (!hasAdminRole(admin, ["superadmin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const group_id = cleanString(body.group_id);
  const name = cleanString(body.name);
  const category_key = normalizeCategoryKey(body.category_key);
  const is_default = Boolean(body.is_default);

  if (!group_id) return NextResponse.json({ status: "error", message: "กรุณากรอก LINE group ID" }, { status: 400 });
  if (!name) return NextResponse.json({ status: "error", message: "กรุณากรอกชื่อกลุ่ม" }, { status: 400 });

  if (is_default) await unsetDefaultForCategory(category_key);

  const { data, error } = await (supabase as any)
    .from("line_notification_channels")
    .insert({
      group_id,
      name,
      category_key,
      is_active: body.is_active !== false,
      is_default,
      notes: cleanString(body.notes) || null,
      created_by: admin.admin_id,
      updated_by: admin.admin_id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function PATCH(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });
  if (!hasAdminRole(admin, ["superadmin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = cleanString(body.id);
  if (!id) return NextResponse.json({ status: "error", message: "ไม่พบรายการกลุ่ม" }, { status: 400 });

  const patch: Record<string, unknown> = {
    updated_by: admin.admin_id,
    updated_at: new Date().toISOString(),
  };

  if ("name" in body) patch.name = cleanString(body.name);
  if ("group_id" in body) patch.group_id = cleanString(body.group_id);
  if ("category_key" in body) patch.category_key = normalizeCategoryKey(body.category_key);
  if ("is_active" in body) patch.is_active = Boolean(body.is_active);
  if ("is_default" in body) patch.is_default = Boolean(body.is_default);
  if ("notes" in body) patch.notes = cleanString(body.notes) || null;

  const defaultCategory = (patch.category_key as string | undefined) ?? normalizeCategoryKey(body.current_category_key);
  if (patch.is_default === true) await unsetDefaultForCategory(defaultCategory, id);

  const { data, error } = await (supabase as any)
    .from("line_notification_channels")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function DELETE(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });
  if (!hasAdminRole(admin, ["superadmin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id") || cleanString((await req.json().catch(() => ({}))).id);
  if (!id) return NextResponse.json({ status: "error", message: "ไม่พบรายการกลุ่ม" }, { status: 400 });

  const { error } = await (supabase as any).from("line_notification_channels").delete().eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
