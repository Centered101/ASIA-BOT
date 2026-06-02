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
    const date = searchParams.get("date");

    const { data, error } = await supabase
      .from("entry_logs")
      .select("*, students(first_name, last_name, nickname, program, department, photo_url)")
      .gte("scanned_at", date ? `${date}T00:00:00` : "1970-01-01T00:00:00")
      .lte("scanned_at", date ? `${date}T23:59:59` : "2999-12-31T23:59:59")
      .order("scanned_at", { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success", data });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
