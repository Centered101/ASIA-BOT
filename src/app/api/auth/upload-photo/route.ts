import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const path = `avatars/${sid}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
    if (upErr)
      return NextResponse.json({ status: "error", message: upErr.message }, { status: 500 });

    const { data: { publicUrl: photo_url } } = supabase.storage.from(BUCKET).getPublicUrl(path);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("students") as any)
      .update({ photo_url, updated_at: new Date().toISOString() })
      .eq("student_id", sid);

    // Delete old photo immediately
    if (old_url) {
      const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
      if (old_url.startsWith(prefix)) {
        await supabase.storage.from(BUCKET).remove([old_url.slice(prefix.length)]);
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
