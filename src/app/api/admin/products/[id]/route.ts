import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as {
    name?: string; price?: number; cost?: number | null; stock?: number;
    unit?: string | null; category?: string | null; tag?: string | null;
    images?: string[] | null; colors?: string[] | null; color_stock?: Record<string, number> | null; active?: boolean; deleted_at?: string | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  if ("name"       in body) update.name       = body.name;
  if ("price"      in body) update.price      = body.price;
  if ("cost"       in body) update.cost       = body.cost;
  if ("stock"      in body) update.stock      = body.stock;
  if ("unit"       in body) update.unit       = body.unit;
  if ("category"   in body) update.category   = body.category;
  if ("tag"        in body) update.tag        = body.tag;
  if ("images"     in body) update.images     = body.images;
  if ("colors"     in body) update.colors     = body.colors?.length ? body.colors : null;
  if ("color_stock" in body) update.color_stock = body.color_stock && Object.keys(body.color_stock).length ? body.color_stock : null;
  if ("active"     in body) update.active     = body.active;
  if ("deleted_at" in body) update.deleted_at = body.deleted_at;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ status: "error", message: "ไม่มีข้อมูลให้อัพเดท" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("products") as any).update(update).eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("products") as any)
    .update({ active: false, stock: 0, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
