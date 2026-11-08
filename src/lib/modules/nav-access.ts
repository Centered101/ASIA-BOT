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

/** หน้า "แผนงานฝ่าย" (plan_<ฝ่าย>) — ครูกับ superadmin เท่านั้น ส่วนการจำกัดตามฝ่ายใช้ TAB_DIVISION ตามปกติ */
const PLAN_ACCESS: Record<string, AdminRole[]> = Object.fromEntries(
  NAV_SECTIONS.filter(sec => sec.division).map(sec => [`plan_${sec.division!.toLowerCase()}`, ["superadmin", "admin"] as AdminRole[]]),
);

const TAB_ACCESS: Record<string, AdminRole[]> = {
  ...PLAN_ACCESS,
  dashboard: ["superadmin", "admin", "staff"],
  students: ["superadmin", "admin"],
  // หน้าที่ย้ายออกไปอยู่นอก admin/page.tsx แล้ว — ตัวหน้าเองตรวจสิทธิ์ด้วย RBAC
  // ฝั่ง server อีกชั้น ตรงนี้คุมแค่ว่าจะโชว์ในเมนูให้ role ไหน
  // นำเข้าเป็นการเขียนข้อมูลจริงทีละหลายร้อยแถว จึงไม่เปิดให้ staff
  import: ["superadmin", "admin"],
  class_attendance: ["superadmin", "admin"],
  // ผลการเรียนกับพฤติกรรมเป็นข้อมูลอ่อนไหวของนักเรียน — ไม่เปิดให้ staff (สภานักเรียนที่เป็นนักเรียน)
  // ตัวหน้ากับ API ตรวจสิทธิ์ grade.manage / conduct.manage / homevisit.manage ซ้ำฝั่ง server อีกชั้น
  academic: ["superadmin", "admin"],
  conduct: ["superadmin", "admin"],
  // การเงิน: เมนูโชว์ให้ superadmin/admin ตามฝ่าย แต่สิทธิ์จริง (finance.manage) ให้เฉพาะ role FINANCE กับ
  // SUPER_ADMIN ฝั่ง API ครูที่ไม่ใช่ฝ่ายการเงินกดเข้ามาจะได้ "ไม่มีสิทธิ์" ไม่ใช่ข้อมูลเงิน
  finance: ["superadmin", "admin"],
  // ห้องพยาบาล: เมนูโชว์ตามฝ่าย แต่สิทธิ์จริง (nurse.manage) ให้เฉพาะ role NURSE กับ SUPER_ADMIN ฝั่ง API
  nurse: ["superadmin", "admin"],
  // ห้องสมุด: เมนูโชว์ตามฝ่าย แต่สิทธิ์จริง (library.manage) ให้เฉพาะ role LIBRARY กับ SUPER_ADMIN ฝั่ง API
  library: ["superadmin", "admin"],
  // ทวิภาคี: เมนูโชว์ตามฝ่าย แต่สิทธิ์จริง (training.manage) ให้เฉพาะ role DUAL_EDUCATION กับ SUPER_ADMIN ฝั่ง API
  training: ["superadmin", "admin"],
  // กิจกรรม: เมนูโชว์ตามฝ่าย แต่สิทธิ์จริง (activity.manage) ให้เฉพาะ role ACTIVITY กับ SUPER_ADMIN ฝั่ง API
  activities: ["superadmin", "admin"],
  // แผนที่โรงเรียน: สิทธิ์จริง (map.manage) ให้ ADMIN กับ SUPER_ADMIN ฝั่ง API สภานักเรียนไม่ได้
  campus_map: ["superadmin", "admin"],
  // staff แจ้งซ่อมได้ แต่ดูคิวงานของทั้งโรงเรียนไม่ได้ — /api/admin/maintenance
  // ขอ permission "maintenance.view_all" ซึ่ง role ACADEMIC (ปลายทางของ staff)
  // ไม่มี ตรงนี้เคยใส่ staff ไว้ เมนูจึงโชว์หน้าที่กดเข้าไปแล้วได้ 403 เปล่า ๆ
  maintenance: ["superadmin", "admin"],
  assets: ["superadmin", "admin"],
  data_requests: ["superadmin", "admin"],
  // ไม่เปิดให้ staff — document.view_all แปลว่าเห็นสำเนาบัตรประชาชนกับทะเบียนบ้าน
  // ของนักเรียนทั้งโรงเรียน ซึ่งสภานักเรียนไม่ควรเห็น (ดู 0023 ที่ตั้งใจไม่ให้ ACADEMIC ด้วย)
  documents: ["superadmin", "admin"],
  // สภานักเรียน (staff) ดูแลเฉพาะ: สหกรณ์ (สินค้า/คำสั่งซื้อ) พัสดุ (คลังของยืม/คำขอเบิก) ส่งประกาศ ผู้ดูแลระบบ (ดูรายการ) ตั้งค่า + ภาพรวม
  // ไม่สังกัดฝ่าย ไม่เห็นเมนูฝ่ายอื่น (ข้อมูลนักเรียน เช็กชื่อ จองห้อง โปรเจกต์ ผลประเมิน ความคิดเห็น ฯลฯ) — ปิดที่ API ตรงกันด้วย
  bookings: ["superadmin", "admin"],
  rooms: ["superadmin", "admin"],
  products: ["superadmin", "admin", "staff"],
  shoporders: ["superadmin", "admin", "staff"],
  equipment_items: ["superadmin", "admin", "staff"],
  equipment_requests: ["superadmin", "admin", "staff"],
  projects: ["superadmin", "admin", "staff"],
  evaluations: ["superadmin", "admin", "staff"],
  // ปฏิทินวันหยุด: ตั้ง/ลบได้เฉพาะครูกับผู้ดูแลสูงสุด (API /api/admin/holidays ตรวจตรงกัน)
  holidays: ["superadmin", "admin"],
  class_schedule: ["superadmin", "admin"],
  class_schedule_weekly: ["superadmin", "admin"],
  class_schedule_override: ["superadmin", "admin"],
  teachers: ["superadmin", "admin"],
  feedbacks: ["superadmin", "admin"],
  teacher_applications: ["superadmin"],
  admins: ["superadmin", "admin", "staff"],
  // โพสต์ถึงคนทั้งเว็บแบบสาธารณะ — API ก็เช็กแค่ superadmin/admin ตรงกัน
  announce: ["superadmin", "admin", "staff"],
  settings: ["superadmin", "admin", "staff"],
  // บทสนทนาส่วนตัวของนักเรียน — API ขอ permission "agent.view_logs" ซึ่งมีแค่
  // ADMIN กับ SUPER_ADMIN (0024) เมนูจึงต้องไม่โชว์ให้ staff กดแล้วได้ 403
  chat_logs: ["superadmin", "admin"],
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
 * ป้ายไทยของ role เดิม — เดิมเขียนซ้ำในหลายที่ ย้ายมาไว้กับการกรองเมนู
 *
 * ป้ายตรงนี้เขียนตามคนที่ถือจริง ไม่ได้แปลจากคำในคอลัมน์: staff คือประธานและ
 * สมาชิกสภานักเรียน (เป็นนักเรียน) ส่วน admin คือครู
 */
const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: "ผู้ดูแลสูงสุด",
  admin: "ครู",
  staff: "สภานักเรียน",
};

export function adminRoleLabel(role: string): string {
  return ROLE_LABEL[normalizeAdminRole(role)];
}

/**
 * ใครสังกัดฝ่ายได้บ้าง
 *
 * ฝ่าย (ฝ่ายทะเบียน ฝ่ายวิชาการ ฝ่ายอาคารสถานที่ ฯลฯ) เป็นโครงสร้างของบุคลากร
 * สภานักเรียนไม่ได้อยู่ในนั้น จึงตั้งฝ่ายให้ไม่ได้ ไม่ใช่แค่ "ตั้งแล้วไม่มีผล"
 * แต่เป็นค่าที่ไม่ควรมีอยู่ในแถวตั้งแต่แรก
 */
export function canHaveDivision(role: string): boolean {
  return normalizeAdminRole(role) !== "staff";
}

/**
 * ผู้ดูแลสูงสุดทำงานข้ามฝ่ายได้ — ดูทั้ง role เดิม (admins.role) และ role จริงใน user_roles
 */
function isSuper(role: string, roles?: readonly string[]): boolean {
  return normalizeAdminRole(role) === "superadmin" || !!roles?.includes("SUPER_ADMIN");
}

/**
 * ฝ่ายนี้เป็นของคนนี้หรือไม่ — นับจาก role ฝ่ายที่ถือจริงใน user_roles เท่านั้น
 *
 * เดิมตัดสินจากคอลัมน์ admins.division และถือว่า "ไม่ระบุฝ่าย = เห็นทุกฝ่าย" ซึ่งทำให้ครูเห็นเมนูของฝ่ายที่
 * ไม่ได้ถือ role (กดแล้ว 403 หรือแย่กว่านั้นคือเห็นข้อมูลของฝ่ายอื่น) ตอนนี้ต้องถือ role ฝ่ายนั้นจริงเท่านั้น
 */
function holdsDivision(role: string, roles: readonly string[], division: Role): boolean {
  return isSuper(role, roles) || roles.includes(division);
}

/**
 * เข้าแท็บนี้ได้หรือไม่
 *
 * `roles` มีสองความหมาย:
 *   - ส่งเป็นอาร์เรย์ (แม้ว่าง) = เช็กฝ่ายแบบเข้ม ต้องถือ role ฝ่ายเจ้าของแท็บ (เมนู, guard ของแต่ละ part)
 *   - ไม่ส่ง (undefined) = เช็กแค่ role เดิม ใช้กับจุดที่ถามว่า "ระดับนี้แก้ได้ไหม" ไม่เกี่ยวกับการแยกฝ่าย
 *
 * สภานักเรียน (staff) ไม่สังกัดฝ่าย แต่ยังใช้แท็บที่ TAB_ACCESS ระบุให้ staff ได้ (จองห้อง สหกรณ์ ฯลฯ)
 * โดยไม่ต้องถือ role ฝ่ายเจ้าของแท็บ ไม่งั้นสภาฯ จะเสียงานเหล่านี้ทันที
 */
export function canAccessTab(role: string, tab: string, roles?: readonly string[]): boolean {
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
  const normalized = normalizeAdminRole(role);
  if (!allowed.includes(normalized)) return false;

  // เช็กฝ่ายด้วย ไม่ใช่แค่ซ่อนปุ่ม — กันคนพิมพ์ /admin/teachers เข้าตรง ๆ
  if (!roles) return true;
  const owner = TAB_DIVISION[tab];
  if (!owner || holdsDivision(role, roles, owner)) return true;
  return normalized === "staff";
}

export function visibleNavSections(role: string, roles: readonly string[] = []): NavSection[] {
  return NAV_SECTIONS
    .map(sec => ({
      ...sec,
      items: sec.items
        .filter(item => canAccessTab(role, item.id, roles))
        .map(item => item.children
          ? { ...item, children: item.children.filter(child => canAccessTab(role, child.id, roles)) }
          : item),
    }))
    .filter(sec => sec.items.length > 0);
}

export type AdminPart = {
  division: Role;
  title: string;
  /** ทางเข้า part: หน้าแผนงานของฝ่าย ถ้าเข้าไม่ได้ก็เมนูแรกที่เข้าได้ */
  item: NavItem;
};

/**
 * part (พื้นที่ของแต่ละฝ่าย) ที่คนนี้เข้าได้จริง — ฝ่ายที่ไม่ได้ถือ role จะไม่อยู่ในรายการเลย
 * ใช้ทั้งตัวสลับฝ่ายที่โลโก้ รายการ "ฝ่ายของฉัน" และตัวตัดสินว่า part ไหนควรโชว์
 */
export function partsFor(role: string, roles: readonly string[] = []): AdminPart[] {
  return visibleNavSections(role, roles).flatMap(sec => {
    if (!sec.division) return [];
    const item = sec.items.find(i => i.id.startsWith("plan_")) ?? sec.items[0];
    return item ? [{ division: sec.division, title: sec.title ?? sec.division, item }] : [];
  });
}

/** ฝ่ายเจ้าของแท็บนี้ (ภาพรวม/ส่วนกลาง/ระบบ = undefined) — ไว้ให้ guard ของ part ถามว่า "หน้านี้ของฝ่ายไหน" */
export function divisionOfTab(tab: string): Role | undefined {
  return TAB_DIVISION[tab];
}
