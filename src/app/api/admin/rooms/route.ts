import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { data, error } = await supabase.from("rooms").select("*").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function POST(req: NextRequest) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
  const body = await req.json() as { name: string; description?: string; capacity?: number; location?: string; image_url?: string; amenities?: string[] };
  if (!body.name?.trim()) return NextResponse.json({ status: "error", message: "กรุณาระบุชื่อห้อง" }, { status: 400 });
  const { data, error } = await supabase.from("rooms").insert({
    name: body.name.trim(),
    description: body.description?.trim() || null,
    capacity: body.capacity ?? 0,
    location: body.location?.trim() || null,
    image_url: body.image_url?.trim() || null,
    amenities: body.amenities ?? null,
    status: "active",
  }).select().single();
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}
