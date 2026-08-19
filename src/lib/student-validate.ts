/* ── กฎตรวจข้อมูลประจำตัวนักเรียน ─────────────────────────────────────────
   ใช้ร่วมกัน 3 ที่: ฟอร์มสมัคร /register, หน้าแก้ไขข้อมูลใน /student
   และ API ฝั่งเซิร์ฟเวอร์ กฎต้องเป็นชุดเดียวกันเสมอ ไม่งั้นผ่านหน้าเว็บ
   แต่ไปตกที่ API (หรือแย่กว่านั้นคือหลุดเข้า DB)
   -------------------------------------------------------------------------- */

import { MAX_AGE, MIN_AGE, calcAge } from "@/lib/student-grade";

/** ตรวจ checksum หลักที่ 13 ของเลขประจำตัวประชาชนไทย */
export function isValidThaiNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id) || /^(\d)\1+$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

/** คืนข้อความผิดพลาด หรือ null ถ้าผ่าน */
export function checkNationalId(raw: string): string | null {
  const id = raw.replace(/\D/g, "");
  if (id.length !== 13)          return "เลขประจำตัวประชาชนต้องมี 13 หลัก";
  if (/^(\d)\1+$/.test(id))      return "เลขประจำตัวประชาชนไม่ถูกต้อง (ซ้ำทั้งหมด)";
  if (!isValidThaiNationalId(id)) return "เลขประจำตัวประชาชนไม่ถูกต้อง";
  return null;
}

/** วันเกิดต้องอยู่ในอดีต และอายุอยู่ในช่วงที่รับสมัคร */
export function checkBirthDate(value: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "รูปแบบวันเกิดไม่ถูกต้อง";
  const age = calcAge(value, now);
  if (!age)                return "วันเกิดต้องไม่เป็นวันในอนาคต";
  if (age.years < MIN_AGE) return `ผู้สมัครต้องมีอายุอย่างน้อย ${MIN_AGE} ปี`;
  if (age.years > MAX_AGE) return "อายุไม่สมเหตุสมผล กรุณาตรวจสอบวันเกิด";
  return null;
}

export const GENDER_VALUES = ["male", "female", "other"] as const;
export const GENDER_LABELS: Record<string, string> = { male: "ชาย", female: "หญิง", other: "อื่น ๆ" };

export function checkGender(value: string): string | null {
  return value && !(value in GENDER_LABELS) ? "เพศไม่ถูกต้อง" : null;
}
