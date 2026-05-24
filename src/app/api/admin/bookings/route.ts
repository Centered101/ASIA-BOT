import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const [bookingsRes, roomsRes, slotsRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (statusFilter && statusFilter !== "all") {
        q = q.eq("status", statusFilter as "pending" | "approved" | "rejected" | "cancelled");
      }
      return q;
    })(),
    supabase.from("rooms").select("id, name, location"),
    supabase.from("time_slots").select("id, label, start_time, end_time"),
  ]);

  if (bookingsRes.error) return NextResponse.json({ status: "error", message: bookingsRes.error.message }, { status: 500 });

  const roomMap = Object.fromEntries((roomsRes.data ?? []).map((r) => [r.id, r]));
  const slotMap = Object.fromEntries((slotsRes.data ?? []).map((s) => [s.id, s]));

  const data = (bookingsRes.data ?? []).map((b) => ({
    ...b,
    room_name: roomMap[b.room_id]?.name ?? "ไม่ทราบ",
    room_location: roomMap[b.room_id]?.location ?? "",
    slot_label: slotMap[b.slot_id]?.label ?? "",
    slot_start: slotMap[b.slot_id]?.start_time ?? "",
    slot_end: slotMap[b.slot_id]?.end_time ?? "",
  }));

  return NextResponse.json({ status: "success", data });
}
