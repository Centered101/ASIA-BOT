import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const cardsResult = await (supabase as any)
      .from("rfid_cards")
      .select("uid, student_id, students(first_name, last_name, nickname)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1000);

    const missingRfidCardsTable = cardsResult.error?.code === "42P01" || /rfid_cards/i.test(cardsResult.error?.message ?? "");

    if (!cardsResult.error) {
      const data = (cardsResult.data ?? []).map((card: any) => {
        const student = Array.isArray(card.students) ? card.students[0] : card.students;
        const firstName = student?.first_name ?? "";
        const lastName = student?.last_name ?? "";
        return {
          uid: card.uid,
          student_id: card.student_id,
          name: `${firstName} ${lastName}`.trim(),
          nickname: student?.nickname ?? "",
        };
      });

      return NextResponse.json({ status: "success", data });
    }

    if (!missingRfidCardsTable) {
      return NextResponse.json({ status: "error", message: cardsResult.error.message }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("students")
      .select("uid, student_id, first_name, last_name, nickname")
      .eq("card_status", "active")
      .not("uid", "is", null)
      .limit(1000);

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    return NextResponse.json({
      status: "success",
      data: (data ?? []).map(student => ({
        uid: student.uid,
        student_id: student.student_id,
        name: `${student.first_name} ${student.last_name}`.trim(),
        nickname: student.nickname ?? "",
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
