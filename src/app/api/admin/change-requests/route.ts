import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  async function attachStudents(rows: any[]) {
    const studentIds = [...new Set((rows ?? []).map((r) => r.student_id).filter(Boolean))];
    if (studentIds.length === 0) return rows ?? [];
    const { data: students } = await (supabase as any)
      .from("students")
      .select("student_id, first_name, last_name, nickname, program, department, photo_url, student_phone, entry_year, uid, card_status, line_user_id")
      .in("student_id", studentIds);
    const studentMap = Object.fromEntries((students ?? []).map((s: any) => [s.student_id, s]));
    return (rows ?? []).map((row) => ({
      ...row,
      students: row.students ?? studentMap[row.student_id] ?? null,
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from("change_requests") as any)
    .select("*, students!change_requests_student_id_fkey(student_id, first_name, last_name, nickname, program, department, photo_url, student_phone, entry_year, uid, card_status, line_user_id)")
    .order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    // fallback without join if FK not set
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: d2, error: e2 } = await (supabase.from("change_requests") as any)
      .select("*").order("created_at", { ascending: false });
    if (e2) return NextResponse.json({ status: "error", message: e2.message }, { status: 500 });
    return NextResponse.json({ status: "success", data: await attachStudents(d2 ?? []) });
  }
  return NextResponse.json({ status: "success", data: await attachStudents(data ?? []) });
}
