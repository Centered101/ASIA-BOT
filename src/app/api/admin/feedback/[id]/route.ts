import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const allowed = ["pending", "in_progress", "resolved", "rejected"] as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: { status?: any; admin_note?: string | null; updated_at?: string } = {};

  if (body.status && allowed.includes(body.status)) update.status = body.status;
  if ("admin_note" in body) update.admin_note = body.admin_note ?? null;
  if (Object.keys(update).length === 0) return NextResponse.json({ status: "error", message: "ไม่มีข้อมูล" }, { status: 400 });

  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from("feedback").update(update).eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
