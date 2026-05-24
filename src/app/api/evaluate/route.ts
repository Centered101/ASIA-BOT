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
    const {
      project_slug, gender, evaluator, name, emoji,
      creative, content, presentation, usability, overall, comments,
    } = body;

    if (!project_slug) {
      return NextResponse.json({ status: "error", message: "ไม่ระบุโปรเจค" }, { status: 400 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", project_slug)
      .single();

    if (!project) {
      return NextResponse.json({ status: "error", message: "ไม่พบโปรเจค" }, { status: 404 });
    }

    const { error } = await supabase.from("evaluations").insert({
      project_id:   project.id,
      gender,
      evaluator,
      name,
      emoji:        Number(emoji)        || null,
      creative:     Number(creative)     || null,
      content:      Number(content)      || null,
      presentation: Number(presentation) || null,
      usability:    Number(usability)    || null,
      overall:      Number(overall)      || null,
      comments,
    });

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
