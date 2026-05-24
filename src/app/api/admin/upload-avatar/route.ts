import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "avatars";
const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif"];
const CONTENT_TYPES: Record<string, string> = {};

export async function POST(req: NextRequest) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ status: "error", message: "ไม่พบไฟล์" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  if (!ALLOWED.includes(ext))
    return NextResponse.json({ status: "error", message: "ไฟล์ต้องเป็น jpg, png, webp หรือ gif" }, { status: 400 });
  if (file.size > 3 * 1024 * 1024)
    return NextResponse.json({ status: "error", message: "ขนาดไฟล์ไม่เกิน 3MB" }, { status: 400 });

  const contentType = CONTENT_TYPES[ext] ?? file.type;
  const path = `${session.admin_id}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  const { data: { publicUrl: url } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ status: "success", url });
}

export async function DELETE(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { url } = await req.json() as { url?: string };
  if (!url) return NextResponse.json({ status: "error", message: "ไม่พบ URL" }, { status: 400 });

  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return NextResponse.json({ status: "error", message: "URL ไม่ตรงกับ bucket" }, { status: 400 });

  const path = decodeURIComponent(url.slice(idx + marker.length));
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
