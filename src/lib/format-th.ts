/**
 * จัดรูปแบบวันที่แบบไทย — ที่เดียว
 *
 * ในโปรเจกต์มี toLocaleDateString("th-TH", {...}) กระจายอยู่ 36 จุด โดยใส่
 * ตัวเลือกไม่เหมือนกัน บางที่ได้ "28 พ.ย. 2551" บางที่ได้ "28/11/2551"
 * และบางที่โชว์ค่าดิบจากฐานเป็น "2008-11-28" ไปเลย
 *
 * สองเรื่องที่พลาดง่ายและรวมไว้ที่นี่แล้ว:
 *
 * 1. **เขตเวลา** — คอลัมน์ date ในฐานเป็นข้อความ "YYYY-MM-DD" ถ้าส่งเข้า
 *    new Date() ตรง ๆ จะถูกอ่านเป็นเที่ยงคืน UTC พอแปลงกลับเป็นเวลาไทย (+7)
 *    ยังเป็นวันเดิม แต่ถ้าเครื่องผู้ใช้อยู่โซนลบ (เช่นอเมริกา) จะกลายเป็น
 *    วันก่อนหน้า วันเกิดจึงเลื่อนไปหนึ่งวัน — ต่อ T12:00:00 กันไว้
 *
 * 2. **พ.ศ.** — locale th-TH ใช้ปฏิทินพุทธอยู่แล้ว จึงไม่ต้อง +543 เอง
 *    การบวกเองซ้ำเป็นบั๊กที่เจอบ่อยและทำให้ปีเพี้ยนไป 543 ปี
 */

/** วันที่จากคอลัมน์ date ("YYYY-MM-DD") → "28 พ.ย. 2551" */
export function thaiDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = toDate(value);
  if (!d) return value;
  return d.toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
  });
}

/** แบบยาวสำหรับหน้าที่มีที่ว่าง → "28 พฤศจิกายน 2551" */
export function thaiDateLong(value: string | null | undefined): string {
  if (!value) return "—";
  const d = toDate(value);
  if (!d) return value;
  return d.toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok",
  });
}

/** timestamp → "28 พ.ย. 2551 14:30" */
export function thaiDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = toDate(value);
  if (!d) return value;
  return d.toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok",
  });
}

/**
 * อายุเป็นปี — คิดจากวันเกิด ใช้คู่กับวันเกิดในแฟ้มนักเรียน
 * คืน null ถ้าวันที่ใช้ไม่ได้ ผู้เรียกจะได้เลือกเองว่าจะซ่อนหรือแสดงอะไรแทน
 */
export function ageFrom(value: string | null | undefined, now: Date = new Date()): number | null {
  const d = toDate(value);
  if (!d) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 150 ? age : null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // เติมเวลาเที่ยงให้ค่าที่เป็นวันที่ล้วน กันวันเลื่อนตามเขตเวลาของเครื่องผู้ใช้
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}
