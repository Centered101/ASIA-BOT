import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same device verification as /api/rfid/bind so the ESP32 controller can call
// this with its x-device-key (admin-cookie auth is NOT available to the device).
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

// GET /api/rfid/students?q=<search>&unbound=1&device_id=...
// Returns students for the bind picker. Defaults to ONLY unbound students
// (students.uid IS NULL). Pass unbound=0 to include everyone.
export async function GET(req: NextRequest) {
  try {
    const deviceId = req.nextUrl.searchParams.get("device_id");
    const stationSecret = req.nextUrl.searchParams.get("station_secret");

    if (!await verifyDevice(req, deviceId, stationSecret)) {
      return NextResponse.json({ status: "error", code: "unauthorized", message: "RFID device key ไม่ถูกต้อง" }, { status: 401 });
    }

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const unbound = req.nextUrl.searchParams.get("unbound") !== "0";

    let query = (supabase.from("students") as any)
      .select("student_id, first_name, last_name, nickname, program, department, photo_url, card_status, uid")
      .order("student_id", { ascending: true })
      .limit(50);

    if (unbound) query = query.is("uid", null);
    if (q) query = query.or(`student_id.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,nickname.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    return NextResponse.json({ status: "success", data: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
