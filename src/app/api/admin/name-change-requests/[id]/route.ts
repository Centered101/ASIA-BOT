import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { id } = await params;
  const adminId = req.headers.get("x-admin-id");
  const body = await req.json();
  const allowed = ["pending", "approved", "rejected"];
  if (!body.status || !allowed.includes(body.status))
    return NextResponse.json({ status: "error", message: "สถานะไม่ถูกต้อง" }, { status: 400 });

  // If approving, also update student name
  if (body.status === "approved") {
    const { data: ncr } = await supabase.from("name_change_requests").select("*").eq("id", id).single();
    if (ncr) {
      const changes = body.changes && typeof body.changes === "object" ? body.changes : {};
      const { error: updateStudentError } = await supabase.from("students").update({
        first_name: changes.first_name ?? ncr.new_first_name,
        last_name: changes.last_name ?? ncr.new_last_name,
      }).eq("student_id", ncr.student_id);
      if (updateStudentError) {
        return NextResponse.json({ status: "error", message: updateStudentError.message }, { status: 500 });
      }
    }
  }

  const { error } = await supabase.from("name_change_requests").update({
    status: body.status,
    admin_note: body.admin_note ?? null,
    reviewed_by: adminId,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
