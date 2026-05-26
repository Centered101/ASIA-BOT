import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Database } from "@/types/database";
import { sendLineFlexMessage, buildOrderFlexMessage } from "@/lib/line";


export async function GET(req: NextRequest) {
  const student_id = req.nextUrl.searchParams.get("student_id");
  if (!student_id)
    return NextResponse.json({ status: "error", message: "ไม่มี student_id" }, { status: 400 });

  const sb = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("orders")
    .select("order_id, student_id, student_name, items_json, total, status, created_at")
    .eq("student_id", student_id.trim())
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error)
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  const logs = (data ?? []).map(o => ({
    orderId:   o.order_id,
    ts:        o.created_at ?? new Date().toISOString(),
    status:    o.status as "pending" | "paid" | "failed" | "cancelled" | "expired",
    items:     (o.items_json as { id: string; name: string; price: number; qty: number; unit: string }[]) ?? [],
    total:     Number(o.total),
    student:   o.student_name,
    studentId: o.student_id,
  }));

  return NextResponse.json({ status: "success", data: logs });
}

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
    delivery_mode: "pickup" | "delivery";
    delivery_loc: string;
    delivery_slot: string;
  };

  const { student_id, student_name, items, delivery_mode, delivery_loc, delivery_slot } = body;
  if (!student_id || !items?.length) {
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

  const STRIPE_FEE_RATE = 0.02;
  const SYSTEM_FEE_RATE = 0.01;
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const total = subtotal
    + Math.ceil(subtotal * STRIPE_FEE_RATE * 100) / 100
    + Math.ceil(subtotal * SYSTEM_FEE_RATE * 100) / 100;

  // ── Fetch student phone ────────────────────────────────────────────
  const { data: studentPhoneRow } = await supabase
    .from("students")
    .select("student_phone")
    .eq("student_id", student_id)
    .maybeSingle();
  const studentPhone = studentPhoneRow?.student_phone ?? null;

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
          ...(studentPhone ? { phone: studentPhone } : {}),
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

  // ── Notify admin (new pending order) ──────────────────────────────
  console.log(`[ORDERS] sending LINE to admin for order ${order.order_id}`);
  try {
    const [studentRow, productsRow] = await Promise.all([
      (supabase as any).from("students").select("photo_url").eq("student_id", student_id).maybeSingle(),
      supabase.from("products").select("id, images").in("id", items.map(i => i.id)),
    ]);
    const imageMap = Object.fromEntries(
      ((productsRow.data ?? []) as { id: string; images: string[] | null }[])
        .map(p => [p.id, p.images?.[0] ?? null])
    );
    await sendLineFlexMessage(
      process.env.LINE_GROUP_ADMIN ?? "",
      `🛍️ ออเดอร์ใหม่ #${order.order_id.slice(-8).toUpperCase()} — ${student_name} — ฿${total.toFixed(2)}`,
      buildOrderFlexMessage({
        orderId: order.order_id,
        studentName: student_name,
        studentId: student_id,
        studentPhotoUrl: (studentRow as any)?.data?.photo_url ?? null,
        items: items.map(i => ({ ...i, imageUrl: imageMap[i.id] ?? null })),
        total,
        deliveryMode: delivery_mode,
        deliveryLoc: delivery_loc,
        deliverySlot: delivery_slot,
        status: "pending",
      })
    );
    console.log(`[ORDERS] LINE sent OK`);
  } catch (e) {
    console.error(`[ORDERS] LINE send failed:`, e);
  }

  return NextResponse.json({ status: "success", order_id: order.order_id, pi_id, qr_url, total });
}
