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

  if (body.status === "approved") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cr } = await (supabase.from("change_requests") as any).select("*").eq("id", id).single();
    if (cr?.requested_changes && typeof cr.requested_changes === "object") {
      const allowed_fields = ["nickname", "student_phone", "entry_year", "department"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {};
      for (const k of allowed_fields) {
        if (k in cr.requested_changes) patch[k] = cr.requested_changes[k];
      }
      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
        await supabase.from("students").update(patch).eq("student_id", cr.student_id);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("change_requests") as any).update({
    status: body.status,
    admin_note: body.admin_note ?? null,
    reviewed_by: adminId,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
