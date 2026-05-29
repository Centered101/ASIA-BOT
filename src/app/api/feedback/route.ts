import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sendLineFlexMessage, buildFeedbackFlexMessage } from "@/lib/line";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, student_id, email, contact, category, message, report_url, image_urls } = body;

    if (!type || !category || !message?.trim()) {
      return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    const { data: inserted, error } = await supabase.from("feedback").insert({
      type,
      name:       name?.trim()    || null,
      student_id: student_id      || null,
      email:      email?.trim()   || null,
      contact:    contact?.trim() || null,
      category,
      message:    message.trim(),
      report_url: report_url?.trim() || null,
      image_urls: image_urls?.length ? image_urls : null,
    } as any).select("id").single();

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    // ── Notify admin group ────────────────────────────────────────────
    const feedbackId = (inserted as { id: string } | null)?.id ?? "unknown";
    const typeLabel  = type === "comment" ? "ความคิดเห็น" : "รายงานปัญหา";
    const altText    = `📝 Feedback ใหม่ (${typeLabel}) จาก ${name?.trim() || "ไม่ระบุชื่อ"}`;
    try {
      // Fetch student photo if student_id provided
      let studentPhotoUrl: string | null = null;
      if (student_id) {
        const { data: stu } = await (supabase as any)
          .from("students")
          .select("photo_url")
          .eq("student_id", student_id)
          .maybeSingle();
        studentPhotoUrl = stu?.photo_url ?? null;
      }

      await sendLineFlexMessage(
        process.env.LINE_GROUP_ADMIN ?? "",
        altText,
        buildFeedbackFlexMessage({
          feedbackId,
          type,
          name:           name?.trim()    || null,
          studentId:      student_id      || null,
          studentPhotoUrl,
          email:          email?.trim()   || null,
          contact:        contact?.trim() || null,
          category,
          reportUrl:      report_url?.trim() || null,
          message:        message.trim(),
          imageUrls:      image_urls?.length ? image_urls : null,
        })
      );
    } catch (e) {
      console.error("[LINE] feedback notify failed:", e);
    }

    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success", data });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
