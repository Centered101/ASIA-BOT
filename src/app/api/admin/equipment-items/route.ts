import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { data, error } = await supabase
    .from("equipment_items")
    .select("id, asset_code, name, category, department, unit, total_quantity, available_quantity, image_url, description, active, deleted_at, created_at")
    .order("category")
    .order("name");

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function POST(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const body = await req.json() as {
    name: string; category: string; asset_code?: string | null; department?: string | null; unit?: string | null;
    total_quantity?: number; image_url?: string | null; description?: string | null; active?: boolean;
  };
  const { name, category, asset_code, department, unit, total_quantity, image_url, description, active } = body;
  if (!name?.trim() || !category?.trim()) {
    return NextResponse.json({ status: "error", message: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const qty = total_quantity != null ? Number(total_quantity) : 1;
  const { data, error } = await supabase
    .from("equipment_items")
    .insert({
      name: name.trim(),
      category: category.trim(),
      department: department?.trim() || null,
      asset_code: asset_code?.trim() || null,
      unit: unit?.trim() || "ชิ้น",
      total_quantity: qty,
      available_quantity: qty,
      image_url: image_url ?? null,
      description: description?.trim() || null,
      active: active ?? true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", id: data.id });
}
