import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Public stats — limited info only
export async function GET() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [students, rooms, feedbackTotal, feedbackPending, feedbackResolved, feedbackInProgress, todayEntries] =
    await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("feedback").select("id", { count: "exact", head: true }),
      supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "resolved"),
      supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("entry_logs").select("id", { count: "exact", head: true }).gte("scanned_at", todayStart.toISOString()),
    ]);

  return NextResponse.json({
    ok: true,
    students:        students.count        ?? 0,
    rooms:           rooms.count           ?? 0,
    feedbackTotal:   feedbackTotal.count   ?? 0,
    feedbackPending: feedbackPending.count ?? 0,
    feedbackResolved: feedbackResolved.count ?? 0,
    feedbackInProgress: feedbackInProgress.count ?? 0,
    todayEntries:    todayEntries.count    ?? 0,
  });
}
