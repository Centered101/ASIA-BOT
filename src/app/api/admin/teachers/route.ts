import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, nickname, email, phone, department, subject, color, status, linked_admin_id, created_at, updated_at")
    .in("status", ["active", "inactive"])
    .order("full_name");
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function POST(req: NextRequest) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
  const { full_name, nickname, email, phone, department, subject, color } = await req.json();
  if (!full_name?.trim()) return NextResponse.json({ status: "error", message: "กรุณากรอกชื่อครู" }, { status: 400 });
  const { data, error } = await supabase
    .from("teachers")
    .insert({
      full_name: full_name.trim(),
      nickname:   nickname?.trim()   || null,
      email:      email?.trim()      || null,
      phone:      phone?.trim()      || null,
      department: department?.trim() || null,
      subject:    subject?.trim()    || null,
      color:      color?.trim()      || null,
      status:     "active",
    })
    .select().single();
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}
