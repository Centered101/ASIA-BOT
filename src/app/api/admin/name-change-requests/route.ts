import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth } from "@/lib/admin-auth";
import { buildStudentDataChangeFlexMessage, sendLineFlexMessage } from "@/lib/line";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let q = supabase.from("name_change_requests").select("*").order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  const studentIds = [...new Set((data ?? []).map((r) => r.student_id).filter(Boolean))];
  const studentsRes = studentIds.length
    ? await (supabase as any)
      .from("students")
      .select("student_id, first_name, last_name, nickname, program, department, photo_url")
      .in("student_id", studentIds)
    : { data: [] };
  const studentMap = Object.fromEntries((studentsRes.data ?? []).map((s: any) => [s.student_id, s]));
  const rows = (data ?? []).map((row) => ({ ...row, students: studentMap[row.student_id] ?? null }));
  return NextResponse.json({ status: "success", data: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { student_id, old_first_name, old_last_name, new_first_name, new_last_name, reason } = body;
  if (!student_id || !new_first_name || !new_last_name)
    return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });

  const { data, error } = await supabase.from("name_change_requests").insert({
    student_id, old_first_name, old_last_name,
    new_first_name: new_first_name.trim(),
    new_last_name: new_last_name.trim(),
    reason: reason?.trim() || null,
    status: "pending",
  }).select().single();

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  try {
    const { data: student } = await (supabase as any)
      .from("students")
      .select("photo_url,nickname,program,department")
      .eq("student_id", student_id)
      .maybeSingle();
    await sendLineFlexMessage(
      process.env.LINE_GROUP_ADMIN ?? "",
      `✏️ คำขอเปลี่ยนชื่อ: ${student_id} → ${new_first_name.trim()} ${new_last_name.trim()}`,
      buildStudentDataChangeFlexMessage({
        studentId: student_id,
        studentName: [old_first_name, old_last_name].filter(Boolean).join(" ") || student_id,
        studentPhotoUrl: student?.photo_url ?? null,
        nickname: student?.nickname ?? null,
        program: student?.program ?? null,
        department: student?.department ?? null,
        changes: [
          {
            label: "ชื่อ-นามสกุล",
            oldValue: [old_first_name, old_last_name].filter(Boolean).join(" ") || null,
            newValue: `${new_first_name.trim()} ${new_last_name.trim()}`,
          },
          ...(reason?.trim() ? [{ label: "เหตุผล", oldValue: null, newValue: reason.trim() }] : []),
        ],
      })
    );
  } catch (e) {
    console.error("[LINE] name change notify failed:", e);
  }

  return NextResponse.json({ status: "success", data });
}
