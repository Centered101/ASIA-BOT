import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildStudentDataChangeFlexMessage, sendLineFlexMessage } from "@/lib/line";
import { getLineNotificationTarget } from "@/lib/line-targets";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FIELD_LABELS: Record<string, string> = {
  first_name: "ชื่อ",
  last_name: "นามสกุล",
  nickname: "ชื่อเล่น",
  program: "ระดับ",
  entry_year: "ปีที่เข้าเรียน",
  department: "แผนก/สาขา",
  student_phone: "เบอร์โทร",
  email: "อีเมล",
  birth_date: "วันเกิด",
  gender: "เพศ",
  national_id: "เลขประจำตัวประชาชน",
  address: "ที่อยู่",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { student_id, changes } = body;
    if (!student_id || !changes || Object.keys(changes).length === 0)
      return NextResponse.json({ status: "error", message: "ข้อมูลไม่ครบ" }, { status: 400 });

    const { data: student } = await (supabase as any)
      .from("students")
      .select("student_id, first_name, last_name, nickname, program, entry_year, department, student_phone, photo_url")
      .eq("student_id", student_id)
      .maybeSingle();

    const { error } = await supabase.from("change_requests").insert({
      student_id,
      requested_changes: changes,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    try {
      const changeList = Object.entries(changes as Record<string, string>).map(([field, newValue]) => ({
        label: FIELD_LABELS[field] ?? field,
        oldValue: student?.[field] ? String(student[field]) : null,
        newValue: String(newValue),
      }));
      await sendLineFlexMessage(
        await getLineNotificationTarget(supabase as any, "data_change"),
        `📝 คำขอแก้ไขข้อมูล: ${student_id}`,
        buildStudentDataChangeFlexMessage({
          studentId: student_id,
          studentName: student ? `${student.first_name} ${student.last_name}`.trim() : student_id,
          studentPhotoUrl: student?.photo_url ?? null,
          nickname: student?.nickname ?? null,
          program: student?.program ?? null,
          department: student?.department ?? null,
          changes: changeList,
        })
      );
    } catch (e) {
      console.error("[LINE] data change notify failed:", e);
    }

    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
