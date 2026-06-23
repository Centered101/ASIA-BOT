import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";
import { sendLineFlexMessage, buildBookingFlexMessage } from "@/lib/line";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const allowed = ["pending", "approved", "rejected", "cancelled"] as const;
  const update: { status?: typeof allowed[number]; admin_note?: string | null; updated_at?: string } = {};

  if (body.status && allowed.includes(body.status)) update.status = body.status;
  if ("admin_note" in body) update.admin_note = body.admin_note ?? null;
  if (Object.keys(update).length === 0) return NextResponse.json({ status: "error", message: "ไม่มีข้อมูลที่จะอัปเดต" }, { status: 400 });

  update.updated_at = new Date().toISOString();

  const { error } = await supabase.from("bookings").update(update).eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  // Push LINE notification to student on approve/reject
  if (update.status === "approved" || update.status === "rejected") {
    try {
      const { data: booking } = await (supabase as any)
        .from("bookings")
        .select("*, rooms(name), time_slots(start_time, end_time)")
        .eq("id", id)
        .maybeSingle();

      if (booking) {
        const { data: student } = await (supabase as any)
          .from("students")
          .select("line_user_id, program, department, nickname, photo_url")
          .eq("student_id", booking.student_id)
          .maybeSingle();

        if (student?.line_user_id) {
          const room = booking.rooms as any;
          const slot = booking.time_slots as any;
          const flex = buildBookingFlexMessage({
            bookingId:      booking.id,
            roomName:       room?.name ?? "ห้องที่จอง",
            studentName:    booking.student_name,
            studentId:      booking.student_id,
            studentPhotoUrl: student.photo_url ?? null,
            nickname:       student.nickname ?? null,
            program:        student.program ?? null,
            department:     student.department ?? null,
            bookingDate:    booking.booking_date,
            startTime:      slot?.start_time ?? "?",
            endTime:        slot?.end_time   ?? "?",
            attendees:      booking.attendees,
            phone:          booking.student_phone ?? null,
            purpose:        booking.purpose,
            status:         update.status,
          });
          await sendLineFlexMessage(
            student.line_user_id,
            update.status === "approved" ? "การจองห้องได้รับอนุมัติแล้ว ✅" : "การจองห้องถูกปฏิเสธ 🚫",
            flex
          );
        }
      }
    } catch { /* LINE notification is non-critical */ }
  }

  return NextResponse.json({ status: "success" });
}
