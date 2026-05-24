import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { data, error } = await supabase
    .from("class_groups").select("*")
    .order("program").order("grade").order("section").order("name");
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function POST(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { name, program, grade, section, department, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ status: "error", message: "กรุณากรอกชื่อกลุ่มเรียน" }, { status: 400 });
  const { data, error } = await supabase.from("class_groups")
    .insert({ name: name.trim(), program: program || null, grade: grade || null, section: section || null, department: department || null, color: color || "#6366f1" })
    .select().single();
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}
