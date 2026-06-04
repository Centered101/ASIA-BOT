import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
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
      const allowed_fields = ["student_id", "student_phone", "first_name", "last_name", "nickname", "program", "entry_year", "department", "uid", "card_status", "photo_url", "line_user_id"];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {};
      const requestedChanges = body.changes && typeof body.changes === "object" ? body.changes : cr.requested_changes;
      for (const k of allowed_fields) {
        if (k in requestedChanges) patch[k] = requestedChanges[k];
      }
      if (Object.keys(patch).length > 0) {
        const { data: currentStudent, error: currentStudentError } = await supabase
          .from("students")
          .select("id, student_id, uid")
          .eq("student_id", cr.student_id)
          .maybeSingle();

        if (currentStudentError) {
          return NextResponse.json({ status: "error", message: currentStudentError.message }, { status: 500 });
        }
        if (!currentStudent) {
          return NextResponse.json({ status: "error", message: "ไม่พบนักเรียนของคำขอนี้" }, { status: 404 });
        }

        if (typeof patch.student_id === "string") patch.student_id = patch.student_id.trim();
        if (typeof patch.uid === "string") patch.uid = patch.uid.trim() || null;

        if (patch.student_id && patch.student_id !== currentStudent.student_id) {
          const { data: duplicatedStudent } = await supabase
            .from("students")
            .select("id")
            .eq("student_id", patch.student_id)
            .neq("id", currentStudent.id)
            .maybeSingle();
          if (duplicatedStudent) {
            return NextResponse.json({
              status: "error",
              message: `รหัสนักเรียน ${patch.student_id} มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`,
            }, { status: 409 });
          }
        }

        if (patch.uid && patch.uid !== currentStudent.uid) {
          const { data: duplicatedUid } = await supabase
            .from("students")
            .select("id")
            .eq("uid", patch.uid)
            .neq("id", currentStudent.id)
            .maybeSingle();
          if (duplicatedUid) {
            return NextResponse.json({
              status: "error",
              message: `UID ${patch.uid} ถูกผูกกับนักเรียนคนอื่นแล้ว`,
            }, { status: 409 });
          }
        }

        patch.updated_at = new Date().toISOString();
        const { error: updateStudentError } = await supabase.from("students").update(patch).eq("id", currentStudent.id);
        if (updateStudentError) {
          const message = updateStudentError.code === "23505"
            ? "ข้อมูลซ้ำกับนักเรียนคนอื่น กรุณาตรวจสอบรหัสนักเรียนหรือ UID"
            : updateStudentError.message;
          return NextResponse.json({ status: "error", message }, { status: 500 });
        }
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
