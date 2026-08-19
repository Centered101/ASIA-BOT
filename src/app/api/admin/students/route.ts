import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";
import { checkBirthDate, checkGender, checkNationalId } from "@/lib/student-validate";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cardStatus = searchParams.get("card_status");
  const search = searchParams.get("q");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("students") as any)
    .select("id, student_id, first_name, last_name, nickname, program, department, entry_year, student_phone, uid, photo_url, card_status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (cardStatus && cardStatus !== "all") query = query.eq("card_status", cardStatus);
  if (search) query = query.or(`student_id.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}

export async function POST(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const {
    student_id, first_name, last_name, nickname, program, department, entry_year, student_phone,
    birth_date, gender, national_id, address,
  } = await req.json();

  if (!student_id?.trim() || !first_name?.trim() || !last_name?.trim() || !program?.trim() || !entry_year?.trim() || !student_phone?.trim())
    return NextResponse.json({ status: "error", message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบ" }, { status: 400 });

  // สี่ช่องนี้ไม่บังคับ ตรวจเฉพาะตอนที่กรอกมา ใช้กฎชุดเดียวกับหน้าสมัคร
  const cleanNationalId = String(national_id ?? "").replace(/\D/g, "");
  if (cleanNationalId) {
    const nidErr = checkNationalId(cleanNationalId);
    if (nidErr) return NextResponse.json({ status: "error", message: nidErr }, { status: 400 });
  }
  if (birth_date) {
    const bdErr = checkBirthDate(String(birth_date));
    if (bdErr) return NextResponse.json({ status: "error", message: bdErr }, { status: 400 });
  }
  const genderErr = checkGender(String(gender ?? ""));
  if (genderErr) return NextResponse.json({ status: "error", message: genderErr }, { status: 400 });

  const { data: existing } = await supabase.from("students").select("id").eq("student_id", student_id.trim()).maybeSingle();
  if (existing) return NextResponse.json({ status: "error", message: "รหัสนักเรียนนี้มีอยู่แล้ว" }, { status: 409 });

  const { error } = await supabase.from("students").insert({
    student_id: student_id.trim(),
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    nickname: nickname?.trim() || null,
    program: program.trim(),
    department: department?.trim() || null,
    entry_year: entry_year.trim(),
    student_phone: student_phone.trim(),
    birth_date: birth_date ? String(birth_date) : null,
    gender: gender ? (String(gender) as "male" | "female" | "other") : null,
    national_id: cleanNationalId || null,
    address: address?.trim() || null,
    card_status: "active",
  });

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success" });
}
