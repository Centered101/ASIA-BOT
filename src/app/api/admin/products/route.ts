import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("products")
    .select("id, tag, stock, name, price, cost, images, unit, category, active, deleted_at, created_at")
    .order("name");
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string; price: number; cost?: number | null; stock?: number;
    unit?: string | null; category?: string | null; tag?: string | null;
    images?: string[] | null; active?: boolean;
  };
  const { name, price, cost, stock, unit, category, tag, images, active } = body;
  if (!name || price == null) {
    return NextResponse.json({ status: "error", message: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      name, price,
      cost: cost ?? null,
      stock: stock ?? 0,
      unit: unit ?? null,
      category: category ?? null,
      tag: tag ?? null,
      images: images ?? null,
      active: active ?? true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", id: data.id });
}
