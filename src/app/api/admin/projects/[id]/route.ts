import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const update: Database["public"]["Tables"]["projects"]["Update"] = {};
  if ("name"          in body) update.name          = body.name;
  if ("slug"          in body) update.slug          = body.slug;
  if ("project_date"  in body) update.project_date = body.project_date || null;
  if ("poster_url"    in body) update.poster_url    = body.poster_url    || null;
  if ("demo_url"      in body) update.demo_url      = body.demo_url      || null;
  if ("primary_color" in body) update.primary_color = body.primary_color || null;
  if ("bg_image_url"  in body) update.bg_image_url  = body.bg_image_url  || null;
  if ("bg_size"       in body) update.bg_size       = body.bg_size       || null;
  if ("bg_color"      in body) update.bg_color      = body.bg_color      || null;
  if ("bg_overlay"    in body) update.bg_overlay    = body.bg_overlay    || null;
  if ("bg_repeat"     in body) update.bg_repeat     = body.bg_repeat     || null;
  if ("logo_url"      in body) update.logo_url      = body.logo_url      || null;
  if ("mascot_url"        in body) update.mascot_url         = body.mascot_url         || null;
  if ("mascot_msg_welcome" in body) update.mascot_msg_welcome = body.mascot_msg_welcome || null;
  if ("mascot_msg_thanks"  in body) update.mascot_msg_thanks  = body.mascot_msg_thanks  || null;
  if ("custom_fields" in body) update.custom_fields = body.custom_fields ?? null;
  if ("storage_folder" in body) update.storage_folder = body.storage_folder || null;
  if (Object.keys(update).length === 0)
    return NextResponse.json({ status: "error", message: "ไม่มีข้อมูล" }, { status: 400 });
  const { error } = await supabase.from("projects").update(update).eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
  const { id } = await params;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
