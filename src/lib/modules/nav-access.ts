/**
 * ใครเห็นเมนูอะไรได้บ้าง — แหล่งความจริงเดียว
 *
 * เดิมอยู่ใน src/app/admin/page.tsx ซึ่งเป็นไฟล์ ~11k บรรทัด ทำให้ sidebar ของ
 * หน้าที่อยู่นอกไฟล์นั้น (src/components/admin/Sidebar.tsx) เอาไปใช้ซ้ำไม่ได้
 * ผลคือฝั่งนั้นไม่กรองอะไรเลย บัญชี staff เห็น "ใบสมัครครู" ซึ่งเป็นของ
 * superadmin เท่านั้น เมนูสองฝั่งจึงไม่ตรงกัน ย้ายออกมาที่นี่เพื่อให้กรองชุดเดียว
 *
 * การกรองมีสองชั้นที่แยกหน้าที่กันชัด:
 *   1. role เดิม (superadmin/admin/staff) — คุมว่า "ทำอะไรได้"
 *   2. division (ฝ่าย)                     — คุมว่า "งานของใคร"
 * ทั้งสองต้องผ่านถึงจะเห็น
 */

import { NAV_SECTIONS, type AdminRole, type NavItem, type NavSection } from "./nav";
import type { Role } from "@/lib/rbac/definitions";

const TAB_ACCESS: Record<string, AdminRole[]> = {
  dashboard: ["superadmin", "admin", "staff"],
  students: ["superadmin", "admin", "staff"],
  // หน้าที่ย้ายออกไปอยู่นอก admin/page.tsx แล้ว — ตัวหน้าเองตรวจสิทธิ์ด้วย RBAC
  // ฝั่ง server อีกชั้น ตรงนี้คุมแค่ว่าจะโชว์ในเมนูให้ role ไหน
  student_360: ["superadmin", "admin", "staff"],
  class_attendance: ["superadmin", "admin", "staff"],
  maintenance: ["superadmin", "admin", "staff"],
  assets: ["superadmin", "admin"],
  data_requests: ["superadmin", "admin"],
  bookings: ["superadmin", "admin", "staff"],
  rooms: ["superadmin", "admin"],
  products: ["superadmin", "admin", "staff"],
  shoporders: ["superadmin", "admin", "staff"],
  equipment_items: ["superadmin", "admin", "staff"],
  equipment_requests: ["superadmin", "admin", "staff"],
  projects: ["superadmin", "admin", "staff"],
  evaluations: ["superadmin", "admin", "staff"],
  class_groups: ["superadmin", "admin"],
  class_schedule: ["superadmin", "admin"],
  class_schedule_weekly: ["superadmin", "admin"],
  class_schedule_override: ["superadmin", "admin"],
  teachers: ["superadmin", "admin"],
  feedbacks: ["superadmin", "admin", "staff"],
  teacher_applications: ["superadmin"],
  admins: ["superadmin", "admin", "staff"],
  line_broadcast: ["superadmin", "admin", "staff"],
  settings: ["superadmin", "admin", "staff"],
};

/** tab id → ฝ่ายเจ้าของ สร้างจาก NAV_SECTIONS จะได้ไม่หลุดจากกันเวลาแก้เมนู */
const TAB_DIVISION: Record<string, Role> = (() => {
  const map: Record<string, Role> = {};
  for (const sec of NAV_SECTIONS) {
    if (!sec.division) continue;
    const walk = (items: NavItem[]) => {
      for (const item of items) {
        map[item.id] = sec.division!;
        if (item.children) walk(item.children);
      }
    };
    walk(sec.items);
  }
  return map;
})();

export function normalizeAdminRole(role: string): AdminRole {
  return role === "superadmin" || role === "admin" || role === "staff" ? role : "staff";
}

/**
 * superadmin กับ admin ทำงานข้ามฝ่ายอยู่แล้ว ส่วนคนที่ยังไม่ได้ตั้งฝ่าย
 * ให้เห็นเหมือนเดิมทุกอย่าง บัญชีเก่าจะได้ไม่พังระหว่างทยอยตั้งค่า
 */
function skipsDivisionCheck(role: string, division?: string | null): boolean {
  const r = normalizeAdminRole(role);
  return r === "superadmin" || r === "admin" || !division;
}

export function canAccessTab(role: string, tab: string, division?: string | null): boolean {
  const allowed = TAB_ACCESS[tab];
  if (!allowed) {
    // เมนูที่ไม่มีใน TAB_ACCESS เคยหายไปเงียบ ๆ — เพิ่มรายการใน nav.ts แล้ว
    // ลืมมาเพิ่มที่นี่ ผลคือเมนูไม่ขึ้นโดยไม่มีอะไรบอกว่าทำไม กว่าจะรู้ก็เสียเวลาไล่หา
    // ยังคืน false เหมือนเดิมเพราะปลอดภัยกว่าเปิดให้ทุก role โดยไม่ตั้งใจ
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[nav] "${tab}" ไม่มีใน TAB_ACCESS จึงถูกซ่อนจากเมนู — เพิ่มเข้าไปที่ TAB_ACCESS ด้วย`);
    }
    return false;
  }
  if (!allowed.includes(normalizeAdminRole(role))) return false;

  // เช็กฝ่ายด้วย ไม่ใช่แค่ซ่อนปุ่ม — กันคนพิมพ์ /admin?tab=teachers เข้าตรง ๆ
  if (skipsDivisionCheck(role, division)) return true;
  const owner = TAB_DIVISION[tab];
  return !owner || owner === division;
}

export function visibleNavSections(role: string, division?: string | null): NavSection[] {
  const crossDivision = skipsDivisionCheck(role, division);
  return NAV_SECTIONS
    .filter(sec => crossDivision || !sec.division || sec.division === division)
    .map(sec => ({
      ...sec,
      items: sec.items
        .filter(item => canAccessTab(role, item.id, division))
        .map(item => item.children
          ? { ...item, children: item.children.filter(child => canAccessTab(role, child.id, division)) }
          : item),
    }))
    .filter(sec => sec.items.length > 0);
}
