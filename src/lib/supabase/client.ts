import { getGoogleSupabase } from "@/lib/supabase-google";

/**
 * Supabase client ฝั่งเบราว์เซอร์ สำหรับปุ่ม "เข้าสู่ระบบด้วย Google" ของ Mycer
 *
 * ชื่อไฟล์กับชื่อฟังก์ชันคงไว้ตามที่ LoginForm ของ asia-mycer เรียกใช้ จะได้ไม่ต้อง
 * ไปแก้ในตัว component แต่ข้างในคืน client ตัวเดียวกับที่ asia-bot ใช้อยู่แล้ว
 *
 * ที่ต้องเป็นตัวเดียวกันเพราะ OAuth ใช้ PKCE: client ที่ "เริ่ม" flow เป็นคนเก็บ
 * code verifier ไว้ ถ้าหน้า callback ใช้ client คนละตัว (คนละ storageKey) มันจะ
 * หา verifier ไม่เจอ แล้วการแลกโค้ดจะล้มทุกครั้ง — ต้นฉบับใช้ createBrowserClient
 * ของ @supabase/ssr ซึ่งเก็บลงคุกกี้ ส่วน asia-bot เก็บลง localStorage คนละที่กัน
 */
export function createClient() {
  return getGoogleSupabase();
}
