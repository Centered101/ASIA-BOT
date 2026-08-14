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
  return cleanString(value).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_:-]/g, "");
}

export async function GET(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("line_notification_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data: data ?? [], can_manage: hasAdminRole(admin, ["superadmin"]) });
}

export async function POST(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });
  if (!hasAdminRole(admin, ["superadmin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const key = normalizeCategoryKey(body.key);
  const label = cleanString(body.label);
  if (!key) return NextResponse.json({ status: "error", message: "กรุณากรอก key หมวดหมู่" }, { status: 400 });
  if (!label) return NextResponse.json({ status: "error", message: "กรุณากรอกชื่อหมวดหมู่" }, { status: 400 });

  const { data, error } = await supabase
    .from("line_notification_categories")
    .insert({
      key,
      label,
      description: cleanString(body.description) || null,
      sort_order: Number(body.sort_order) || 0,
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
  const key = normalizeCategoryKey(body.key);
  if (!key) return NextResponse.json({ status: "error", message: "ไม่พบ key หมวดหมู่" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("new_key" in body) {
    const newKey = normalizeCategoryKey(body.new_key);
    if (!newKey) return NextResponse.json({ status: "error", message: "key ใหม่ไม่ถูกต้อง" }, { status: 400 });
    patch.key = newKey;
  }
  if ("label" in body) patch.label = cleanString(body.label);
  if ("description" in body) patch.description = cleanString(body.description) || null;
  if ("sort_order" in body) patch.sort_order = Number(body.sort_order) || 0;

  const { data, error } = await supabase
    .from("line_notification_categories")
    .update(patch)
    .eq("key", key)
    .select("*")
    .single();

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function DELETE(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });
  if (!hasAdminRole(admin, ["superadmin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });

  const key = normalizeCategoryKey(req.nextUrl.searchParams.get("key") || cleanString((await req.json().catch(() => ({}))).key));
  if (!key) return NextResponse.json({ status: "error", message: "ไม่พบ key หมวดหมู่" }, { status: 400 });

  const { count } = await supabase
    .from("line_notification_channels")
    .select("id", { count: "exact", head: true })
    .eq("category_key", key);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ status: "error", message: "ยังมีกลุ่ม LINE อยู่ในหมวดนี้ กรุณาย้ายหรือลบกลุ่มก่อน" }, { status: 400 });
  }

  const { error } = await supabase.from("line_notification_categories").delete().eq("key", key);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
