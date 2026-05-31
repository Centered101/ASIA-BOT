import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type BindBody = {
  student_id?: string;
  uid?: string;
  card_type?: string;
  device_id?: string;
  station_secret?: string;
  force_uid?: boolean;
};

function normalizeUid(uid: string) {
  return uid.trim().replace(/\s/g, "").toUpperCase();
}

function compactUid(uid: string) {
  return uid.trim().replace(/[\s:-]/g, "").toUpperCase();
}

function formatStudentCardUid(studentId: string, uid: string) {
  const raw = normalizeUid(uid);
  if (raw.startsWith(`${studentId}-`)) return raw;
  return `${studentId}-${compactUid(raw)}`;
}

function formatHardwareUid(uid: string) {
  return compactUid(uid);
}

function generateCardCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function isStudentCardUid(studentId: string, uid?: string | null) {
  return Boolean(uid && normalizeUid(uid).startsWith(`${studentId}-`));
}

async function generateUniqueStudentUid(studentId: string) {
  let uid = `${studentId}-${generateCardCode()}`;
  for (let i = 0; i < 8; i++) {
    const { data: taken } = await supabase.from("students").select("id").eq("uid", uid).maybeSingle();
    if (!taken) return uid;
    uid = `${studentId}-${generateCardCode()}`;
  }
  return uid;
}

async function verifyDevice(req: NextRequest, deviceId?: string | null, stationSecret?: string | null) {
  const envSecret = process.env.RFID_STATION_SECRET;
  const providedSecret = req.headers.get("x-device-key") ?? stationSecret ?? null;
  if (envSecret && providedSecret !== envSecret) return false;

  const deviceKey = req.headers.get("x-device-key");
  if (!deviceId || !deviceKey) return true;

  const result = await (supabase as any)
    .from("rfid_devices")
    .select("device_id")
    .eq("device_id", deviceId)
    .eq("device_key", deviceKey)
    .eq("status", "active")
    .maybeSingle();

  const missingDevicesTable = result.error?.code === "42P01" || /rfid_devices/i.test(result.error?.message ?? "");
  if (missingDevicesTable) return true;
  if (result.error) throw new Error(result.error.message);
  return Boolean(result.data);
}

export async function GET(req: NextRequest) {
  try {
    const studentId = req.nextUrl.searchParams.get("student_id")?.trim() ?? "";
    const deviceId = req.nextUrl.searchParams.get("device_id");
    const stationSecret = req.nextUrl.searchParams.get("station_secret");

    if (!await verifyDevice(req, deviceId, stationSecret)) {
      return NextResponse.json({ status: "error", code: "unauthorized", message: "RFID device key ไม่ถูกต้อง" }, { status: 401 });
    }

    if (!studentId) {
      return NextResponse.json({ status: "error", message: "ต้องส่ง student_id" }, { status: 400 });
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, nickname, program, department, entry_year, uid, card_status")
      .eq("student_id", studentId)
      .maybeSingle();

    if (studentError) return NextResponse.json({ status: "error", message: studentError.message }, { status: 500 });
    if (!student) return NextResponse.json({ status: "error", code: "student_not_found", message: "ไม่พบนักเรียน" }, { status: 404 });

    let uid = isStudentCardUid(studentId, student.uid) ? normalizeUid(student.uid as string) : await generateUniqueStudentUid(studentId);

    if (uid !== student.uid) {
      const { error: updateError } = await supabase
        .from("students")
        .update({ uid, updated_at: new Date().toISOString() } as any)
        .eq("student_id", studentId);

      if (updateError) return NextResponse.json({ status: "error", message: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      uid,
      student: { ...student, uid },
      message: "โหลด UID บัตรสำเร็จ",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as BindBody;
    const studentId = body.student_id?.trim() ?? "";
    const cardType = body.card_type?.trim() || "mifare";

    if (!await verifyDevice(req, body.device_id ?? null, body.station_secret ?? null)) {
      return NextResponse.json({ status: "error", code: "unauthorized", message: "RFID device key ไม่ถูกต้อง" }, { status: 401 });
    }

    if (!studentId) {
      return NextResponse.json({ status: "error", message: "ต้องส่ง student_id" }, { status: 400 });
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("student_id, first_name, last_name, uid")
      .eq("student_id", studentId)
      .maybeSingle();

    if (studentError) return NextResponse.json({ status: "error", message: studentError.message }, { status: 500 });
    if (!student) return NextResponse.json({ status: "error", code: "student_not_found", message: "ไม่พบนักเรียน" }, { status: 404 });

    let uid = "";
    if (body.force_uid && body.uid) {
      uid = formatHardwareUid(body.uid);
    } else if (isStudentCardUid(studentId, student.uid)) {
      uid = normalizeUid(student.uid as string);
    } else if (body.uid) {
      uid = formatStudentCardUid(studentId, body.uid);
    } else {
      uid = await generateUniqueStudentUid(studentId);
    }

    const { error: existingError } = await (supabase as any)
      .from("rfid_cards")
      .update({ status: "inactive", revoked_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .eq("status", "active");

    const missingRfidCardsTable = existingError?.code === "42P01" || /rfid_cards/i.test(existingError?.message ?? "");
    if (existingError && !missingRfidCardsTable) {
      return NextResponse.json({ status: "error", message: existingError.message }, { status: 500 });
    }

    if (!missingRfidCardsTable) {
      const { error: upsertError } = await (supabase as any)
        .from("rfid_cards")
        .upsert({
          student_id: studentId,
          uid,
          card_type: cardType,
          status: "active",
          issued_at: new Date().toISOString(),
          revoked_at: null,
        }, { onConflict: "uid" });

      if (upsertError) return NextResponse.json({ status: "error", message: upsertError.message }, { status: 500 });
    }

    await supabase
      .from("students")
      .update({ uid, card_status: "active", updated_at: new Date().toISOString() } as any)
      .eq("student_id", studentId);

    return NextResponse.json({
      status: "success",
      uid,
      student,
      message: "ผูกบัตรสำเร็จ",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
