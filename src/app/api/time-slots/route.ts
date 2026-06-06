import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_TIME_SLOTS = [
  { id: 1, label: "08:15 - 09:15", start_time: "08:15:00", end_time: "09:15:00" },
  { id: 2, label: "09:15 - 10:15", start_time: "09:15:00", end_time: "10:15:00" },
  { id: 3, label: "10:15 - 11:15", start_time: "10:15:00", end_time: "11:15:00" },
  { id: 4, label: "11:15 - 12:15", start_time: "11:15:00", end_time: "12:15:00" },
  { id: 5, label: "13:15 - 14:15", start_time: "13:15:00", end_time: "14:15:00" },
  { id: 6, label: "14:15 - 15:15", start_time: "14:15:00", end_time: "15:15:00" },
];

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("time_slots")
      .select("id, label, start_time, end_time")
      .order("id");

    if (error) {
      console.error("[api/time-slots] failed:", error.message);
      return NextResponse.json({ status: "success", data: DEFAULT_TIME_SLOTS });
    }
    return NextResponse.json({ status: "success", data: data?.length ? data : DEFAULT_TIME_SLOTS });
  } catch (error) {
    console.error("[api/time-slots] failed:", error);
    return NextResponse.json({ status: "success", data: DEFAULT_TIME_SLOTS });
  }
}
