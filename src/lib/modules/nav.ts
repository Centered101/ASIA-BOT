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
    // ฝ่ายทะเบียน — ข้อมูลตัวตนของนักเรียนตั้งแต่เข้าจนจบ
    title: "ฝ่ายทะเบียน",
    items: [
      { id: "students",      label: "ข้อมูลนักเรียน",     icon: "fa-graduation-cap" },
      { id: "student_360",   label: "Student 360",        icon: "fa-id-card-clip", href: "/admin/student-360" },
      { id: "data_requests", label: "คำขอแก้ไขข้อมูล",   icon: "fa-id-card", badge: "pendingDataRequests" },
    ],
  },
  {
    // ฝ่ายวิชาการ — ห้องเรียน ตารางสอน ครู และการเรียนการสอน
    title: "ฝ่ายวิชาการ",
    items: [
      { id: "class_groups", label: "กลุ่มเรียน", icon: "fa-users-rectangle" },
      {
        id: "class_schedule",
        label: "ตารางเรียน",
        icon: "fa-calendar-days",
        children: [
          { id: "class_schedule_weekly", label: "ตารางสัปดาห์", icon: "fa-calendar-week" },
          { id: "class_schedule_override", label: "แก้วันพิเศษ", icon: "fa-calendar-xmark" },
        ],
      },
      { id: "teachers",             label: "ครูผู้สอน",   icon: "fa-chalkboard-user" },
      { id: "teacher_applications", label: "ใบสมัครครู", icon: "fa-user-plus", badge: "pendingTeacherApps" },
    ],
  },
  {
    // ฝ่ายกิจการนักเรียน — งานที่มองนักเรียนเป็นรายบุคคลนอกห้องเรียน
    title: "ฝ่ายกิจการนักเรียน",
    items: [
      { id: "projects",    label: "โปรเจคนักเรียน", icon: "fa-folder-open" },
      { id: "evaluations", label: "ผลการประเมิน",   icon: "fa-chart-bar" },
      { id: "feedbacks",   label: "ความคิดเห็น",     icon: "fa-comment-dots", badge: "feedbackPending" },
    ],
  },
  {
    // ฝ่ายอาคารสถานที่ — ห้อง อาคาร และงานซ่อม
    title: "ฝ่ายอาคารสถานที่",
    items: [
      { id: "maintenance", label: "งานแจ้งซ่อม",  icon: "fa-screwdriver-wrench", href: "/admin/maintenance" },
      { id: "bookings",    label: "รายการจองห้อง", icon: "fa-calendar-check", badge: "pendingBookings" },
      { id: "rooms",       label: "จัดการห้อง",    icon: "fa-door-open" },
    ],
  },
  {
    // ฝ่ายพัสดุ — ของที่โรงเรียนเป็นเจ้าของ ทั้งรายชิ้นและคลังยืม
    title: "ฝ่ายพัสดุ",
    items: [
      { id: "assets",             label: "ทะเบียนครุภัณฑ์", icon: "fa-clipboard-check", href: "/admin/assets" },
      { id: "equipment_items",    label: "คลังของยืม",      icon: "fa-toolbox" },
      { id: "equipment_requests", label: "คำขอเบิก",        icon: "fa-basket-shopping", badge: "pendingEquipmentRequests" },
    ],
  },
  {
    // สหกรณ์ — แยกจากพัสดุเพราะเป็นการซื้อขาย ไม่ใช่การยืมคืน
    title: "สหกรณ์โรงเรียน",
    items: [
      { id: "products",   label: "สินค้า",     icon: "fa-box", badge: "lowStockProducts" },
      { id: "shoporders", label: "คำสั่งซื้อ", icon: "fa-receipt", badge: "orderUpdates" },
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
