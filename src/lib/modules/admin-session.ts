/**
 * session ของแอดมินฝั่ง client + ตัวห่อ fetch — แหล่งความจริงเดียว
 *
 * เดิมทุกหน้าที่อยู่นอก admin/page.tsx อ่าน localStorage เองแล้วแนบ
 * x-admin-id เองทีละจุด (6 หน้า 19 จุด) ปัญหาคือไม่มีที่ไหนดู 401 เลย
 * โค้ดเช็กแค่ `json.status === "success"` พอ session หมดอายุหรือค้างจาก
 * บัญชีที่ถูกลบไปแล้ว ทุก request จะได้ 401 แล้วหน้าก็ขึ้นว่างเปล่าเงียบ ๆ
 * ผู้ใช้เห็นแค่หน้าโล่ง ไม่มีอะไรบอกว่าต้องล็อกอินใหม่
 *
 * adminFetch จึงจับ 401 ที่จุดเดียว ล้าง session แล้วพากลับไปหน้าล็อกอิน
 *
 * ตัว header ยังเป็นของชั่วคราวตามนโยบาย AUTH_LEGACY_HEADER — วันที่เลิกใช้
 * จะแก้ที่ไฟล์นี้ที่เดียว ไม่ต้องไล่ 19 จุด
 */

export const ADMIN_SESSION_KEY = "asia_admin_session";
export const ADMIN_SESSION_TIME_KEY = "asia_admin_session_time";

export type AdminSession = {
  admin_id: string;
  role: string;
  /** ฝ่ายที่สังกัด — ว่างแปลว่าเห็นเมนูทุกฝ่าย (ดู nav-access.ts) */
  division?: string | null;
  username?: string;
  first_name?: string | null;
  nickname?: string | null;
  avatar?: string | null;
};

export function readAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AdminSession;
    // ไม่มี admin_id ก็ยิง API ไม่ได้อยู่ดี ถือว่าไม่มี session ดีกว่าปล่อยให้
    // ยิงไปแล้วได้ 401 ทุกครั้งโดยไม่รู้ว่าเพราะอะไร
    return s.admin_id ? s : null;
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_TIME_KEY);
  } catch { /* ลบไม่ได้ก็ยังพากลับไปหน้าล็อกอินอยู่ดี */ }
}

/** ล้าง session แล้วโหลดหน้าล็อกอินใหม่ทั้งหน้า เพื่อทิ้ง state ค้างใน memory ด้วย */
function bounceToLogin() {
  clearAdminSession();
  if (typeof window !== "undefined") window.location.replace("/admin");
}

/**
 * fetch ที่แนบ x-admin-id ให้เอง และเด้งออกเมื่อ session ใช้ไม่ได้
 *
 * 401 = ยืนยันตัวตนไม่ผ่าน (session ค้าง/ถูกลบ) → เด้งไปล็อกอิน
 * 403 = ตัวตนใช้ได้แต่ไม่มีสิทธิ์ → ปล่อยให้หน้าจัดการเอง เพราะการเด้ง
 *       ออกจากระบบเพราะกดปุ่มที่ไม่มีสิทธิ์เป็นพฤติกรรมที่แย่กว่าเดิม
 */
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = readAdminSession();
  if (!session) {
    bounceToLogin();
    // คืน Response ปลอมให้ caller อ่านต่อได้โดยไม่ต้องเช็ก null ทุกจุด
    // ระหว่างนี้เบราว์เซอร์กำลังเปลี่ยนหน้าอยู่แล้ว
    return new Response(JSON.stringify({ status: "error", message: "ยังไม่ได้เข้าสู่ระบบ" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = new Headers(init.headers);
  headers.set("x-admin-id", session.admin_id);

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) bounceToLogin();
  return res;
}

/**
 * ดึง role/ฝ่ายปัจจุบันจาก server มาทับของที่จำไว้
 *
 * role ถูกเก็บลง localStorage ตอนล็อกอินแล้วใช้ยาว 8 ชม. ถ้าระหว่างนั้นถูก
 * เปลี่ยนสิทธิ์ หน้าเว็บจะยังวาดเมนูและปุ่มตามสิทธิ์เก่า กดแล้วเจอ 403 เปล่า ๆ
 * โดยไม่มีอะไรบอกว่าทำไม (เคยเจอกับปุ่มลบกลุ่มเรียน — badge ขึ้น "ผู้ดูแลสูงสุด"
 * แต่ฐานข้อมูลเป็น staff) เรียกตอนเปิดหน้าเพื่อให้ UI ตรงกับสิทธิ์จริงเสมอ
 *
 * คืนค่า session ที่อัปเดตแล้ว หรือ null ถ้าถามไม่ได้ — ผู้เรียกใช้ของเดิมต่อได้
 */
export async function syncAdminSession(): Promise<AdminSession | null> {
  const current = readAdminSession();
  if (!current) return null;
  try {
    const res = await fetch("/api/admin/auth", { headers: { "x-admin-id": current.admin_id } });
    if (res.status === 401) { bounceToLogin(); return null; }
    if (!res.ok) return current;
    const json = await res.json();
    if (!json?.ok || !json.admin) return current;

    const fresh: AdminSession = {
      ...current,
      role: json.admin.role ?? current.role,
      division: json.admin.division ?? null,
    };
    if (fresh.role === current.role && fresh.division === (current.division ?? null)) return current;

    try { localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(fresh)); } catch { /* โหมดส่วนตัว */ }
    return fresh;
  } catch {
    return current; // ออฟไลน์หรือ server ล่ม ใช้ของเดิมไปก่อน ดีกว่าเตะออก
  }
}

/**
 * อายุ session ของหลังบ้าน — 8 ชั่วโมง เท่ากับที่ /admin ใช้ตัดสินตอนโหลดหน้า
 *
 * ค่าเดียวกันนี้เคยเขียนไว้ใน admin/page.tsx อย่างเดียว (SESSION_8H) พอ sidebar
 * ที่ใช้ร่วมกันต้องนับถอยหลังด้วย จึงย้ายมาไว้ที่เดียวกับตัวจัดการ session
 */
export const ADMIN_SESSION_TTL = 8 * 60 * 60 * 1000;
