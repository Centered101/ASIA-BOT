import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Database } from "@/types/database";
import { sendLineFlexMessage, buildOrderFlexMessage } from "@/lib/line";
import { getLineNotificationTarget } from "@/lib/line-targets";

const HISTORY_RETENTION_DAYS = 30;
const HISTORY_MAX_ITEMS = 99;
const HISTORY_CLEANUP_STATUSES: Database["public"]["Tables"]["orders"]["Row"]["status"][] = ["paid", "cancelled", "refunded"];

async function cleanupStudentOrderHistory(sb: ReturnType<typeof createClient<Database>>, studentId: string) {
  const cutoff = new Date(Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: oldRows } = await sb
    .from("orders")
    .select("order_id")
    .eq("student_id", studentId)
    .in("status", HISTORY_CLEANUP_STATUSES)
    .lt("created_at", cutoff);

  const { data: extraRows } = await sb
    .from("orders")
    .select("order_id")
    .eq("student_id", studentId)
    .in("status", HISTORY_CLEANUP_STATUSES)
    .order("created_at", { ascending: false })
    .range(HISTORY_MAX_ITEMS, 1000);

  const orderIds = Array.from(new Set([
    ...((oldRows ?? []).map(row => row.order_id)),
    ...((extraRows ?? []).map(row => row.order_id)),
  ].filter(Boolean)));

  if (orderIds.length === 0) return;

  await sb.from("pay_logs").delete().in("order_id", orderIds);
  await sb.from("orders").delete().in("order_id", orderIds);
}

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
    const cleanStudentId = student_id.trim();
    await cleanupStudentOrderHistory(sb, cleanStudentId);
    const since = new Date(Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sb
      .from("orders")
      .select("order_id, student_id, student_name, items_json, total, status, created_at")
      .eq("student_id", cleanStudentId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(HISTORY_MAX_ITEMS);

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

type OrderItem = { id: string; name: string; price: number; qty: number; unit: string; color?: string };
type ColorStock = Record<string, number>;

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

    // ── Check stock before creating payment ───────────────────────────
    for (const [productId, qty] of Object.entries(qtyByProduct)) {
      const itemName = items.find(item => item.id === productId)?.name ?? "รายการที่เลือก";
      const { data: prod, error } = await supabase
        .from("products")
        .select("id, name, stock, color_stock")
        .eq("id", productId)
        .single();
      if (error || !prod) {
        return NextResponse.json({ status: "error", message: `ไม่พบสินค้า: ${itemName}` });
      }
      const colorStock = (prod.color_stock && typeof prod.color_stock === "object" && !Array.isArray(prod.color_stock))
        ? prod.color_stock as ColorStock
        : null;
      const effectiveStock = colorStock
        ? Object.values(colorStock).reduce((sum, colorQty) => sum + Number(colorQty || 0), 0)
        : prod.stock;
      if (effectiveStock < qty) {
        return NextResponse.json({ status: "error", message: `สต็อก "${prod.name}" ไม่พอ (เหลือ ${effectiveStock})` });
      }
      if (colorStock) {
        for (const [key, colorQty] of Object.entries(qtyByProductColor)) {
          const [colorProductId, color] = key.split("::");
          if (colorProductId !== productId || !(color in colorStock)) continue;
          const available = Number(colorStock[color] ?? 0);
          if (available < colorQty) {
            return NextResponse.json({ status: "error", message: `สี${color}ของ "${prod.name}" ไม่พอ (เหลือ ${available})` });
          }
        }
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
    for (const [productId, qty] of Object.entries(qtyByProduct)) {
      const { data: prod, error: stockFetchError } = await supabase.from("products").select("stock, color_stock").eq("id", productId).single();
      if (stockFetchError || !prod) {
        console.error("[SHOP_ORDERS_POST] stock refetch failed:", productId, stockFetchError?.message);
        continue;
      }
      const colorStock = (prod.color_stock && typeof prod.color_stock === "object" && !Array.isArray(prod.color_stock))
        ? { ...(prod.color_stock as ColorStock) }
        : null;
      if (colorStock) {
        for (const [key, colorQty] of Object.entries(qtyByProductColor)) {
          const [colorProductId, color] = key.split("::");
          if (colorProductId === productId && color in colorStock) {
            colorStock[color] = Math.max(0, Number(colorStock[color] ?? 0) - colorQty);
          }
        }
      }
      const nextStock = colorStock
        ? Object.values(colorStock).reduce((sum, colorQty) => sum + Number(colorQty || 0), 0)
        : Math.max(0, (prod.stock ?? qty) - qty);
      const updatePayload = colorStock ? { stock: nextStock, color_stock: colorStock } : { stock: nextStock };
      const { error: stockUpdateError } = await supabase.from("products").update(updatePayload).eq("id", productId);
      if (stockUpdateError) console.error("[SHOP_ORDERS_POST] stock update failed:", productId, stockUpdateError.message);
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
