/**
 * เมนูของหลังบ้าน — แหล่งความจริงเดียว
 *
 * เดิมอยู่ใน src/app/admin/page.tsx ซึ่งทำให้หน้าใหม่ที่อยู่นอกไฟล์นั้น
 * (student-360, maintenance, assets) ไม่มี sidebar และผู้ใช้ต้องกดย้อนกลับ
 * ไปหลังบ้านก่อนทุกครั้ง ย้ายออกมาที่นี่เพื่อให้ทั้งสองฝั่งอ่านชุดเดียวกัน
 *
 * `id` ของรายการเดิมยังเป็น tab id เหมือนเดิม (ใช้กับ /admin?tab=<id>)
 * ส่วนรายการที่มี `href` คือหน้าที่ย้ายออกมาอยู่นอก admin/page.tsx แล้ว
 * ตัว sidebar จะพาไปด้วยการเปลี่ยน URL แทนการสลับแท็บ
 */

import type { Role } from "@/lib/rbac/definitions";

export type AdminRole = "superadmin" | "admin" | "staff";

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  children?: NavItem[];
  /** หน้าที่อยู่นอก admin/page.tsx แล้ว */
  href?: string;
  /**
   * คำค้นเพิ่มเติมสำหรับช่องค้นหาในหลังบ้าน
   *
   * ชื่อเมนูสั้นเพื่อให้ sidebar อ่านง่าย แต่คนค้นมักพิมพ์ชื่อเต็มของงาน
   * เช่นพิมพ์ "ลงทะเบียนบัตรนักเรียน" แล้วควรเจอเมนู "นักเรียน"
   * ใส่ไว้ตรงนี้แทนการเปลี่ยนชื่อเมนูให้ยาวขึ้น
   */
  keywords?: string[];
};

export type NavSection = {
  title: string | null;
  items: NavItem[];
  /**
   * ฝ่ายที่เป็นเจ้าของงานชุดนี้ — ใช้ key เดียวกับ roles.key
   *
   * section ที่ไม่ใส่ = งานส่วนกลาง ทุกฝ่ายเห็น (ภาพรวม, ส่วนกลาง, ระบบ)
   * คนที่ตั้งฝ่ายไว้จะเห็นเฉพาะ section ของฝ่ายตัวเอง + ที่ไม่ใส่
   */
  division?: Role;
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "ภาพรวม",
    items: [{ id: "dashboard", label: "ภาพรวมระบบ", icon: "fa-gauge-high" }],
  },
  {
    // ฝ่ายทะเบียน — ข้อมูลตัวตนของนักเรียนตั้งแต่เข้าจนจบ
    title: "ฝ่ายทะเบียน",
    division: "REGISTRAR",
    items: [
      // ข้อมูลนักเรียนกับการจัดห้องเคยเป็นสองเมนู (students กับ student_360)
      // ทั้งที่เริ่มจากรายชื่อชุดเดียวกัน ตอนนี้เป็นหน้าเดียวสองแท็บย่อย
      { id: "students",      label: "นักเรียน",           icon: "fa-graduation-cap", href: "/admin/students",
        keywords: ["ลงทะเบียนบัตรนักเรียน", "ทำบัตรนักเรียน", "เพิ่มนักเรียน", "สมัครนักเรียน", "บัตรนักเรียน", "รายชื่อนักเรียน",
          // กลุ่มเรียนถูกยุบมาเป็นแท็บในหน้านี้ คนที่เคยหาด้วยชื่อเดิมต้องยังเจอ
          "กลุ่มเรียน", "จัดห้องเรียน", "ห้องเรียน", "จัดกลุ่ม"] },
      { id: "import",        label: "นำเข้าจากไฟล์",     icon: "fa-file-import", href: "/admin/import",
        keywords: ["นำเข้านักเรียน", "อัปโหลด csv", "excel"] },
      { id: "data_requests", label: "คำขอแก้ไขข้อมูล",   icon: "fa-id-card", badge: "pendingDataRequests",
        keywords: ["คำขอทำบัตร", "อนุมัติข้อมูล", "เปลี่ยนชื่อ"] },
      // ศูนย์เอกสาร (0023) — สองคิวในหน้าเดียว: ตรวจไฟล์ที่นักเรียนส่งเข้าแฟ้ม
      // กับออกเอกสารตามคำขอ ทั้งคู่เป็นงานฝ่ายทะเบียนและเริ่มจากรายชื่อชุดเดียวกัน
      { id: "documents",     label: "ศูนย์เอกสาร",        icon: "fa-file-lines", href: "/admin/documents",
        keywords: ["ปพ", "transcript", "ใบรับรอง", "ขอเอกสาร", "คัดสำเนา", "ใบจบ", "เอกสารนักเรียน"] },
    ],
  },
  {
    // ฝ่ายวิชาการ — ห้องเรียน ตารางสอน ครู และการเรียนการสอน
    title: "ฝ่ายวิชาการ",
    division: "ACADEMIC",
    items: [
      {
        id: "class_schedule",
        label: "ตารางเรียน",
        icon: "fa-calendar-days",
        children: [
          { id: "class_schedule_weekly", label: "ตารางสัปดาห์", icon: "fa-calendar-week" },
          { id: "class_schedule_override", label: "แก้วันพิเศษ", icon: "fa-calendar-xmark" },
        ],
      },
      { id: "class_attendance",     label: "เช็กชื่อรายวิชา", icon: "fa-user-check", href: "/admin/class-attendance" },
      { id: "teachers",             label: "ครูผู้สอน",   icon: "fa-chalkboard-user" },
      { id: "teacher_applications", label: "ใบสมัครครู", icon: "fa-user-plus", badge: "pendingTeacherApps" },
    ],
  },
  {
    // ฝ่ายกิจการนักเรียน — งานที่มองนักเรียนเป็นรายบุคคลนอกห้องเรียน
    title: "ฝ่ายกิจการนักเรียน",
    division: "STUDENT_AFFAIRS",
    items: [
      { id: "projects",    label: "โปรเจคนักเรียน", icon: "fa-folder-open" },
      { id: "evaluations", label: "ผลการประเมิน",   icon: "fa-chart-bar" },
      { id: "feedbacks",   label: "ความคิดเห็น",     icon: "fa-comment-dots", badge: "feedbackPending" },
    ],
  },
  {
    // ฝ่ายอาคารสถานที่ — ห้อง อาคาร และงานซ่อม
    title: "ฝ่ายอาคารสถานที่",
    division: "MAINTENANCE",
    items: [
      { id: "maintenance", label: "งานแจ้งซ่อม",  icon: "fa-screwdriver-wrench", href: "/admin/maintenance" },
      { id: "bookings",    label: "รายการจองห้อง", icon: "fa-calendar-check", badge: "pendingBookings" },
      { id: "rooms",       label: "จัดการห้อง",    icon: "fa-door-open" },
    ],
  },
  {
    // ฝ่ายพัสดุ — ของที่โรงเรียนเป็นเจ้าของ ทั้งรายชิ้นและคลังยืม
    title: "ฝ่ายพัสดุ",
    division: "ASSET_MANAGER",
    items: [
      { id: "assets",             label: "ทะเบียนครุภัณฑ์", icon: "fa-clipboard-check", href: "/admin/assets" },
      { id: "equipment_items",    label: "คลังของยืม",      icon: "fa-toolbox" },
      { id: "equipment_requests", label: "คำขอเบิก",        icon: "fa-basket-shopping", badge: "pendingEquipmentRequests" },
    ],
  },
  {
    // สหกรณ์ — แยกจากพัสดุเพราะเป็นการซื้อขาย ไม่ใช่การยืมคืน
    title: "สหกรณ์โรงเรียน",
    division: "SHOP_MANAGER",
    items: [
      { id: "products",   label: "สินค้า",     icon: "fa-box", badge: "lowStockProducts", href: "/admin/shop" },
      { id: "shoporders", label: "คำสั่งซื้อ", icon: "fa-receipt", badge: "orderUpdates", href: "/admin/shop/orders" },
    ],
  },
  {
    // งานส่วนกลาง ไม่ได้สังกัดฝ่ายใดฝ่ายหนึ่ง
    title: "ส่วนกลาง",
    items: [
      { id: "line_broadcast", label: "ส่งข่าวสาร LINE", icon: "fa-bullhorn" },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { id: "admins",   label: "ผู้ดูแลระบบ", icon: "fa-user-shield" },
      { id: "settings", label: "ตั้งค่า",     icon: "fa-gear" },
    ],
  },
];

/**
 * รายชื่อฝ่ายที่เลือกได้ — ดึงจาก NAV_SECTIONS ไม่ได้พิมพ์ซ้ำ
 *
 * เพิ่ม section ใหม่พร้อม division เมื่อไหร่ dropdown ในหน้าผู้ดูแลระบบ
 * ก็ได้ตัวเลือกใหม่ทันที ไม่ต้องมาไล่แก้สองที่แล้วลืมที่ใดที่หนึ่ง
 * (ค่าที่อนุญาตต้องตรงกับ CHECK ใน supabase/migrations/0019_admin_division.sql)
 */
export const ADMIN_DIVISIONS: Role[] = NAV_SECTIONS
  .map(sec => sec.division)
  .filter((d): d is Role => !!d);

/**
 * เส้นทางของเมนูหนึ่งรายการ ไว้ทำ breadcrumb บนแถบบนสุด
 *
 * หน้าที่อยู่นอก admin/page.tsx เคยไม่มีแถบนี้เลย พอสลับจากแท็บเดิมมาหน้าใหม่
 * แถบบนหายไปทั้งแถบ เหมือนหลุดออกจากระบบไปคนละที่ ทั้งที่เป็นหลังบ้านเดียวกัน
 *
 * อ่านจาก NAV_SECTIONS ชุดเดียวกับ sidebar ชื่อในเมนูกับใน breadcrumb
 * จึงตรงกันเสมอโดยไม่ต้องส่งชื่อซ้ำเข้ามาจากแต่ละหน้า
 */
export function navTrail(id?: string): { section: string | null; item: NavItem } | null {
  if (!id) return null;
  for (const sec of NAV_SECTIONS) {
    for (const item of sec.items) {
      if (item.id === id) return { section: sec.title, item };
      const child = item.children?.find(c => c.id === id);
      // เมนูย่อยให้ขึ้นชื่อเมนูแม่เป็นชั้นกลาง จะได้รู้ว่าอยู่ใต้อะไร
      if (child) return { section: sec.title ? `${sec.title} · ${item.label}` : item.label, item: child };
    }
  }
  return null;
}

/**
 * URL ของเมนูหนึ่งรายการ — sidebar กับช่องค้นหาต้องพาไปที่เดียวกัน
 *
 * รายการที่มี href คือหน้าที่ย้ายออกมาอยู่นอก admin/page.tsx แล้ว
 * ที่เหลือยังอยู่ในไฟล์เดิมและเข้าถึงผ่าน /admin/<id> ซึ่ง [tab]/page.tsx รับไว้
 */
export function navHref(item: NavItem): string {
  return item.href ?? (item.id === "dashboard" ? "/admin" : `/admin/${item.id}`);
}
