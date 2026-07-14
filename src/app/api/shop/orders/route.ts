import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Database } from "@/types/database";
import { sendLineFlexMessage, buildOrderFlexMessage } from "@/lib/line";
import { getLineNotificationTarget } from "@/lib/line-targets";


export async function GET(req: NextRequest) {
  try {
    const student_id = req.nextUrl.searchParams.get("student_id");
    if (!student_id)
      return NextResponse.json({ status: "error", message: "ไม่มี student_id" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      console.error("[SHOP_ORDERS_GET] missing Supabase env");
      return NextResponse.json({ status: "success", data: [] });
    }

    const sb = createClient<Database>(supabaseUrl, serviceRole);
    const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sb
      .from("orders")
      .select("order_id, student_id, student_name, items_json, total, status, created_at")
      .eq("student_id", student_id.trim())
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[SHOP_ORDERS_GET]", error.message);
      return NextResponse.json({ status: "success", data: [] });
    }

    const logs = (data ?? []).map(o => ({
      orderId:   o.order_id,
      ts:        o.created_at ?? new Date().toISOString(),
      status:    o.status as "pending" | "paid" | "failed" | "cancelled" | "expired",
      items:     Array.isArray(o.items_json) ? o.items_json as { id: string; name: string; price: number; qty: number; unit: string }[] : [],
      total:     Number(o.total),
      student:   o.student_name,
      studentId: o.student_id,
    }));

    return NextResponse.json({ status: "success", data: logs });
  } catch (err) {
    console.error("[SHOP_ORDERS_GET]", err);
    return NextResponse.json({ status: "success", data: [] });
  }
}

type OrderItem = { id: string; name: string; price: number; qty: number; unit: string };

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!supabaseUrl || !serviceRole) {
      console.error("[SHOP_ORDERS_POST] missing Supabase env");
      return NextResponse.json({ status: "error", message: "ยังไม่ได้ตั้งค่า Supabase สำหรับระบบสหกรณ์" });
    }
    if (!stripeKey) {
      console.error("[SHOP_ORDERS_POST] missing STRIPE_SECRET_KEY");
      return NextResponse.json({ status: "error", message: "ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY สำหรับรับชำระเงิน" });
    }

    const supabase = createClient<Database>(supabaseUrl, serviceRole);
    const stripe = new Stripe(stripeKey);

    const body = await req.json() as {
      student_id: string;
      student_name: string;
      items: OrderItem[];
      delivery_mode: "pickup" | "delivery";
      delivery_loc: string;
      delivery_slot: string;
      source?: "ai" | "cart";
    };

    const { student_id, student_name, items, delivery_mode, delivery_loc, delivery_slot, source } = body;
    if (!student_id || !items?.length) {
      return NextResponse.json({ status: "error", message: "ข้อมูลไม่ครบ" });
    }

    // ── Check stock before creating payment ───────────────────────────
    for (const item of items) {
      const { data: prod, error } = await supabase
        .from("products")
        .select("id, name, stock")
        .eq("id", item.id)
        .single();
      if (error || !prod) {
        return NextResponse.json({ status: "error", message: `ไม่พบสินค้า: ${item.name}` });
      }
      if (prod.stock < item.qty) {
        return NextResponse.json({ status: "error", message: `สต็อก "${prod.name}" ไม่พอ (เหลือ ${prod.stock})` });
      }
    }

    const STRIPE_FEE_RATE = 0.02;
    const SYSTEM_FEE_RATE = 0.01;
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal
      + Math.ceil(subtotal * STRIPE_FEE_RATE * 100) / 100
      + Math.ceil(subtotal * SYSTEM_FEE_RATE * 100) / 100;

    // ── Fetch student phone ────────────────────────────────────────────
    const { data: studentRow } = await supabase
      .from("students")
      .select("student_phone")
      .eq("student_id", student_id)
      .maybeSingle();
    const studentPhone = studentRow?.student_phone ?? null;
    const studentEmail = `${student_id}@asia-lb.ac.th`;

    // ── Stripe PromptPay ──────────────────────────────────────────────
    let pi_id = "";
    let qr_url = "";
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
          email: studentEmail,
          name: student_name,
          ...(studentPhone ? { phone: studentPhone } : {}),
        },
      },
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz"}/shop/`,
    });
    pi_id = confirmed.id;
    const nextAction = confirmed.next_action as { promptpay_display_qr_code?: { image_url_png?: string } } | null;
    qr_url = nextAction?.promptpay_display_qr_code?.image_url_png ?? "";

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
      console.error("[SHOP_ORDERS_POST] insert failed:", orderErr?.message);
      return NextResponse.json({ status: "error", message: orderErr?.message ?? "บันทึกออเดอร์ล้มเหลว" });
    }

    // ── Reserve stock after payment intent and order are ready ─────────
    for (const item of items) {
      const { data: prod, error: stockFetchError } = await supabase.from("products").select("stock").eq("id", item.id).single();
      if (stockFetchError || !prod) {
        console.error("[SHOP_ORDERS_POST] stock refetch failed:", item.id, stockFetchError?.message);
        continue;
      }
      const nextStock = Math.max(0, (prod.stock ?? item.qty) - item.qty);
      const { error: stockUpdateError } = await supabase.from("products").update({ stock: nextStock }).eq("id", item.id);
      if (stockUpdateError) console.error("[SHOP_ORDERS_POST] stock update failed:", item.id, stockUpdateError.message);
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
        await getLineNotificationTarget(supabase as any, "order"),
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
          sourceLabel: source === "ai" ? "ทำงานผ่าน AI" : null,
        })
      );
      console.log(`[ORDERS] LINE sent OK`);
    } catch (e) {
      console.error(`[ORDERS] LINE send failed:`, e);
    }

    return NextResponse.json({ status: "success", order_id: order.order_id, pi_id, qr_url, total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "สร้างออเดอร์ไม่สำเร็จ";
    console.error("[SHOP_ORDERS_POST]", err);
    return NextResponse.json({ status: "error", message: msg });
  }
}
