import "server-only";
import { getServiceClient } from "./supabase-server";
import type { Principal } from "./session";

/**
 * "รหัสนักเรียนของคนที่กำลังเรียกอยู่" คืออะไร
 *
 * ตอบไม่ได้ด้วย principal.subjectId อย่างเดียว เพราะคนที่เป็นทั้งครู/เจ้าหน้าที่
 * และนักเรียนจะมี user_accounts ใบเดียวที่ subject_type = "admin" (ดู 0010 —
 * หนึ่งคนหนึ่งบัญชี ไม่งั้น audit log แตกเป็นสองสาย) พอ resolve ออกมาเป็น
 * admin ตัว subjectId ที่ได้จึงเป็น admin_id ไม่ใช่รหัสนักเรียน
 *
 * ผลที่เกิดขึ้นจริงก่อนมีไฟล์นี้: บัญชีที่ผูกกันอยู่เปิดหน้า /my-profile ของ
 * ตัวเองแล้วได้ 403 "บัญชีนี้ไม่ใช่นักเรียน" ทั้งที่มีแฟ้มนักเรียนอยู่จริง
 * และเป็นเจ้าของข้อมูลนั้นเอง
 *
 * คืน null เมื่อบัญชีนั้นไม่มีโปรไฟล์นักเรียนผูกอยู่จริง ๆ — ตรงนั้นค่อยตอบ 403
 */
export async function resolveOwnStudentId(principal: Principal): Promise<string | null> {
  if (principal.subjectType === "student") return principal.subjectId;
  if (principal.subjectType !== "admin") return null;

  const { data } = await getServiceClient()
    .from("admins")
    .select("linked_student_id")
    .eq("admin_id", principal.subjectId)
    .maybeSingle();

  return data?.linked_student_id ?? null;
}
