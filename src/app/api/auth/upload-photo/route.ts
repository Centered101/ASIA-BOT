import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildStorageImagePath } from "@/lib/storage-path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "student-avatars";

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const file    = fd.get("file")       as File   | null;
    const sid     = fd.get("student_id") as string | null;
    const old_url = fd.get("old_url")    as string | null;

    if (!file || !sid)
      return NextResponse.json({ status: "error", message: "ข้อมูลไม่ครบ" }, { status: 400 });
    if (!file.type.startsWith("image/"))
      return NextResponse.json({ status: "error", message: "ไฟล์ต้องเป็นรูปภาพ" }, { status: 400 });
    if (file.size > 3 * 1024 * 1024)
      return NextResponse.json({ status: "error", message: "ขนาดไฟล์ไม่เกิน 3MB" }, { status: 400 });

    const ext  = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const path = buildStorageImagePath({ fileName: file.name || sid, ext });

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (upErr)
      return NextResponse.json({ status: "error", message: upErr.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const photo_url = `${publicUrl}?t=${Date.now()}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("students") as any)
      .update({ photo_url, updated_at: new Date().toISOString() })
      .eq("student_id", sid);

    if (old_url) {
      const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
      const oldPath = old_url.split("?")[0]; // ตัด query ?t= ออกก่อน
      if (oldPath.startsWith(prefix)) {
        // Thai ใน path ถูก encode เป็น %E0%B8... ต้อง decode ก่อนถึงจะ match/ลบได้
        const oldKey = decodeURIComponent(oldPath.slice(prefix.length));
        if (oldKey !== path) {
          await supabase.storage.from(BUCKET).remove([oldKey]);
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("students") as any)
      .select("*").eq("student_id", sid).single();

    return NextResponse.json({ status: "success", photo_url, data });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
