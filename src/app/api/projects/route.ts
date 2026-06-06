import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, slug, project_date, poster_url, demo_url, primary_color, logo_url, created_at")
      .order("project_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (!error) return NextResponse.json({ status: "success", data });

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("projects")
      .select("id, name, slug, poster_url, demo_url, primary_color, logo_url, created_at")
      .order("created_at", { ascending: false });

    if (fallbackError) {
      console.error("[api/projects] fallback failed:", fallbackError.message);
      return NextResponse.json({ status: "success", data: [] });
    }

    return NextResponse.json({
      status: "success",
      data: (fallbackData ?? []).map(project => ({ ...project, project_date: null })),
    });
  } catch (error) {
    console.error("[api/projects] failed:", error);
    return NextResponse.json({ status: "success", data: [] });
  }
}
