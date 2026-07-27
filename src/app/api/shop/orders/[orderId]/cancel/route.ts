import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type OrderItem = { id: string; qty: number; name: string; price: number; color?: string };
type ColorStock = Record<string, number>;

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
  const qtyByProduct = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = (acc[item.id] ?? 0) + item.qty;
    return acc;
  }, {});
  const qtyByProductColor = items.reduce<Record<string, number>>((acc, item) => {
    if (!item.color) return acc;
    const key = `${item.id}::${item.color}`;
    acc[key] = (acc[key] ?? 0) + item.qty;
    return acc;
  }, {});
  for (const [productId, qty] of Object.entries(qtyByProduct)) {
    const { data: prod } = await supabase.from("products").select("stock, color_stock").eq("id", productId).single();
    if (prod) {
      const colorStock = (prod.color_stock && typeof prod.color_stock === "object" && !Array.isArray(prod.color_stock))
        ? { ...(prod.color_stock as ColorStock) }
        : null;
      if (colorStock) {
        for (const [key, colorQty] of Object.entries(qtyByProductColor)) {
          const [colorProductId, color] = key.split("::");
          if (colorProductId === productId && color in colorStock) {
            colorStock[color] = Number(colorStock[color] ?? 0) + colorQty;
          }
        }
      }
      const nextStock = colorStock
        ? Object.values(colorStock).reduce((sum, colorQty) => sum + Number(colorQty || 0), 0)
        : prod.stock + qty;
      const updatePayload = colorStock ? { stock: nextStock, color_stock: colorStock } : { stock: nextStock };
      await supabase.from("products").update(updatePayload).eq("id", productId);
    }
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
