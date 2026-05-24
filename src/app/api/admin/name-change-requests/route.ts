import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let q = supabase.from("name_change_requests").select("*").order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { student_id, old_first_name, old_last_name, new_first_name, new_last_name, reason } = body;
  if (!student_id || !new_first_name || !new_last_name)
    return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });

  const { data, error } = await supabase.from("name_change_requests").insert({
    student_id, old_first_name, old_last_name,
    new_first_name: new_first_name.trim(),
    new_last_name: new_last_name.trim(),
    reason: reason?.trim() || null,
    status: "pending",
  }).select().single();

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}
