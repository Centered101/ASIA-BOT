import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildStudentDataChangeFlexMessage, sendLineFlexMessage } from "@/lib/line";
import { getLineNotificationTarget } from "@/lib/line-targets";
import {
  CARD_FIELD_LABELS, CARD_PROFILE_FIELDS, CARD_REQUEST_KEY, CARD_REQUEST_VALUE,
  GENDER_LABELS, phoneMatches, pickCardProfile, validateCardProfile,
} from "@/lib/student-card";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** แปลงค่าให้อ่านออกตอนโชว์ในแจ้งเตือน LINE */
function displayValue(field: string, value: string) {
  if (field === "gender") return GENDER_LABELS[value] ?? value;
  return value;
}

/**
 * นักเรียนส่งคำขอทำบัตรนักเรียนเอง
 * เก็บเป็น change_requests (pending) ให้แอดมินอนุมัติในแท็บ "คำขอแก้ไขข้อมูล"
 * แล้วค่อยแตะบัตรผูก UID จริงผ่าน /api/rfid/bind ทีหลัง
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const studentId = String(body.student_id ?? "").trim();
    const phone     = String(body.student_phone ?? "").trim();

    if (!studentId || !phone) {
      return NextResponse.json({ status: "error", message: "กรุณากรอกรหัสนักเรียนและเบอร์โทร" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: student, error: studentError } = await (supabase as any)
      .from("students")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();

    if (studentError) return NextResponse.json({ status: "error", message: studentError.message }, { status: 500 });
    if (!student)     return NextResponse.json({ status: "error", message: "ไม่พบรหัสนักเรียนนี้ในระบบ" }, { status: 404 });

    // ยืนยันตัวตนซ้ำฝั่งเซิร์ฟเวอร์ ห้ามเชื่อ client อย่างเดียว
    if (!phoneMatches(student.student_phone, phone)) {
      return NextResponse.json({ status: "error", message: "เบอร์โทรไม่ตรงกับรหัสนักเรียนนี้" }, { status: 401 });
    }

    const profile = pickCardProfile(body.profile);
    const errors  = validateCardProfile(profile);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ status: "error", message: "ข้อมูลไม่ครบหรือไม่ถูกต้อง", errors }, { status: 400 });
    }

    // กันส่งซ้ำ ถ้ายังมีคำขอทำบัตรค้างอยู่
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pending } = await (supabase as any)
      .from("change_requests")
      .select("id, requested_changes")
      .eq("student_id", studentId)
      .eq("status", "pending");

    const hasPendingCardRequest = (pending ?? []).some(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (row: any) => row?.requested_changes?.[CARD_REQUEST_KEY]
    );
    if (hasPendingCardRequest) {
      return NextResponse.json({
        status: "error",
        code: "duplicate",
        message: "คุณมีคำขอทำบัตรที่รออนุมัติอยู่แล้ว กรุณารอผู้ดูแลตรวจสอบ",
      }, { status: 409 });
    }

    // ส่งเฉพาะฟิลด์ที่เปลี่ยนจริง แอดมินจะได้เห็น diff สั้น ๆ ไม่รกจอ
    const changed: Record<string, string> = {};
    for (const field of CARD_PROFILE_FIELDS) {
      const next = profile[field];
      if (next === undefined) continue;
      if (String(student[field] ?? "") !== next) changed[field] = next;
    }

    const requestedChanges = { [CARD_REQUEST_KEY]: CARD_REQUEST_VALUE, ...changed };

    const { error: insertError } = await supabase.from("change_requests").insert({
      student_id: studentId,
      requested_changes: requestedChanges,
      status: "pending",
      created_at: new Date().toISOString(),
    });

    if (insertError) return NextResponse.json({ status: "error", message: insertError.message }, { status: 500 });

    try {
      const changeList = Object.entries(changed).map(([field, newValue]) => ({
        label:    CARD_FIELD_LABELS[field as keyof typeof CARD_FIELD_LABELS] ?? field,
        oldValue: student[field] ? displayValue(field, String(student[field])) : null,
        newValue: displayValue(field, newValue),
      }));
      await sendLineFlexMessage(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await getLineNotificationTarget(supabase as any, "data_change"),
        `🪪 คำขอทำบัตรนักเรียน: ${studentId}`,
        buildStudentDataChangeFlexMessage({
          studentId,
          studentName: `${student.first_name} ${student.last_name}`.trim() || studentId,
          studentPhotoUrl: student.photo_url ?? null,
          nickname: student.nickname ?? null,
          program: student.program ?? null,
          department: student.department ?? null,
          changes: changeList,
        })
      );
    } catch (e) {
      console.error("[LINE] student card request notify failed:", e);
    }

    return NextResponse.json({
      status: "success",
      changed_count: Object.keys(changed).length,
      message: "ส่งคำขอทำบัตรเรียบร้อย รอผู้ดูแลอนุมัติ",
    });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
