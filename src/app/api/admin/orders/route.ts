import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";

// Phase 1: this route had NO authentication — it returns every order in the
// shop with the buyer's student_id, name, and photo. Now gated on
// shop.view_all_orders. Read-only, so no audit entry.

type OrderStatus = "pending" | "paid" | "cancelled" | "refunded" | "delivered";

const ORDER_STATUSES: OrderStatus[] = ["pending", "paid", "cancelled", "refunded", "delivered"];

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as string[]).includes(value);
}

export const GET = withAuth(
  async (req) => {
    const supabase = getServiceClient();
    const status = new URL(req.url).searchParams.get("status");

    let query = supabase
      .from("orders")
      .select("order_id, student_id, student_name, items_json, total, pi_id, status, delivery_mode, delivery_loc, delivery_slot, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (status && status !== "all") {
      if (!isOrderStatus(status)) {
        return NextResponse.json({ status: "error", message: "สถานะไม่ถูกต้อง" }, { status: 400 });
      }
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const orders = data ?? [];
    const productIds = [
      ...new Set(orders.flatMap((o) => ((o.items_json as { id: string }[]) ?? []).map((i) => i.id))),
    ];
    const studentIds = [...new Set(orders.map((o) => o.student_id))];

    const [productsRes, studentsRes] = await Promise.all([
      productIds.length > 0
        ? supabase.from("products").select("id, images").in("id", productIds)
        : Promise.resolve({ data: [] as { id: string; images: string[] | null }[] }),
      studentIds.length > 0
        ? supabase.from("students").select("student_id, photo_url").in("student_id", studentIds)
        : Promise.resolve({ data: [] as { student_id: string; photo_url: string | null }[] }),
    ]);

    const imageMap = Object.fromEntries(
      (productsRes.data ?? []).map((p) => [p.id, p.images?.[0] ?? null])
    );
    const photoMap = Object.fromEntries(
      (studentsRes.data ?? []).map((s) => [s.student_id, s.photo_url ?? null])
    );

    const enriched = orders.map((o) => ({
      ...o,
      student_photo_url: photoMap[o.student_id] ?? null,
      items_json: ((o.items_json as { id: string }[]) ?? []).map((i) => ({
        ...i,
        imageUrl: imageMap[i.id] ?? null,
      })),
    }));

    return NextResponse.json({ status: "success", data: enriched });
  },
  { permission: "shop.view_all_orders" }
);
