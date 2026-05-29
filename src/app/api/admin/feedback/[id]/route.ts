import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FEEDBACK_BUCKET = "feedback";
const FEEDBACK_PUBLIC_URL_MARKER = `/object/public/${FEEDBACK_BUCKET}/`;

function getFeedbackStoragePath(url: string): string | null {
  const idx = url.indexOf(FEEDBACK_PUBLIC_URL_MARKER);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(url.slice(idx + FEEDBACK_PUBLIC_URL_MARKER.length));
  } catch {
    return null;
  }
}

function getFeedbackImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((url): url is string => typeof url === "string" && url.length > 0);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const allowed = ["pending", "in_progress", "resolved", "rejected"] as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: { status?: any; updated_at?: string } = {};

  if (body.status && allowed.includes(body.status)) update.status = body.status;
  if (Object.keys(update).length === 0) return NextResponse.json({ status: "error", message: "ไม่มีข้อมูล" }, { status: 400 });

  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from("feedback").update(update).eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

    const { id } = await params;
    const { data: feedback, error: fetchError } = await supabase
      .from("feedback")
      .select("image_urls")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) return NextResponse.json({ status: "error", message: fetchError.message }, { status: 500 });
    if (!feedback) return NextResponse.json({ status: "error", message: "ไม่พบ Feedback" }, { status: 404 });

    const paths = getFeedbackImageUrls(feedback.image_urls)
      .map(getFeedbackStoragePath)
      .filter((path): path is string => Boolean(path));

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(FEEDBACK_BUCKET).remove(paths);
      if (storageError) console.error("[feedback delete] storage remove failed:", storageError.message);
    }

    const { error } = await supabase.from("feedback").delete().eq("id", id);

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success", deletedFiles: paths.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
