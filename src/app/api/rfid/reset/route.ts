import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ResetBody = {
  uid?: string;
  student_id?: string;
  status?: "inactive" | "lost";
  device_id?: string;
  station_secret?: string;
};

function normalizeUid(uid: string) {
  return uid.trim().replace(/[\s:-]/g, "").toUpperCase();
}

function displayUid(uid: string) {
  return uid.trim().replace(/\s/g, "").toUpperCase();
}

function uidCandidates(uid: string) {
  const raw = displayUid(uid);
  const compact = normalizeUid(uid);
  const colon = compact.match(/.{1,2}/g)?.join(":") ?? compact;
  return Array.from(new Set([raw, compact, colon].filter(Boolean)));
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
    const body = await req.json().catch(() => ({})) as ResetBody;
    const uid = body.uid ? displayUid(body.uid) : "";
    const candidates = uid ? uidCandidates(uid) : [];
    const studentId = body.student_id?.trim() ?? "";
    const status = body.status === "lost" ? "lost" : "inactive";

    if (!await verifyDevice(req, body.device_id ?? null, body.station_secret ?? null)) {
      return NextResponse.json({ status: "error", code: "unauthorized", message: "RFID device key ไม่ถูกต้อง" }, { status: 401 });
    }

    if (!uid && !studentId) {
      return NextResponse.json({ status: "error", message: "ต้องส่ง uid หรือ student_id" }, { status: 400 });
    }

    let resolvedStudentId = studentId;

    const query = (supabase as any)
      .from("rfid_cards")
      .update({ status, revoked_at: new Date().toISOString() })
      .select("student_id");

    const result = uid
      ? await query.in("uid", candidates)
      : await query.eq("student_id", studentId).eq("status", "active");

    const missingRfidCardsTable = result.error?.code === "42P01" || /rfid_cards/i.test(result.error?.message ?? "");
    if (result.error && !missingRfidCardsTable) {
      return NextResponse.json({ status: "error", message: result.error.message }, { status: 500 });
    }

    if (!missingRfidCardsTable && result.data?.[0]?.student_id) {
      resolvedStudentId = result.data[0].student_id;
    }

    if (uid) {
      const { data: student } = await supabase
        .from("students")
        .select("student_id")
        .in("uid", candidates)
        .maybeSingle();
      if (student?.student_id) resolvedStudentId = student.student_id;
    }

    if (resolvedStudentId) {
      await supabase
        .from("students")
        .update({ uid: null, card_status: status, updated_at: new Date().toISOString() } as any)
        .eq("student_id", resolvedStudentId);
    }

    return NextResponse.json({
      status: "success",
      uid: uid || null,
      student_id: resolvedStudentId || null,
      card_status: status,
      message: status === "lost" ? "แจ้งบัตรหายแล้ว" : "รีเซ็ตบัตรแล้ว",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
