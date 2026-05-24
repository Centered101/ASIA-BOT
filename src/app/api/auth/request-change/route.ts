import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { student_id, changes } = body;
    if (!student_id || !changes || Object.keys(changes).length === 0)
      return NextResponse.json({ status: "error", message: "ข้อมูลไม่ครบ" }, { status: 400 });

    const { error } = await supabase.from("change_requests").insert({
      student_id,
      requested_changes: changes,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
