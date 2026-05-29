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
};

function normalizeUid(uid: string) {
  return uid.trim().replace(/[\s:-]/g, "").toUpperCase();
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as BindBody;
    const studentId = body.student_id?.trim() ?? "";
    const uid = body.uid ? normalizeUid(body.uid) : "";
    const cardType = body.card_type?.trim() || "mifare";

    if (!await verifyDevice(req, body.device_id ?? null, body.station_secret ?? null)) {
      return NextResponse.json({ status: "error", code: "unauthorized", message: "RFID device key ไม่ถูกต้อง" }, { status: 401 });
    }

    if (!studentId || !uid) {
      return NextResponse.json({ status: "error", message: "ต้องส่ง student_id และ uid" }, { status: 400 });
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("student_id, first_name, last_name")
      .eq("student_id", studentId)
      .maybeSingle();

    if (studentError) return NextResponse.json({ status: "error", message: studentError.message }, { status: 500 });
    if (!student) return NextResponse.json({ status: "error", code: "student_not_found", message: "ไม่พบนักเรียน" }, { status: 404 });

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
