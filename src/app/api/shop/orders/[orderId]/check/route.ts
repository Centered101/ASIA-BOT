import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Database } from "@/types/database";
import { sendLineFlexMessage, buildOrderFlexMessage } from "@/lib/line";

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

  console.log(`[CHECK] orderId=${orderId} stripeStatus=${stripeStatus}`);
  if (stripeStatus === "succeeded") {
    // อัพเดตเฉพาะตอนที่ยังเป็น pending เพื่อป้องกัน race condition (poll หลายรอบส่ง LINE ซ้ำ)
    const { data: updated } = await supabase
      .from("orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .eq("status", "pending")
      .select("order_id");
    if (!updated?.length) {
      return NextResponse.json({ status: "success", payment_status: "paid", order_id: orderId });
    }
    await supabase.from("pay_logs").insert({
      order_id: orderId,
      student_id: order.student_id,
      total: order.total,
      pi_id: order.pi_id,
      stripe_status: "succeeded",
      status: "paid",
      note: "Stripe ยืนยันชำระแล้ว",
    });
    // ── Fetch shared data ─────────────────────────────────────────────
    const items = (order.items_json as { id: string; name: string; price: number; qty: number; unit: string }[]) ?? [];
    const [studentRow, productsRow] = await Promise.all([
      (supabase as any).from("students").select("line_user_id, photo_url").eq("student_id", order.student_id).maybeSingle(),
      supabase.from("products").select("id, images").in("id", items.map(i => i.id)),
    ]);
    const studentData = studentRow.data as { line_user_id?: string | null; photo_url?: string | null } | null;
    const imageMap = Object.fromEntries(
      ((productsRow.data ?? []) as { id: string; images: string[] | null }[])
        .map(p => [p.id, p.images?.[0] ?? null])
    );
    const flexItems = items.map(i => ({ ...i, imageUrl: imageMap[i.id] }));
    const flexAltText = `✅ ชำระแล้ว #${orderId.slice(-8).toUpperCase()} — ${order.student_name} — ฿${Number(order.total).toFixed(2)}`;
    const sharedParams = {
      orderId,
      studentName: order.student_name,
      items: flexItems,
      total: Number(order.total),
      deliveryMode: order.delivery_mode ?? "pickup",
      deliveryLoc: order.delivery_loc,
      deliverySlot: order.delivery_slot,
      status: "paid" as const,
    };
    const flexContents = buildOrderFlexMessage({
      ...sharedParams,
      studentId: order.student_id,
      studentPhotoUrl: studentData?.photo_url,
    });

    // ── Notify admin group (Flex) ─────────────────────────────────────
    await sendLineFlexMessage(process.env.LINE_GROUP_ADMIN ?? "", flexAltText, flexContents);

    // ── Notify student (Flex) ─────────────────────────────────────────
    if (studentData?.line_user_id) {
      await sendLineFlexMessage(
        studentData.line_user_id,
        `✅ ยืนยันคำสั่งซื้อ #${orderId.slice(-8).toUpperCase()} — ฿${Number(order.total).toFixed(2)}`,
        buildOrderFlexMessage({ ...sharedParams, studentPhotoUrl: studentData.photo_url })
      );
    }

    return NextResponse.json({ status: "success", payment_status: "paid", order_id: orderId });
  }

  // requires_payment_method = PromptPay QR หมดเวลา (ไม่มีคนสแกน)
  if (stripeStatus === "canceled" || stripeStatus === "payment_failed" || stripeStatus === "requires_payment_method") {
    const { data: cancelUpdated } = await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .eq("status", "pending")
      .select("order_id");
    if (cancelUpdated?.length) {
      const reason = stripeStatus === "requires_payment_method" ? "QR หมดเวลา" : "ยกเลิก/ชำระไม่สำเร็จ";
      await sendLineFlexMessage(
        process.env.LINE_GROUP_ADMIN ?? "",
        `❌ ออเดอร์ถูกยกเลิก #${orderId.slice(-8).toUpperCase()} — ${order.student_name}`,
        buildOrderFlexMessage({
          orderId,
          studentName: `${order.student_name} (${reason})`,
          studentId: order.student_id,
          items: [],
          total: Number(order.total),
          deliveryMode: order.delivery_mode ?? "pickup",
          deliveryLoc: order.delivery_loc,
          deliverySlot: order.delivery_slot,
          status: "cancelled",
        })
      );
    }
    return NextResponse.json({ status: "success", payment_status: "cancelled", order_id: orderId });
  }

  return NextResponse.json({ status: "success", payment_status: "pending", order_id: orderId });
}
