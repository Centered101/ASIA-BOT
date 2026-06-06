import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const thNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const jsDay = thNow.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;
    const currentTime = `${String(thNow.getHours()).padStart(2, "0")}:${String(thNow.getMinutes()).padStart(2, "0")}:00`;
    const todayDate = `${thNow.getFullYear()}-${String(thNow.getMonth() + 1).padStart(2, "0")}-${String(thNow.getDate()).padStart(2, "0")}`;

    const [schedRes, overrideRes] = await Promise.all([
      supabase
        .from("class_schedules")
        .select("*, class_groups(id, name, program, department, color, grade, section)")
        .eq("day_of_week", dayOfWeek)
        .order("start_time", { ascending: true }),
      supabase
        .from("class_schedule_overrides")
        .select("*")
        .eq("override_date", todayDate),
    ]);

    if (schedRes.error) {
      console.error("[api/schedules/current] failed:", schedRes.error.message);
      return NextResponse.json({ status: "success", data: [], meta: { dayOfWeek, currentTime, today: todayDate } });
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
        is_current:    !is_cancelled && s.start_time <= currentTime && s.end_time > currentTime,
      };
    });

    return NextResponse.json({ status: "success", data: schedule, meta: { dayOfWeek, currentTime, today: todayDate } });
  } catch (error) {
    console.error("[api/schedules/current] failed:", error);
    return NextResponse.json({ status: "success", data: [] });
  }
}
