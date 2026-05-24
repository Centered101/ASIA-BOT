import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("time_slots")
      .select("id, label, start_time, end_time")
      .order("id");

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success", data });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
