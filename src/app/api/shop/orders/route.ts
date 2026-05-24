import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type OrderItem = { id: string; name: string; price: number; qty: number; unit: string };

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    student_id: string;
    student_name: string;
    items: OrderItem[];
    total: number;
    delivery_mode: "pickup" | "delivery";
    delivery_loc: string;
    delivery_slot: string;
  };

  const { student_id, student_name, items, total, delivery_mode, delivery_loc, delivery_slot } = body;
  if (!student_id || !items?.length || !total) {
    return NextResponse.json({ status: "error", message: "ข้อมูลไม่ครบ" }, { status: 400 });
  }

  // ── Check & deduct stock ───────────────────────────────────────────
  for (const item of items) {
    const { data: prod, error } = await supabase
      .from("products")
      .select("id, name, stock")
      .eq("id", item.id)
      .single();
    if (error || !prod) {
      return NextResponse.json({ status: "error", message: `ไม่พบสินค้า: ${item.name}` }, { status: 400 });
    }
    if (prod.stock < item.qty) {
      return NextResponse.json({ status: "error", message: `สต็อก "${prod.name}" ไม่พอ (เหลือ ${prod.stock})` }, { status: 400 });
    }
  }
  for (const item of items) {
    const { data: prod } = await supabase.from("products").select("stock").eq("id", item.id).single();
    await supabase.from("products").update({ stock: (prod?.stock ?? item.qty) - item.qty }).eq("id", item.id);
  }

  // ── Stripe PromptPay ──────────────────────────────────────────────
  let pi_id = "";
  let qr_url = "";
  try {
    const satang = Math.round(total * 100);
    const pi = await stripe.paymentIntents.create({
      amount: satang,
      currency: "thb",
      payment_method_types: ["promptpay"],
      description: `${student_name} | ${student_id}`,
      metadata: { student: student_name, student_id },
    });
    const confirmed = await stripe.paymentIntents.confirm(pi.id, {
      payment_method_data: {
        type: "promptpay",
        billing_details: {
          email: `${student_id}@asia-lb.ac.th`,
          name: student_name,
        },
      },
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-lb.web.app"}/shop/`,
    });
    pi_id = confirmed.id;
    const nextAction = confirmed.next_action as { promptpay_display_qr_code?: { image_url_png?: string } } | null;
    qr_url = nextAction?.promptpay_display_qr_code?.image_url_png ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ status: "error", message: `Stripe: ${msg}` }, { status: 500 });
  }

  // ── Insert order ───────────────────────────────────────────────────
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      student_id,
      student_name,
      items_json: items as unknown as Database["public"]["Tables"]["orders"]["Insert"]["items_json"],
      total,
      pi_id,
      status: "pending",
      delivery_mode,
      delivery_loc,
      delivery_slot,
    })
    .select("order_id")
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ status: "error", message: orderErr?.message ?? "บันทึกออเดอร์ล้มเหลว" }, { status: 500 });
  }

  // ── Log ────────────────────────────────────────────────────────────
  await supabase.from("pay_logs").insert({
    order_id: order.order_id,
    student_id,
    total,
    pi_id,
    stripe_status: "requires_action",
    status: "pending",
    note: "สร้างออเดอร์สำเร็จ",
  });

  return NextResponse.json({ status: "success", order_id: order.order_id, pi_id, qr_url, total });
}
