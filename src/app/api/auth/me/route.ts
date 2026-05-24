import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const student_id = req.nextUrl.searchParams.get("student_id");
  if (!student_id)
    return NextResponse.json({ status: "error", message: "ไม่มี student_id" }, { status: 400 });

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("student_id", student_id.trim())
    .single();

  if (error || !data)
    return NextResponse.json({ status: "error", message: "ไม่พบนักเรียน" }, { status: 404 });

  return NextResponse.json({ status: "success", data });
}
