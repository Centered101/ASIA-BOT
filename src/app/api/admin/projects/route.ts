import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { data, error } = await supabase
    .from("projects").select("*")
    .order("project_date", { ascending: false, nullsFirst: false }).order("name");
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function POST(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { name, slug, project_date, poster_url, demo_url, primary_color, bg_image_url, bg_size, bg_color, bg_overlay, bg_repeat, logo_url, mascot_url, mascot_msg_welcome, mascot_msg_thanks, custom_fields, storage_folder } = await req.json();
  if (!name?.trim() || !slug?.trim() || !project_date)
    return NextResponse.json({ status: "error", message: "กรุณากรอก ชื่อ, slug และ วันที่" }, { status: 400 });

  if (!/^[a-z0-9-]+$/.test(slug.trim()))
    return NextResponse.json({ status: "error", message: "Slug ใช้ได้เฉพาะ a-z 0-9 และ -" }, { status: 400 });

  const { data: existing } = await supabase.from("projects").select("id").eq("slug", slug.trim()).single();
  if (existing) return NextResponse.json({ status: "error", message: "Slug นี้มีอยู่แล้ว" }, { status: 409 });

  const { data, error } = await supabase.from("projects")
    .insert({
      name: name.trim(), slug: slug.trim(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ project_date: project_date || null } as any),
      poster_url: poster_url || null, demo_url: demo_url || null,
      primary_color: primary_color || null, bg_image_url: bg_image_url || null, bg_size: bg_size || null,
      bg_color: bg_color || null, bg_overlay: bg_overlay || null, bg_repeat: bg_repeat || null,
      logo_url: logo_url || null, mascot_url: mascot_url || null,
      mascot_msg_welcome: mascot_msg_welcome || null, mascot_msg_thanks: mascot_msg_thanks || null,
      custom_fields: custom_fields ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(storage_folder !== undefined && { storage_folder: storage_folder || null } as any),
    })
    .select("id").single();
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", id: data.id });
}
