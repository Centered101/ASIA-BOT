import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildStorageImagePath } from "@/lib/storage-path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "feedback";
const MAX_MB = 5;

export async function POST(req: NextRequest) {
  try {
    const fd   = await req.formData();
    const file = fd.get("file") as File | null;

    if (!file)
      return NextResponse.json({ status: "error", message: "ไม่พบไฟล์" }, { status: 400 });
    if (!file.type.startsWith("image/"))
      return NextResponse.json({ status: "error", message: "ไฟล์ต้องเป็นรูปภาพ" }, { status: 400 });
    if (file.size > MAX_MB * 1024 * 1024)
      return NextResponse.json({ status: "error", message: `ขนาดไฟล์เกิน ${MAX_MB} MB` }, { status: 400 });

    const ext  = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = buildStorageImagePath({ fileName: file.name, ext });

    // Ensure bucket exists (creates if not found)
    const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (bucketErr && !bucketErr.message.toLowerCase().includes("already exists") && !bucketErr.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ status: "error", message: `Bucket: ${bucketErr.message}` }, { status: 500 });
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });

    if (error)
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ status: "success", url: publicUrl });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
