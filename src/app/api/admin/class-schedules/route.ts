import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("group_id");
  let q = supabase
    .from("class_schedules")
    .select("*, class_groups(id, name, color)")
    .order("day_of_week").order("start_time");
  if (groupId) q = q.eq("class_group_id", groupId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function POST(req: NextRequest) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
  const { class_group_id, room_name, subject, teacher, day_of_week, start_time, end_time } = await req.json();
  if (!class_group_id || !room_name?.trim() || !day_of_week || !start_time || !end_time)
    return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });
  if (start_time >= end_time)
    return NextResponse.json({ status: "error", message: "เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด" }, { status: 400 });
  const { data, error } = await supabase.from("class_schedules")
    .insert({ class_group_id, room_name: room_name.trim(), subject: subject || null, teacher: teacher || null, day_of_week: Number(day_of_week), start_time, end_time })
    .select().single();
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}
