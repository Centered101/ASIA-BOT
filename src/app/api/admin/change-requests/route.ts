import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from("change_requests") as any)
    .select("*, students!change_requests_student_id_fkey(first_name, last_name, nickname, program, department)")
    .order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    // fallback without join if FK not set
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: d2, error: e2 } = await (supabase.from("change_requests") as any)
      .select("*").order("created_at", { ascending: false });
    if (e2) return NextResponse.json({ status: "error", message: e2.message }, { status: 500 });
    return NextResponse.json({ status: "success", data: d2 ?? [] });
  }
  return NextResponse.json({ status: "success", data: data ?? [] });
}
