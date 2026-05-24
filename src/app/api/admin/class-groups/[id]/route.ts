import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { id } = await params;
  const { name, program, grade, section, department, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ status: "error", message: "กรุณากรอกชื่อกลุ่มเรียน" }, { status: 400 });
  const { data, error } = await supabase.from("class_groups")
    .update({ name: name.trim(), program: program || null, grade: grade || null, section: section || null, department: department || null, color: color || "#6366f1" })
    .eq("id", id).select().single();
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { id } = await params;
  const { error } = await supabase.from("class_groups").delete().eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
