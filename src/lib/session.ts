import { SESSION_KEY, SESSION_TIME_KEY, SESSION_TTL } from "./config";

export type StudentSession = {
  student_id: string;
  first_name: string;
  last_name: string;
  nickname?: string | null;
  program: string;
  entry_year: number | string;
  department: string;
  student_phone?: string | null;
  photo_url?: string | null;
  // login เก็บทั้งแถวจากตาราง students ลง localStorage อีเมลจึงติดมาด้วยอยู่แล้ว
  google_email?: string | null;
  // เก็บเป็น male/female/other ตามคอลัมน์ใน DB ไม่ใช่ข้อความไทย
  gender?: string | null;
};

export function getStudentSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw  = localStorage.getItem(SESSION_KEY);
    const time = localStorage.getItem(SESSION_TIME_KEY);
    if (!raw || !time) return null;
    if (Date.now() - new Date(time).getTime() > SESSION_TTL) {
      clearStudentSession();
      return null;
    }
    return JSON.parse(raw) as StudentSession;
  } catch { return null; }
}

export function clearStudentSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TIME_KEY);
  } catch { /* silent */ }
}
