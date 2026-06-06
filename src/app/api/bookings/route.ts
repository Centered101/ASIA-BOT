import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildBookingFlexMessage, sendLineFlexMessage } from "@/lib/line";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ScheduleRow = {
  class_group_id: string;
  room_name: string;
  subject: string | null;
  teacher: string | null;
  start_time: string;
  end_time: string;
  class_groups?: { name?: string | null } | null;
};

type OverrideRow = {
  class_group_id: string;
  room_name: string | null;
  subject: string | null;
  teacher: string | null;
  start_time: string;
  end_time: string;
  note: string | null;
};

type TimeSlotRow = {
  id: number;
  label: string;
  start_time: string;
  end_time: string;
};

function dayOfWeek(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const jsDay = d.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

function effectiveSchedules(schedules: ScheduleRow[], overrides: OverrideRow[]) {
  const overrideMap = new Map(overrides.map(o => [`${o.class_group_id}:${o.start_time}`, o]));
  return schedules
    .map(s => {
      const o = overrideMap.get(`${s.class_group_id}:${s.start_time}`);
      if (o && o.room_name === null) return null;
      return {
        ...s,
        room_name: o?.room_name ?? s.room_name,
        subject: o?.subject ?? s.subject,
        teacher: o?.teacher ?? s.teacher,
        start_time: o?.start_time ?? s.start_time,
        end_time: o?.end_time ?? s.end_time,
      };
    })
    .filter(Boolean) as ScheduleRow[];
}

async function getEffectiveSchedulesForDate(date: string) {
  const [schedRes, overrideRes] = await Promise.all([
    (supabase as any)
      .from("class_schedules")
      .select("class_group_id, room_name, subject, teacher, start_time, end_time, class_groups(name)")
      .eq("day_of_week", dayOfWeek(date)),
    (supabase as any)
      .from("class_schedule_overrides")
      .select("class_group_id, room_name, subject, teacher, start_time, end_time, note")
      .eq("override_date", date),
  ]);

  if (schedRes.error) throw new Error(schedRes.error.message);
  if (overrideRes.error) throw new Error(overrideRes.error.message);
  return effectiveSchedules((schedRes.data ?? []) as ScheduleRow[], (overrideRes.data ?? []) as OverrideRow[]);
}

function classConflictMessage(roomName: string, slot: TimeSlotRow, conflicts: ScheduleRow[], suggestions: string[]) {
  const subjects = conflicts
    .map(c => `${c.class_groups?.name ?? "กลุ่มเรียน"}${c.subject ? ` · ${c.subject}` : ""}`)
    .join(", ");
  const suggestText = suggestions.length
    ? ` ห้องสำรองที่ว่าง: ${suggestions.slice(0, 3).join(", ")}`
    : " ยังไม่พบห้องสำรองที่ว่างในช่วงเวลานี้";
  return `ห้อง ${roomName} มีตารางเรียนปกติช่วง ${slot.start_time.slice(0, 5)}-${slot.end_time.slice(0, 5)} (${subjects})${suggestText}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { room_id, slot_id, booking_date, student_id, student_name, student_phone, purpose, attendees } = body;

    if (!room_id || !slot_id || !booking_date || !student_id?.trim() || !student_name?.trim() || !purpose?.trim()) {
      return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
    }

    const [roomRes, slotRes] = await Promise.all([
      supabase.from("rooms").select("id, name, capacity, status").eq("id", room_id).single(),
      supabase.from("time_slots").select("id, label, start_time, end_time").eq("id", Number(slot_id)).single(),
    ]);

    if (roomRes.error || !roomRes.data) return NextResponse.json({ status: "error", message: "ไม่พบห้อง" }, { status: 404 });
    if (slotRes.error || !slotRes.data) return NextResponse.json({ status: "error", message: "ไม่พบช่วงเวลา" }, { status: 404 });

    const room = roomRes.data;
    const slot = slotRes.data as TimeSlotRow;
    let effective: ScheduleRow[] = [];
    try {
      effective = await getEffectiveSchedulesForDate(booking_date);
    } catch (scheduleError) {
      console.error("[api/bookings] schedule conflict check skipped:", scheduleError);
    }
    const classConflicts = effective.filter(s =>
      s.room_name === room.name && overlaps(s.start_time, s.end_time, slot.start_time, slot.end_time)
    );

    if (classConflicts.length > 0) {
      const requestedAttendees = attendees ? Number(attendees) : 1;
      const { data: allRooms } = await supabase
        .from("rooms")
        .select("id, name, capacity, status")
        .in("status", ["active", "available"])
        .gte("capacity", requestedAttendees);
      const { data: booked } = await supabase
        .from("bookings")
        .select("room_id")
        .eq("slot_id", Number(slot_id))
        .eq("booking_date", booking_date)
        .not("status", "in", '("cancelled","rejected")');

      const bookedRoomIds = new Set((booked ?? []).map(b => b.room_id));
      const busyRoomNames = new Set(
        effective
          .filter(s => overlaps(s.start_time, s.end_time, slot.start_time, slot.end_time))
          .map(s => s.room_name)
      );
      const suggestions = (allRooms ?? [])
        .filter(r => r.id !== room_id && !bookedRoomIds.has(r.id) && !busyRoomNames.has(r.name))
        .sort((a, b) => a.capacity - b.capacity)
        .map(r => r.name);

      return NextResponse.json({
        status: "class_conflict",
        message: classConflictMessage(room.name, slot, classConflicts, suggestions),
        suggestions,
      }, { status: 409 });
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

    const { data: booking, error } = await supabase.from("bookings").insert({
      room_id,
      slot_id: Number(slot_id),
      booking_date,
      student_id: student_id.trim(),
      student_name: student_name.trim(),
      student_phone: student_phone?.trim() || null,
      purpose: purpose.trim(),
      attendees: attendees ? Number(attendees) : 1,
    }).select("id").single();

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    try {
      const { data: student } = await (supabase as any)
        .from("students")
        .select("photo_url, nickname, program, department")
        .eq("student_id", student_id.trim())
        .maybeSingle();
      await sendLineFlexMessage(
        process.env.LINE_GROUP_ADMIN ?? "",
        `📅 คำขอจองห้องใหม่: ${room.name} — ${student_name.trim()}`,
        buildBookingFlexMessage({
          bookingId: booking?.id ?? null,
          roomName: room.name,
          studentName: student_name.trim(),
          studentId: student_id.trim(),
          studentPhotoUrl: student?.photo_url ?? null,
          nickname: student?.nickname ?? null,
          program: student?.program ?? null,
          department: student?.department ?? null,
          bookingDate: booking_date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          attendees: attendees ? Number(attendees) : 1,
          phone: student_phone?.trim() || null,
          purpose: purpose.trim().split("\n")[0],
          status: "pending",
        })
      );
    } catch (e) {
      console.error("[LINE] booking admin notify failed:", e);
    }

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("[api/bookings] post failed:", error);
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
      .select("id, room_id, booking_date, slot_id, student_name, purpose, status, attendees")
      .not("status", "in", '("cancelled","rejected")')
      .order("slot_id");

    if (room_id) query = query.eq("room_id", room_id);
    if (date) query = query.eq("booking_date", date);

    const { data, error } = await query;
    if (error) {
      console.error("[api/bookings] get failed:", error.message);
      return NextResponse.json({ status: "success", data: [] });
    }

    let merged = data ?? [];
    if (room_id && date) {
      const [roomRes, slotsRes] = await Promise.all([
        supabase.from("rooms").select("name").eq("id", room_id).single(),
        supabase.from("time_slots").select("id, label, start_time, end_time"),
      ]);
      if (!roomRes.error && roomRes.data && !slotsRes.error) {
        let effective: ScheduleRow[] = [];
        try {
          effective = await getEffectiveSchedulesForDate(date);
        } catch (scheduleError) {
          console.error("[api/bookings] class busy overlay skipped:", scheduleError);
        }
        const classBusySlots = ((slotsRes.data ?? []) as TimeSlotRow[])
          .filter(slot => effective.some(s =>
            s.room_name === roomRes.data.name && overlaps(s.start_time, s.end_time, slot.start_time, slot.end_time)
          ))
          .map(slot => {
            const matched = effective.find(s =>
              s.room_name === roomRes.data.name && overlaps(s.start_time, s.end_time, slot.start_time, slot.end_time)
            );
            return {
              id: `class-${slot.id}`,
              slot_id: slot.id,
              student_name: "ตารางเรียนปกติ",
              purpose: matched?.subject ?? "มีการเรียนตามตาราง",
              status: "approved",
              attendees: null,
            };
          });
        merged = [...merged, ...classBusySlots] as any;
      }
    }

    return NextResponse.json({ status: "success", data: merged });
  } catch (error) {
    console.error("[api/bookings] get failed:", error);
    return NextResponse.json({ status: "success", data: [] });
  }
}
