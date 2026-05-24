import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as { status?: string };
  const allowed = ["pending", "paid", "cancelled", "refunded", "delivered"];
  if (!body.status || !allowed.includes(body.status)) {
    return NextResponse.json({ status: "error", message: "สถานะไม่ถูกต้อง" }, { status: 400 });
  }
  const { error } = await supabase.from("orders")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ status: body.status as any, updated_at: new Date().toISOString() })
    .eq("order_id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
