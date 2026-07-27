import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("products")
    .select("id, tag, stock, name, price, images, unit, category, colors, color_stock")
    .eq("active", true)
    .is("deleted_at", null)
    .order("name");

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  return NextResponse.json({ status: "success", data });
}
