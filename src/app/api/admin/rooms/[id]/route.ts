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
  const body = await req.json() as Partial<Database["public"]["Tables"]["rooms"]["Update"]>;
  const update: Database["public"]["Tables"]["rooms"]["Update"] = {};
  if ("name"        in body) update.name        = body.name;
  if ("description" in body) update.description = body.description;
  if ("capacity"    in body) update.capacity    = body.capacity;
  if ("location"    in body) update.location    = body.location;
  if ("image_url"   in body) update.image_url   = body.image_url;
  if ("amenities"   in body) update.amenities   = body.amenities;
  if ("status"      in body) update.status      = body.status;
  if (Object.keys(update).length === 0) return NextResponse.json({ status: "error", message: "ไม่มีข้อมูล" }, { status: 400 });
  const { error } = await supabase.from("rooms").update(update).eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdminAuth(_req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { id } = await params;
  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
