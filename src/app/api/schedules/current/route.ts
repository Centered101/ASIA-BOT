import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function bangkokToday() {
  const thNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  return {
    thNow,
    date: `${thNow.getFullYear()}-${String(thNow.getMonth() + 1).padStart(2, "0")}-${String(thNow.getDate()).padStart(2, "0")}`,
    time: `${String(thNow.getHours()).padStart(2, "0")}:${String(thNow.getMinutes()).padStart(2, "0")}:00`,
  };
}

function dayOfWeekFromDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    parsed.getUTCFullYear() !== Number(y) ||
    parsed.getUTCMonth() !== Number(m) - 1 ||
    parsed.getUTCDate() !== Number(d)
  ) return null;
  const jsDay = parsed.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const today = bangkokToday();
    const selectedDate = searchParams.get("date") || today.date;
    const dayOfWeek = dayOfWeekFromDate(selectedDate);

    if (!dayOfWeek) {
      return NextResponse.json({ status: "error", message: "รูปแบบวันที่ไม่ถูกต้อง" }, { status: 400 });
    }

    const isToday = selectedDate === today.date;
    const currentTime = isToday ? today.time : null;

    const [schedRes, overrideRes] = await Promise.all([
      supabase
        .from("class_schedules")
        .select("*, class_groups(id, name, program, department, color, grade, section)")
        .eq("day_of_week", dayOfWeek)
        .order("start_time", { ascending: true }),
      supabase
        .from("class_schedule_overrides")
        .select("*")
        .eq("override_date", selectedDate),
    ]);

    if (schedRes.error) {
      console.error("[api/schedules/current] failed:", schedRes.error.message);
      return NextResponse.json({ status: "success", data: [], meta: { dayOfWeek, currentTime, selectedDate, today: today.date, isToday } });
    }

    // Build lookup: "class_group_id:start_time" → override row
    type ORow = { room_name: string | null; subject: string | null; teacher: string | null; note: string | null };
    const overrideMap = new Map<string, ORow>();
    for (const o of overrideRes.data ?? []) {
      overrideMap.set(`${o.class_group_id}:${o.start_time}`, o);
    }

    const schedule = (schedRes.data ?? []).map(s => {
      const override = overrideMap.get(`${s.class_group_id}:${s.start_time}`);
      const is_cancelled = override ? override.room_name === null : false;
      const has_override = !!override && override.room_name !== null;
      return {
        ...s,
        room_name:     has_override ? override!.room_name! : s.room_name,
        subject:       override?.subject  ?? s.subject,
        teacher:       override?.teacher  ?? s.teacher,
        original_room: has_override ? s.room_name : null,   // เก็บห้องเดิมไว้แสดง
        is_cancelled,
        has_override,
        override_note: override?.note ?? null,
        is_current:    !!currentTime && !is_cancelled && s.start_time <= currentTime && s.end_time > currentTime,
      };
    });

    return NextResponse.json({ status: "success", data: schedule, meta: { dayOfWeek, currentTime, selectedDate, today: today.date, isToday } });
  } catch (error) {
    console.error("[api/schedules/current] failed:", error);
    return NextResponse.json({ status: "success", data: [] });
  }
}
