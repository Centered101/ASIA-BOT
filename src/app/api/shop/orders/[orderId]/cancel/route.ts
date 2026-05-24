import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type OrderItem = { id: string; qty: number; name: string; price: number };

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const { data: order, error } = await supabase
    .from("orders")
    .select("order_id, student_id, total, pi_id, status, items_json")
    .eq("order_id", orderId)
    .single();

  if (error || !order) return NextResponse.json({ status: "error", message: "ไม่พบออเดอร์" }, { status: 404 });
  if (order.status !== "pending") return NextResponse.json({ status: "success", order_id: orderId });

  // Restore stock
  const items = (order.items_json as unknown as OrderItem[]) ?? [];
  for (const item of items) {
    const { data: prod } = await supabase.from("products").select("stock").eq("id", item.id).single();
    if (prod) await supabase.from("products").update({ stock: prod.stock + item.qty }).eq("id", item.id);
  }

  await supabase.from("orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("order_id", orderId);
  await supabase.from("pay_logs").insert({
    order_id: orderId,
    student_id: order.student_id,
    total: order.total,
    pi_id: order.pi_id,
    status: "cancelled",
    note: "ยกเลิกโดยนักเรียน / หมดเวลา",
  });

  return NextResponse.json({ status: "success", order_id: orderId });
}
