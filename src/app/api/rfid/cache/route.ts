import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "disabled",
    message: "RFID cache endpoint is disabled. ESP32 now sends scans directly to /api/rfid/check.",
  }, { status: 410 });
}
