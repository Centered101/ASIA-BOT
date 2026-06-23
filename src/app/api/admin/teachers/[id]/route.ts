import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
  const { id } = await params;
  const { full_name, nickname, email, phone, department, subject, color, status } = await req.json();
  if (!full_name?.trim()) return NextResponse.json({ status: "error", message: "กรุณากรอกชื่อครู" }, { status: 400 });
  if (status && !["active", "inactive"].includes(status)) return NextResponse.json({ status: "error", message: "status ไม่ถูกต้อง" }, { status: 400 });
  const { data, error } = await supabase
    .from("teachers")
    .update({
      full_name:  full_name.trim(),
      nickname:   nickname?.trim()   || null,
      email:      email?.trim()      || null,
      phone:      phone?.trim()      || null,
      department: department?.trim() || null,
      subject:    subject?.trim()    || null,
      color:      color?.trim()      || null,
      status:     status ?? "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id).select().single();
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
  const { id } = await params;
  const { error } = await supabase.from("teachers").delete().eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
