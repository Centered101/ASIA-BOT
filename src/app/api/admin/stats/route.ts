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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    students,
    pendingBookings,
    totalBookings,
    feedbackTotal,
    feedbackPending,
    todayEntries,
    inactiveCards,
    lostCards,
    paidOrders,
    pendingOrders,
    pendingDataRequests,
    pendingNameRequests,
    lowStockProducts,
    pendingTeacherApps,
    pendingEquipmentRequests,
  ] =
    await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase.from("feedback").select("id", { count: "exact", head: true }),
      supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("entry_logs").select("id", { count: "exact", head: true }).gte("scanned_at", todayStart.toISOString()),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("card_status", "inactive"),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("card_status", "lost"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      (supabase.from("change_requests") as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
      (supabase.from("name_change_requests") as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
      (supabase.from("products") as any)
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .is("deleted_at", null)
        .lte("stock", 5),
      (supabase.from("teachers") as any)
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "reviewing"]),
      supabase.from("equipment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  const inactiveCardCount = inactiveCards.count ?? 0;
  const lostCardCount = lostCards.count ?? 0;
  const paidOrderCount = paidOrders.count ?? 0;
  const pendingOrderCount = pendingOrders.count ?? 0;

  return NextResponse.json({
    status: "success",
    data: {
      students: students.count ?? 0,
      pendingBookings: pendingBookings.count ?? 0,
      totalBookings: totalBookings.count ?? 0,
      feedbackTotal: feedbackTotal.count ?? 0,
      feedbackPending: feedbackPending.count ?? 0,
      todayEntries: todayEntries.count ?? 0,
      inactiveCards: inactiveCardCount,
      lostCards: lostCardCount,
      paidOrders: paidOrderCount,
      pendingOrders: pendingOrderCount,
      orderUpdates: paidOrderCount + pendingOrderCount,
      pendingDataRequests: (pendingDataRequests.count ?? 0) + (pendingNameRequests.count ?? 0),
      rfidIssues: inactiveCardCount + lostCardCount,
      lowStockProducts: lowStockProducts.count ?? 0,
      pendingTeacherApps: pendingTeacherApps.count ?? 0,
      pendingEquipmentRequests: pendingEquipmentRequests.count ?? 0,
    },
  });
}
