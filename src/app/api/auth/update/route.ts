import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { student_id, first_name, last_name, nickname, department, student_phone } = body;

    if (!student_id) return NextResponse.json({ status: "error", message: "ไม่พบรหัสนักเรียน" }, { status: 400 });

    const { error } = await supabase.from("students").update({
      first_name, last_name, nickname, department, student_phone,
      updated_at: new Date().toISOString(),
    }).eq("student_id", student_id);

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    const { data } = await supabase.from("students").select("*").eq("student_id", student_id).single();
    return NextResponse.json({ status: "success", data });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
