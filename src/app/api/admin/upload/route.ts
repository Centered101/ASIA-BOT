import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildStorageImagePath } from "@/lib/storage-path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif", "svg", "ico"];
const CONTENT_TYPES: Record<string, string> = { svg: "image/svg+xml", ico: "image/x-icon" };

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ status: "error", message: "ไม่พบไฟล์" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  if (!ALLOWED.includes(ext))
    return NextResponse.json({ status: "error", message: "ไฟล์ต้องเป็น jpg, png, webp, gif, svg หรือ ico" }, { status: 400 });

  const contentType = CONTENT_TYPES[ext] ?? file.type;
  const path = buildStorageImagePath({ fileName: file.name, ext });
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, buffer, { contentType, upsert: false });

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
  return NextResponse.json({ status: "success", url: publicUrl });
}

export async function DELETE(req: NextRequest) {
  const { url } = await req.json() as { url?: string };
  if (!url) return NextResponse.json({ status: "error", message: "ไม่พบ URL" }, { status: 400 });

  const marker = "/object/public/product-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return NextResponse.json({ status: "error", message: "URL ไม่ใช่ไฟล์ใน product-images" }, { status: 400 });

  const path = decodeURIComponent(url.slice(idx + marker.length));
  const { error } = await supabase.storage.from("product-images").remove([path]);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
