import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";
import { buildStorageImagePath } from "@/lib/storage-path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ status: "error", message: "ไม่พบไฟล์" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const allowed = ["jpg", "jpeg", "png", "webp", "gif", "svg", "ico"];
  if (!allowed.includes(ext))
    return NextResponse.json({ status: "error", message: "ไฟล์ต้องเป็น jpg, png, webp, gif, svg หรือ ico" }, { status: 400 });

  const CONTENT_TYPES: Record<string, string> = { svg: "image/svg+xml", ico: "image/x-icon" };
  const contentType = CONTENT_TYPES[ext] ?? file.type;
  const folder = form.get("folder") as string | null;
  const path = buildStorageImagePath({ fileName: file.name, ext, folder });
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("project-images")
    .upload(path, buffer, { contentType, upsert: false });

  if (error) {
    console.error("[upload-project] storage error:", error.message, "| path:", path);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("project-images").getPublicUrl(path);
  return NextResponse.json({ status: "success", url: publicUrl });
}

export async function DELETE(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { url } = await req.json() as { url?: string };
  if (!url) return NextResponse.json({ status: "error", message: "ไม่พบ URL" }, { status: 400 });

  // extract storage path from public URL: .../object/public/project-images/<path>
  const marker = "/object/public/project-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return NextResponse.json({ status: "error", message: "URL ไม่ใช่ไฟล์ใน project-images" }, { status: 400 });

  const path = decodeURIComponent(url.slice(idx + marker.length));
  const { error } = await supabase.storage.from("project-images").remove([path]);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
