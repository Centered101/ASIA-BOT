import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EvalCustomField = {
  key: string;
  label: string;
  type: string;
};

type EvalCustomAnswer = {
  key: string;
  label: string;
  value: string;
};

const CUSTOM_ANSWERS_MARKER = "[[ASIA_BOT_CUSTOM_ANSWERS_V1]]";
const BASE_EVAL_KEYS = new Set([
  "project_slug",
  "gender",
  "evaluator",
  "name",
  "emoji",
  "creative",
  "content",
  "presentation",
  "usability",
  "overall",
  "comments",
]);

function customFieldsOf(value: unknown): EvalCustomField[] {
  if (!Array.isArray(value)) return [];
  return value.filter((field): field is EvalCustomField => {
    if (!field || typeof field !== "object") return false;
    const candidate = field as Record<string, unknown>;
    return typeof candidate.key === "string" && typeof candidate.label === "string";
  }).map(field => ({
    key: field.key,
    label: field.label,
    type: typeof field.type === "string" ? field.type : "text",
  }));
}

function valueLabel(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function packComments(baseComment: unknown, answers: EvalCustomAnswer[]) {
  const base = typeof baseComment === "string" ? baseComment.trim() : "";
  if (answers.length === 0) return base || null;
  const encoded = `${CUSTOM_ANSWERS_MARKER}\n${JSON.stringify(answers)}`;
  return base ? `${base}\n\n${encoded}` : encoded;
}

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
      .select("id, custom_fields")
      .eq("slug", project_slug)
      .single();

    if (!project) {
      return NextResponse.json({ status: "error", message: "ไม่พบโปรเจค" }, { status: 404 });
    }

    const customAnswers = customFieldsOf(project.custom_fields)
      .filter(field => !BASE_EVAL_KEYS.has(field.key))
      .map(field => ({
        key: field.key,
        label: field.label,
        value: valueLabel((body as Record<string, unknown>)[field.key]),
      }))
      .filter(answer => answer.value !== "");

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
      comments:     packComments(comments, customAnswers),
    });

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
