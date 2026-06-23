import { SupabaseClient } from "@supabase/supabase-js";
import {
  replyLineMessage,
  sendLineFlexMessage,
  buildBookingFlexMessage,
} from "@/lib/line";

export async function handleAdminGroupMessage(
  supabase: SupabaseClient,
  text: string,
  replyToken: string
) {
  const t = text.trim();

  // ── อนุมัติ [booking_id_suffix] ──────────────────────────────────────────
  const approveMatch = t.match(/^อนุมัติ\s+([A-Za-z0-9-]+)$/i);
  if (approveMatch) {
    await updateBookingFromAdmin(supabase, approveMatch[1], "approved", null, replyToken);
    return;
  }

  // ── ปฏิเสธ [booking_id_suffix] [note] ───────────────────────────────────
  const rejectMatch = t.match(/^ปฏิเสธ\s+([A-Za-z0-9-]+)(?:\s+(.+))?$/i);
  if (rejectMatch) {
    await updateBookingFromAdmin(supabase, rejectMatch[1], "rejected", rejectMatch[2] ?? null, replyToken);
    return;
  }

  // ── สรุปวันนี้ ─────────────────────────────────────────────────────────────
  if (t === "สรุปวันนี้" || t === "สรุป" || t === "รายงาน") {
    await handleDailySummary(supabase, replyToken);
    return;
  }

  // ── ฟีดแบ็กใหม่ ──────────────────────────────────────────────────────────
  if (t === "ฟีดแบ็กใหม่" || t === "feedback" || t === "ฟีดแบ็ก") {
    await handlePendingFeedback(supabase, replyToken);
    return;
  }

  // "รับเรื่อง Feedback #id" is handled in the main webhook before reaching here
}

async function updateBookingFromAdmin(
  supabase: SupabaseClient,
  idHint: string,
  status: "approved" | "rejected",
  note: string | null,
  replyToken: string
) {
  // idHint can be a full UUID or last 6 chars
  let bookingId = idHint;
  if (idHint.length < 36) {
    const { data: rows } = await (supabase as any)
      .from("bookings")
      .select("id")
      .ilike("id", `%${idHint}`);
    if (!rows || rows.length === 0) {
      await replyLineMessage(replyToken, [{ type: "text", text: `ไม่พบ Booking #${idHint}` }]);
      return;
    }
    bookingId = rows[0].id;
  }

  const update: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (note) update.admin_note = note;

  const { error } = await (supabase as any).from("bookings").update(update).eq("id", bookingId);
  if (error) {
    await replyLineMessage(replyToken, [{ type: "text", text: `เกิดข้อผิดพลาด: ${error.message}` }]);
    return;
  }

  // Notify student via push
  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("*, rooms(name), time_slots(start_time, end_time)")
      .eq("id", bookingId)
      .maybeSingle();

    if (booking) {
      const { data: student } = await (supabase as any)
        .from("students")
        .select("line_user_id, program, department, nickname, photo_url")
        .eq("student_id", booking.student_id)
        .maybeSingle();

      if (student?.line_user_id) {
        const room = (booking as any).rooms;
        const slot = (booking as any).time_slots;
        const flex = buildBookingFlexMessage({
          bookingId:      booking.id,
          roomName:       room?.name ?? "ห้อง",
          studentName:    booking.student_name,
          studentId:      booking.student_id,
          bookingDate:    booking.booking_date,
          startTime:      slot?.start_time ?? "?",
          endTime:        slot?.end_time   ?? "?",
          attendees:      booking.attendees,
          phone:          booking.student_phone ?? null,
          purpose:        booking.purpose,
          status,
          nickname:       student.nickname ?? null,
          program:        student.program ?? null,
          department:     student.department ?? null,
          studentPhotoUrl: student.photo_url ?? null,
        });
        await sendLineFlexMessage(
          student.line_user_id,
          status === "approved" ? "การจองห้องได้รับอนุมัติแล้ว ✅" : "การจองห้องถูกปฏิเสธ 🚫",
          flex
        );
      }
    }
  } catch { /* non-critical */ }

  const emoji = status === "approved" ? "✅" : "❌";
  await replyLineMessage(replyToken, [{
    type: "text",
    text: `${emoji} ${status === "approved" ? "อนุมัติ" : "ปฏิเสธ"} Booking #${bookingId.slice(-6).toUpperCase()} แล้ว${note ? `\n📝 ${note}` : ""}`,
  }]);
}

async function handleDailySummary(supabase: SupabaseClient, replyToken: string) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

  const [{ count: entryIn }, { count: entryOut }, { count: pendingBookings }, { count: pendingFeedback }, { count: orders }] = await Promise.all([
    (supabase as any).from("entry_logs").select("*", { count: "exact", head: true })
      .eq("action", "in").gte("scanned_at", `${today}T00:00:00+07:00`),
    (supabase as any).from("entry_logs").select("*", { count: "exact", head: true })
      .eq("action", "out").gte("scanned_at", `${today}T00:00:00+07:00`),
    (supabase as any).from("bookings").select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    (supabase as any).from("feedback").select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    (supabase as any).from("orders").select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00+07:00`),
  ]);

  const thDate = new Date(`${today}T12:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  await replyLineMessage(replyToken, [{
    type: "text",
    text: [
      `📊 สรุปประจำวัน ${thDate}`,
      ``,
      `👥 เข้าโรงเรียน: ${entryIn ?? 0} ครั้ง`,
      `🚶 ออกโรงเรียน: ${entryOut ?? 0} ครั้ง`,
      `📅 การจองรออนุมัติ: ${pendingBookings ?? 0} รายการ`,
      `💬 ฟีดแบ็กที่ยังไม่ได้ดู: ${pendingFeedback ?? 0} รายการ`,
      `🛒 ออเดอร์วันนี้: ${orders ?? 0} รายการ`,
      ``,
      `พิมพ์ "ฟีดแบ็กใหม่" เพื่อดูรายละเอียด`,
    ].join("\n"),
  }]);
}

async function handlePendingFeedback(supabase: SupabaseClient, replyToken: string) {
  const { data: feedbacks } = await (supabase as any)
    .from("feedback")
    .select("id, name, message, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!feedbacks || feedbacks.length === 0) {
    await replyLineMessage(replyToken, [{ type: "text", text: "ไม่มีฟีดแบ็กที่รอดูครับ 🎉" }]);
    return;
  }

  const lines = feedbacks.map((f: any, i: number) => {
    const time = new Date(f.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return `${i + 1}. [#${String(f.id).slice(-6)}] ${f.name}\n   ${f.message.slice(0, 60)}${f.message.length > 60 ? "…" : ""}\n   ${time}`;
  }).join("\n\n");

  await replyLineMessage(replyToken, [{
    type: "text",
    text: `💬 ฟีดแบ็กที่รอดู (${feedbacks.length} รายการ)\n\n${lines}`,
  }]);
}
