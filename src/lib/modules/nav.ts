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

export type AdminRole = "superadmin" | "admin" | "staff";

export type NavItem = {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  children?: NavItem[];
  /** หน้าที่อยู่นอก admin/page.tsx แล้ว */
  href?: string;
};

export type NavSection = { title: string | null; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "ภาพรวม",
    items: [{ id: "dashboard", label: "ภาพรวมระบบ", icon: "fa-gauge-high" }],
  },
  {
    title: "นักเรียน",
    items: [
      { id: "students",        label: "นักเรียน",            icon: "fa-graduation-cap" },
      { id: "student_360",     label: "Student 360",         icon: "fa-id-card-clip", href: "/admin/student-360" },
      { id: "data_requests",   label: "คำขอข้อมูลนักเรียน",  icon: "fa-id-card", badge: "pendingDataRequests" },
    ],
  },
  {
    title: "จองห้อง",
    items: [
      { id: "bookings", label: "รายการจองห้อง", icon: "fa-calendar-check", badge: "pendingBookings" },
      { id: "rooms",    label: "จัดการห้อง",     icon: "fa-door-open" },
    ],
  },
  {
    title: "สหกรณ์ โรงเรียน",
    items: [
      { id: "products",   label: "สินค้า",  icon: "fa-box", badge: "lowStockProducts" },
      { id: "shoporders", label: "คำสั่งซื้อ", icon: "fa-receipt", badge: "orderUpdates" },
    ],
  },
  {
    title: "เบิกคุรุภัณฑ์",
    items: [
      { id: "equipment_items",    label: "คุรุภัณฑ์ทั้งหมด", icon: "fa-toolbox" },
      { id: "equipment_requests", label: "ออเดอร์เบิก",     icon: "fa-basket-shopping", badge: "pendingEquipmentRequests" },
    ],
  },
  {
    title: "โปรเจค",
    items: [
      { id: "projects",    label: "จัดการโปรเจค", icon: "fa-folder-open" },
      { id: "evaluations", label: "ผลการประเมิน", icon: "fa-chart-bar"   },
    ],
  },
  {
    title: "การเรียนการสอน",
    items: [
      { id: "class_groups",   label: "กลุ่มเรียน",  icon: "fa-users-rectangle" },
      {
        id: "class_schedule",
        label: "ตารางเรียน",
        icon: "fa-calendar-days",
        children: [
          { id: "class_schedule_weekly", label: "ตารางสัปดาห์", icon: "fa-calendar-week" },
          { id: "class_schedule_override", label: "แก้วันพิเศษ", icon: "fa-calendar-xmark" },
        ],
      },
      { id: "teachers",       label: "ครูผู้สอน",   icon: "fa-chalkboard-user" },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { id: "feedbacks", label: "ความคิดเห็น", icon: "fa-comment-dots", badge: "feedbackPending" },
      { id: "line_broadcast", label: "ส่งข่าวสาร", icon: "fa-bullhorn" },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { id: "teacher_applications", label: "ใบสมัครครู", icon: "fa-chalkboard-user", badge: "pendingTeacherApps" },
      { id: "admins",    label: "ผู้ดูแลระบบ", icon: "fa-user-shield" },
      { id: "settings",  label: "ตั้งค่า",  icon: "fa-gear" },
    ],
  },
  {
    title: "อาคารและครุภัณฑ์",
    items: [
      { id: "maintenance", label: "งานแจ้งซ่อม",     icon: "fa-screwdriver-wrench", href: "/admin/maintenance" },
      { id: "assets",      label: "ทะเบียนครุภัณฑ์", icon: "fa-clipboard-check",    href: "/admin/assets" },
    ],
  },
];
