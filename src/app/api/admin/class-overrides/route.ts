import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });
  const date = new URL(req.url).searchParams.get("date");
  if (!date) return NextResponse.json({ status: "error", message: "ต้องระบุ date" }, { status: 400 });
  const { data, error } = await supabase
    .from("class_schedule_overrides")
    .select("*, class_groups(id, name, color)")
    .eq("override_date", date)
    .order("start_time");
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function POST(req: NextRequest) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin"])) return NextResponse.json({ status: "error", message: "forbidden" }, { status: 403 });
  const { override_date, class_group_id, start_time, end_time, room_name, subject, teacher, note } = await req.json();
  if (!override_date || !class_group_id || !start_time || !end_time)
    return NextResponse.json({ status: "error", message: "ข้อมูลไม่ครบ" }, { status: 400 });

  const { data, error } = await supabase
    .from("class_schedule_overrides")
    .upsert(
      {
        override_date,
        class_group_id,
        start_time,
        end_time,
        room_name: room_name?.trim() || null,
        subject: subject?.trim() || null,
        teacher: teacher?.trim() || null,
        note: note?.trim() || null,
      },
      { onConflict: "override_date,class_group_id,start_time" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}
