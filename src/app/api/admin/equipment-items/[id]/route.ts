import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    name?: string; category?: string; asset_code?: string | null; department?: string | null; unit?: string | null;
    total_quantity?: number; image_url?: string | null; description?: string | null;
    active?: boolean; deleted_at?: string | null;
  };

  const update: Partial<Database["public"]["Tables"]["equipment_items"]["Update"]> = {};
  if ("name"        in body) update.name        = body.name;
  if ("category"    in body) update.category     = body.category;
  if ("department"  in body) update.department   = body.department;
  if ("asset_code"  in body) update.asset_code   = body.asset_code;
  if ("unit"        in body) update.unit         = body.unit?.trim() || "";
  if ("image_url"   in body) update.image_url    = body.image_url;
  if ("description" in body) update.description  = body.description;
  if ("active"      in body) update.active       = body.active;
  if ("deleted_at"  in body) update.deleted_at   = body.deleted_at;

  if (body.total_quantity != null) {
    const { data: current, error: currentError } = await supabase
      .from("equipment_items")
      .select("total_quantity, available_quantity")
      .eq("id", id)
      .single();
    if (currentError) return NextResponse.json({ status: "error", message: currentError.message }, { status: 500 });

    const newTotal = Number(body.total_quantity);
    const delta = newTotal - current.total_quantity;
    update.total_quantity = newTotal;
    update.available_quantity = Math.max(0, current.available_quantity + delta);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ status: "error", message: "ไม่มีข้อมูลให้อัพเดท" }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from("equipment_items").update(update).eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase
    .from("equipment_items")
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
