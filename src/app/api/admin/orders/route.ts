import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("orders")
    .select("order_id, student_id, student_name, items_json, total, pi_id, status, delivery_mode, delivery_loc, delivery_slot, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") {
    query = query.eq("status", status as "pending" | "paid" | "cancelled" | "refunded");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  const orders = data ?? [];

  // ── Collect unique IDs ──────────────────────────────────────────────
  const productIds = [...new Set(
    orders.flatMap(o => ((o.items_json as { id: string }[]) ?? []).map(i => i.id))
  )];
  const studentIds = [...new Set(orders.map(o => o.student_id))];

  // ── Fetch images + photos in parallel ─────────────────────────────
  const [productsRes, studentsRes] = await Promise.all([
    productIds.length > 0
      ? supabase.from("products").select("id, images").in("id", productIds)
      : Promise.resolve({ data: [] as { id: string; images: string[] | null }[] }),
    studentIds.length > 0
      ? (supabase as any).from("students").select("student_id, photo_url").in("student_id", studentIds)
      : Promise.resolve({ data: [] as { student_id: string; photo_url: string | null }[] }),
  ]);

  const imageMap = Object.fromEntries(
    ((productsRes.data ?? []) as { id: string; images: string[] | null }[])
      .map(p => [p.id, p.images?.[0] ?? null])
  );
  const photoMap = Object.fromEntries(
    ((studentsRes.data ?? []) as { student_id: string; photo_url: string | null }[])
      .map(s => [s.student_id, s.photo_url ?? null])
  );

  const enriched = orders.map(o => ({
    ...o,
    student_photo_url: photoMap[o.student_id] ?? null,
    items_json: ((o.items_json as { id: string }[]) ?? []).map(i => ({
      ...i,
      imageUrl: imageMap[(i as { id: string }).id] ?? null,
    })),
  }));

  return NextResponse.json({ status: "success", data: enriched });
}
