import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AuthBody = {
  username?: string;
  password?: string;
  device_id?: string;
};

async function verifyDevice(req: NextRequest, deviceId?: string | null) {
  const envSecret = process.env.RFID_STATION_SECRET;
  const deviceKey = req.headers.get("x-device-key");
  if (envSecret && deviceKey !== envSecret) return false;
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
    const body = await req.json().catch(() => ({})) as AuthBody;
    const username = body.username?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";

    if (!await verifyDevice(req, body.device_id ?? null)) {
      return NextResponse.json({ status: "error", code: "unauthorized", message: "RFID device key ไม่ถูกต้อง" }, { status: 401 });
    }

    if (!username || !password) {
      return NextResponse.json({ status: "error", code: "missing_credentials", message: "ต้องส่ง username และ password" }, { status: 400 });
    }

    const { data: admin, error } = await supabase
      .from("admins")
      .select("admin_id, username, password_hash, role, first_name, last_name, nickname, admin_status")
      .eq("username", username)
      .maybeSingle();

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    if (!admin || admin.admin_status !== "active") {
      return NextResponse.json({ status: "error", code: "invalid_credentials", message: "บัญชีไม่ถูกต้องหรือถูกปิดใช้งาน" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return NextResponse.json({ status: "error", code: "invalid_credentials", message: "username หรือ password ไม่ถูกต้อง" }, { status: 401 });
    }

    return NextResponse.json({
      status: "ok",
      ok: true,
      admin: {
        admin_id: admin.admin_id,
        username: admin.username,
        role: admin.role,
        first_name: admin.first_name,
        last_name: admin.last_name,
        nickname: admin.nickname,
      },
    });
  } catch (error) {
    return NextResponse.json({ status: "error", message: error instanceof Error ? error.message : "server_error" }, { status: 500 });
  }
}
