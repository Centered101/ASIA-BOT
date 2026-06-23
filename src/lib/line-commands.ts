import { SupabaseClient } from "@supabase/supabase-js";
import {
  replyLineMessage,
  buildHelpMenuFlex,
  buildEntryStatusFlex,
  buildBookingListFlex,
  buildOrderStatusFlex,
  buildScheduleTodayFlex,
} from "@/lib/line";
import { replyWithAI } from "@/lib/line-ai";

type Student = {
  student_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  program: string;
  department: string | null;
  photo_url?: string | null;
};

// Day of week in Bangkok (1=Mon … 7=Sun)
function bangkokDow(): number {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })).getDay();
  return d === 0 ? 7 : d;
}

export async function handleStudentMessage(
  supabase: SupabaseClient,
  student: Student,
  text: string,
  replyToken: string
) {
  const t = text.trim().toLowerCase();
  const displayName = student.nickname ?? student.first_name;

  // ── ช่วยเหลือ ──────────────────────────────────────────────────────────────
  if (t === "ช่วยเหลือ" || t === "help" || t === "คำสั่ง" || t === "menu") {
    await replyLineMessage(replyToken, [{
      type: "flex",
      altText: "ASIA-BOT — รายการคำสั่ง",
      contents: buildHelpMenuFlex(displayName),
    }]);
    return;
  }

  // ── สถานะ (check-in/out) ───────────────────────────────────────────────────
  if (t === "สถานะ" || t === "เช็คอิน" || t === "อยู่ที่ไหน" || t === "checkin") {
    const { data: entries } = await (supabase as any)
      .from("entry_logs")
      .select("action, scanned_at, location")
      .eq("student_id", student.student_id)
      .order("scanned_at", { ascending: false })
      .limit(5);

    if (!entries || entries.length === 0) {
      await replyLineMessage(replyToken, [{ type: "text", text: "ยังไม่มีประวัติการสแกนบัตรของคุณ" }]);
      return;
    }
    await replyLineMessage(replyToken, [{
      type: "flex",
      altText: "สถานะการเข้า-ออก",
      contents: buildEntryStatusFlex({ studentName: `${student.first_name} ${student.last_name}`, entries }),
    }]);
    return;
  }

  // ── ตาราง ──────────────────────────────────────────────────────────────────
  if (t === "ตาราง" || t === "ตารางเรียน" || t === "schedule") {
    const dow = bangkokDow();
    const { data: schedules } = await (supabase as any)
      .from("class_schedules")
      .select("start_time, end_time, room_name, subject, teacher, class_groups(name, color)")
      .eq("day_of_week", dow)
      .order("start_time");

    await replyLineMessage(replyToken, [{
      type: "flex",
      altText: "ตารางเรียนวันนี้",
      contents: buildScheduleTodayFlex({ dayOfWeek: dow, schedules: schedules ?? [] }),
    }]);
    return;
  }

  // ── การจอง ─────────────────────────────────────────────────────────────────
  if (t === "การจอง" || t === "จอง" || t === "booking" || t === "ห้อง") {
    const { data: bookings } = await (supabase as any)
      .from("bookings")
      .select("id, booking_date, purpose, status, rooms(name)")
      .eq("student_id", student.student_id)
      .order("booking_date", { ascending: false })
      .limit(3);

    await replyLineMessage(replyToken, [{
      type: "flex",
      altText: "การจองห้องของคุณ",
      contents: buildBookingListFlex({ studentName: `${student.first_name} ${student.last_name}`, bookings: bookings ?? [] }),
    }]);
    return;
  }

  // ── ออเดอร์ ────────────────────────────────────────────────────────────────
  if (t === "ออเดอร์" || t === "คำสั่งซื้อ" || t === "order" || t === "อาหาร") {
    const { data: order } = await (supabase as any)
      .from("orders")
      .select("order_id, items_json, total, status, created_at")
      .eq("student_id", student.student_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!order) {
      await replyLineMessage(replyToken, [{ type: "text", text: "ยังไม่มีคำสั่งซื้ออาหารของคุณ" }]);
      return;
    }
    const items = (Array.isArray(order.items_json) ? order.items_json : []) as { name: string; qty: number; price: number }[];
    await replyLineMessage(replyToken, [{
      type: "flex",
      altText: `ออเดอร์ล่าสุด — ${order.status}`,
      contents: buildOrderStatusFlex({
        studentName: `${student.first_name} ${student.last_name}`,
        orderId: order.order_id,
        items,
        total: order.total ?? 0,
        status: order.status,
        createdAt: order.created_at,
      }),
    }]);
    return;
  }

  // ── ฟีดแบ็ก [ข้อความ] ─────────────────────────────────────────────────────
  if (t.startsWith("ฟีดแบ็ก ") || t.startsWith("ฟีดแบค ") || t.startsWith("แจ้งปัญหา ") || t.startsWith("feedback ")) {
    const idx = text.indexOf(" ");
    const message = text.slice(idx + 1).trim();
    if (message.length < 5) {
      await replyLineMessage(replyToken, [{ type: "text", text: "กรุณาพิมพ์ข้อความให้ละเอียดขึ้นด้วยครับ/ค่ะ\nเช่น: ฟีดแบ็ก เครื่องปรับอากาศห้อง 201 เสีย" }]);
      return;
    }
    await (supabase as any).from("feedback").insert({
      student_id: student.student_id,
      name: `${student.first_name} ${student.last_name}`,
      type: "comment",
      message,
      status: "pending",
    });
    await replyLineMessage(replyToken, [{
      type: "text",
      text: `✅ ส่งฟีดแบ็กแล้ว!\nขอบคุณที่แจ้งให้ทราบครับ/ค่ะ 🙏\n\n"${message.slice(0, 80)}${message.length > 80 ? "…" : ""}"`,
    }]);
    return;
  }

  // ── AI fallback ────────────────────────────────────────────────────────────
  const aiReply = await replyWithAI(student, text);
  await replyLineMessage(replyToken, [{ type: "text", text: aiReply }]);
}
