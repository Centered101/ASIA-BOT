import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};

  const allowed_card = ["active", "inactive", "lost"];
  if (body.card_status && allowed_card.includes(body.card_status)) update.card_status = body.card_status;

  const isAdmin = session.role === "admin" || session.role === "superadmin";

  if (isAdmin) {
    if (body.first_name  !== undefined) update.first_name    = body.first_name?.trim()    || null;
    if (body.last_name   !== undefined) update.last_name     = body.last_name?.trim()     || null;
    if (body.nickname    !== undefined) update.nickname      = body.nickname?.trim()      || null;
    if (body.student_phone !== undefined) update.student_phone = body.student_phone?.trim() || null;
    if (body.entry_year  !== undefined) update.entry_year    = body.entry_year?.trim()    || null;
    if (body.program     !== undefined) update.program       = body.program?.trim()       || null;
    if (body.department  !== undefined) update.department    = body.department?.trim()    || null;
    if (body.photo_url   !== undefined) update.photo_url     = body.photo_url?.trim()     || null;
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ status: "error", message: "ไม่มีข้อมูลที่จะอัปเดต" }, { status: 400 });

  update.updated_at = new Date().toISOString();
  const { error } = await supabase.from("students").update(update).eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (session.role !== "superadmin")
    return NextResponse.json({ status: "error", message: "ต้องเป็น Superadmin เท่านั้น" }, { status: 403 });

  const { id } = await params;
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
