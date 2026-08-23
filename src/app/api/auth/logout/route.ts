import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, revokeSession, sessionCookieOptions } from "@/lib/server/session";

/**
 * ออกจากระบบ — เพิกถอน session ฝั่งเซิร์ฟเวอร์ ไม่ใช่แค่ลบคุกกี้
 *
 * เดิมการออกจากระบบของนักเรียนคือลบ localStorage ทิ้งฝั่งเบราว์เซอร์อย่างเดียว
 * พอมี Mycer ที่ยืนยันตัวตนด้วยคุกกี้ httpOnly วิธีนั้นใช้ไม่ได้แล้ว — ถ้าลบ
 * แต่คุกกี้ แถวใน auth_sessions ยังใช้ได้อีก 7 วัน ใครที่ก๊อปคุกกี้ไปก่อนหน้า
 * (เครื่องสาธารณะในห้องคอม) ก็ยังเข้าแฟ้มของเจ้าของตัวจริงได้ต่อ
 *
 * ตอบ success เสมอแม้ไม่มีคุกกี้ เพราะปลายทางเดียวกันคือ "ตอนนี้ไม่ได้ล็อกอิน"
 * และการแยก error ให้แค่บอกใบ้ว่ามี session อยู่จริงหรือไม่
 */
export async function POST() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await revokeSession(token);
  }

  const res = NextResponse.json({ status: "success" });
  // ลบด้วย options ชุดเดียวกับตอนตั้ง — ถ้า domain ไม่ตรง เบราว์เซอร์จะมองว่า
  // เป็นคุกกี้คนละใบแล้วปล่อยใบเดิมค้างไว้บนซับโดเมน
  res.cookies.set({ ...sessionCookieOptions(new Date(0)), value: "", maxAge: 0 });
  return res;
}
