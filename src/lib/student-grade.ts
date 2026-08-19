/* ── สูตรคำนวณที่ใช้ร่วมกันทั้งระบบ ─────────────────────────────────────────
   เดิม calcGrade ถูกก๊อปไว้ทั้งใน shop/page.tsx และ student/page.tsx
   ย้ายมาไว้ที่เดียวกันเพื่อไม่ให้สูตรเพี้ยนกันเวลามีคนแก้ที่ใดที่หนึ่ง
   -------------------------------------------------------------------------- */

/** ปีการศึกษาปัจจุบันเป็น พ.ศ. — ปีการศึกษาเริ่มเดือนพฤษภาคม */
export function currentAcademicYear(now: Date = new Date()): number {
  const month = now.getMonth() + 1;
  return now.getFullYear() + 543 - (month < 5 ? 1 : 0);
}

/**
 * คำนวณชั้นปีจากระดับ + ปีที่เข้าเรียน เช่น ปวช เข้าปี 2567 ปีนี้ 2568 → "ปวช2"
 * ปวช เรียน 3 ปี ปวส เรียน 2 ปี เกินจากนั้นถือว่าจบแล้ว
 */
export function calcGrade(program: string, entryYear: number | string | null, now: Date = new Date()): string {
  const yr = typeof entryYear === "number" ? entryYear : parseInt(String(entryYear ?? "0"));
  if (!yr) return program || "";
  const diff = currentAcademicYear(now) - yr + 1;
  const maxYr = program === "ปวส" ? 2 : 3;
  if (diff < 1)      return `${program} (รอเข้าเรียน)`;
  if (diff > maxYr)  return `${program} (จบการศึกษา)`;
  return `${program}${diff}`;
}

/** อายุเต็มปีและเศษเดือนจากวันเกิด คืน null ถ้าวันเกิดไม่ถูกต้องหรือเป็นอนาคต */
export function calcAge(birthDate: string, now: Date = new Date()): { years: number; months: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > now) return null;

  let years  = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return null;

  return { years, months };
}

/** อายุแบบข้อความไทย เช่น "17 ปี 5 เดือน" */
export function formatAge(birthDate: string, now: Date = new Date()): string {
  const age = calcAge(birthDate, now);
  if (!age) return "";
  return age.months > 0 ? `${age.years} ปี ${age.months} เดือน` : `${age.years} ปี`;
}

/* ── เกณฑ์อายุของผู้สมัคร ─────────────────────────────────────────────────
   ใช้ร่วมกันทั้งฟอร์มและ API เพื่อไม่ให้เกณฑ์สองฝั่งเพี้ยนกัน
   -------------------------------------------------------------------------- */

export const MIN_AGE = 14;
export const MAX_AGE = 60;

/** yyyy-mm-dd ตามเวลาเครื่องผู้ใช้ (ห้ามใช้ toISOString เพราะเป็น UTC จะเพี้ยนไป 1 วัน) */
function toLocalISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * ช่วงวันเกิดที่เลือกได้ ให้ปฏิทินเบราว์เซอร์เกรย์วันที่นอกช่วงทิ้งไปเลย
 * max = วันที่ทำให้อายุครบ MIN_AGE พอดี, min = วันที่ทำให้อายุ MAX_AGE พอดี
 */
export function birthDateBounds(now: Date = new Date()): { min: string; max: string } {
  const max = new Date(now); max.setFullYear(max.getFullYear() - MIN_AGE);
  const min = new Date(now); min.setFullYear(min.getFullYear() - MAX_AGE);
  return { min: toLocalISODate(min), max: toLocalISODate(max) };
}
