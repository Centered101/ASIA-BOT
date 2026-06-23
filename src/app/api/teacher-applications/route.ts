import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Public endpoint — ไม่ต้องล็อกอิน
export async function POST(req: NextRequest) {
  const { full_name, email, phone, department, subject, reason, desired_username } = await req.json();

  if (!full_name?.trim())        return NextResponse.json({ status: "error", message: "กรุณากรอกชื่อ-นามสกุล" }, { status: 400 });
  if (!reason?.trim())           return NextResponse.json({ status: "error", message: "กรุณากรอกเหตุผลที่สมัคร" }, { status: 400 });
  if (!desired_username?.trim()) return NextResponse.json({ status: "error", message: "กรุณากรอก username ที่ต้องการ" }, { status: 400 });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(desired_username.trim()))
    return NextResponse.json({ status: "error", message: "Username: a-z, 0-9, _ ยาว 3-20 ตัว" }, { status: 400 });

  // กันส่งซ้ำขณะยังรอตรวจสอบ
  const { data: existing } = await supabase
    .from("teachers")
    .select("id")
    .in("status", ["pending", "reviewing"])
    .eq("desired_username", desired_username.trim().toLowerCase())
    .maybeSingle();
  if (existing)
    return NextResponse.json({ status: "error", message: "Username นี้มีใบสมัครรอตรวจสอบอยู่แล้ว" }, { status: 409 });

  const { error } = await supabase.from("teachers").insert({
    full_name:        full_name.trim(),
    email:            email?.trim()      || null,
    phone:            phone?.trim()      || null,
    department:       department?.trim() || null,
    subject:          subject?.trim()    || null,
    reason:           reason.trim(),
    desired_username: desired_username.trim().toLowerCase(),
    status:           "pending",
  });

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
