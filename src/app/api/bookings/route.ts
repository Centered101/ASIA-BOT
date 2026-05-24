import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { room_id, slot_id, booking_date, student_id, student_name, student_phone, purpose, attendees } = body;

    if (!room_id || !slot_id || !booking_date || !student_id?.trim() || !student_name?.trim() || !purpose?.trim()) {
      return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    // Check conflict: same room + slot + date, not cancelled/rejected
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id, student_name")
      .eq("room_id", room_id)
      .eq("slot_id", slot_id)
      .eq("booking_date", booking_date)
      .not("status", "in", '("cancelled","rejected")')
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({
        status: "conflict",
        message: "ช่วงเวลานี้มีการจองแล้ว กรุณาเลือกช่วงเวลาอื่น",
      }, { status: 409 });
    }

    const { error } = await supabase.from("bookings").insert({
      room_id,
      slot_id: Number(slot_id),
      booking_date,
      student_id: student_id.trim(),
      student_name: student_name.trim(),
      student_phone: student_phone?.trim() || null,
      purpose: purpose.trim(),
      attendees: attendees ? Number(attendees) : 1,
    });

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success" });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const room_id = searchParams.get("room_id");
    const date = searchParams.get("date");

    let query = supabase
      .from("bookings")
      .select("id, slot_id, student_name, purpose, status, attendees")
      .not("status", "in", '("cancelled","rejected")')
      .order("slot_id");

    if (room_id) query = query.eq("room_id", room_id);
    if (date) query = query.eq("booking_date", date);

    const { data, error } = await query;
    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    return NextResponse.json({ status: "success", data });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
