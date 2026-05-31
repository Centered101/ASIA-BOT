import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const location = searchParams.get("location");
    const studentId = searchParams.get("student_id")?.trim() ?? "";
    const studentPhone = searchParams.get("student_phone")?.trim() ?? "";

    if (!studentId || !studentPhone) {
      return NextResponse.json({ status: "error", message: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 });
    }

    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("student_id, student_phone")
      .eq("student_id", studentId)
      .eq("student_phone", studentPhone)
      .maybeSingle();

    if (studentError) return NextResponse.json({ status: "error", message: studentError.message }, { status: 500 });
    if (!student) return NextResponse.json({ status: "error", message: "session ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });

    let query = supabase
      .from("attendance")
      .select("*, students(first_name, last_name, nickname, program, department, student_id, photo_url)")
      .eq("student_id", studentId)
      .order("checkin_time", { ascending: false })
      .limit(120);

    if (date) {
      query = query.gte("checkin_time", `${date}T00:00:00`)
                   .lte("checkin_time", `${date}T23:59:59`);
    }

    if (location && location !== "all") {
      query = query.eq("location", location as "school" | "library" | "meeting");
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    return NextResponse.json({ status: "success", data: data ?? [] });
  } catch {
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}
