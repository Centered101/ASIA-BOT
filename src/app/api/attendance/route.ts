import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date     = searchParams.get("date");     // YYYY-MM-DD
    const location = searchParams.get("location"); // school | library | meeting | all

    let query = supabase
      .from("attendance")
      .select("*, students(first_name, last_name, program, department, student_id)")
      .order("checkin_time", { ascending: false })
      .limit(500);

    if (date) {
      query = query.gte("checkin_time", `${date}T00:00:00`)
                   .lte("checkin_time", `${date}T23:59:59`);
    }

    if (location && location !== "all") {
      query = query.eq("location", location as "school" | "library" | "meeting");
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success", data: data ?? [] });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
