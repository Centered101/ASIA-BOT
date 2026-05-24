import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const student_id = new URL(req.url).searchParams.get("student_id");
  if (!student_id) return NextResponse.json({ role: null });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("admins") as any)
    .select("role, admin_status")
    .eq("linked_student_id", student_id)
    .eq("admin_status", "active")
    .maybeSingle();

  return NextResponse.json({ role: data?.role ?? null });
}
