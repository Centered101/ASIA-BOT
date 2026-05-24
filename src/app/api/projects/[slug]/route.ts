import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) {
    const notFound = error.code === "PGRST116";
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: notFound ? 404 : 500 }
    );
  }
  if (!data) return NextResponse.json({ status: "error" }, { status: 404 });
  return NextResponse.json({ status: "success", data });
}
