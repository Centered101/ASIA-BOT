import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Database } from "@/types/database";
import { sendLineMessage } from "@/lib/line";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const { data: order, error } = await supabase
    .from("orders")
    .select("order_id, pi_id, status, student_id, student_name, total, items_json, delivery_mode, delivery_loc, delivery_slot")
    .eq("order_id", orderId)
    .single();

  if (error || !order) {
    return NextResponse.json({ status: "error", message: "ไม่พบออเดอร์" }, { status: 404 });
  }

  // Already resolved
  if (order.status === "paid")      return NextResponse.json({ status: "success", payment_status: "paid",      order_id: orderId });
  if (order.status === "cancelled") return NextResponse.json({ status: "success", payment_status: "cancelled", order_id: orderId });

  if (!order.pi_id) return NextResponse.json({ status: "success", payment_status: "pending", order_id: orderId });

  // Poll Stripe
  let stripeStatus: string;
  try {
    const pi = await stripe.paymentIntents.retrieve(order.pi_id);
    stripeStatus = pi.status;
  } catch {
    return NextResponse.json({ status: "success", payment_status: "pending", order_id: orderId });
  }

  if (stripeStatus === "succeeded") {
    await supabase.from("orders").update({ status: "paid", updated_at: new Date().toISOString() }).eq("order_id", orderId);
    await supabase.from("pay_logs").insert({
      order_id: orderId,
      student_id: order.student_id,
      total: order.total,
      pi_id: order.pi_id,
      stripe_status: "succeeded",
      status: "paid",
      note: "Stripe ยืนยันชำระแล้ว",
    });
    const deliveryNote = order.delivery_mode === "delivery"
      ? `\n🚚 จัดส่ง: ${order.delivery_loc ?? ""} ช่วง ${order.delivery_slot ?? ""}`
      : "\n🏪 รับเองที่สหกรณ์";
    await sendLineMessage(
      process.env.LINE_GROUP_SHOP ?? "",
      `🛍️ ออเดอร์ใหม่ชำระแล้ว!\n` +
      `👤 ${order.student_name} (${order.student_id})\n` +
      `💰 ฿${order.total.toFixed(2)}${deliveryNote}\n` +
      `🔖 #${orderId.slice(-8).toUpperCase()}`
    );
    return NextResponse.json({ status: "success", payment_status: "paid", order_id: orderId });
  }

  if (stripeStatus === "canceled" || stripeStatus === "payment_failed") {
    await supabase.from("orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("order_id", orderId);
    return NextResponse.json({ status: "success", payment_status: "cancelled", order_id: orderId });
  }

  return NextResponse.json({ status: "success", payment_status: "pending", order_id: orderId });
}
