import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, name, contact, category, message, report_url, image_urls } = body;

    if (!type || !category || !message?.trim()) {
      return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    const { error } = await supabase.from("feedback").insert({
      type,
      name: name?.trim() || null,
      contact: contact?.trim() || null,
      category,
      message: message.trim(),
      report_url: report_url?.trim() || null,
      image_urls: image_urls?.length ? image_urls : null,
    });

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
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
