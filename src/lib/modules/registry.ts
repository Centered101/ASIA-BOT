import type { Role } from "@/lib/rbac/definitions";

/**
 * Module registry.
 *
 * `src/app/admin/page.tsx` is 11,542 lines carrying all 21 admin tabs in one
 * client component. Appending the roadmap's ~20 remaining modules to it is not
 * workable, so from Phase 2 onward a new module registers a descriptor here and
 * lives at its own route under src/app/admin/(modules)/.
 *
 * The existing 21 tabs are deliberately NOT migrated in Phase 1 — that is a
 * large, separate, regression-heavy job. They are listed as `legacy: true` so
 * navigation can render one combined menu while the two systems coexist.
 */

export type ModuleDescriptor = {
  /** URL segment and stable id. */
  key: string;
  label: string;
  /** Font Awesome class, matching the existing admin UI. */
  icon: string;
  /** Capability required to see and open the module. */
  permission: string;
  /** Grouping in the sidebar. */
  group: ModuleGroup;
  /** Where the module lives. Legacy entries point at the existing tabbed page. */
  href: string;
  /** True while the module still lives inside src/app/admin/page.tsx. */
  legacy: boolean;
  /** Roadmap phase that introduces it; undefined means it already exists. */
  phase?: number;
};

export type ModuleGroup =
  | "overview"
  | "student"
  | "academic"
  | "operations"
  | "resources"
  | "system";

export const MODULE_GROUP_LABELS: Record<ModuleGroup, string> = {
  overview: "ภาพรวม",
  student: "นักเรียน",
  academic: "วิชาการ",
  operations: "งานบริการ",
  resources: "ทรัพยากร",
  system: "ระบบ",
};

/** Legacy tab -> /admin?tab=<key>, exactly where it lives today. */
function legacyTab(
  key: string,
  label: string,
  icon: string,
  permission: string,
  group: ModuleGroup
): ModuleDescriptor {
  return { key, label, icon, permission, group, href: `/admin?tab=${key}`, legacy: true };
}

export const MODULES: ModuleDescriptor[] = [
  legacyTab("dashboard", "แดชบอร์ด", "fa-solid fa-gauge", "dashboard.view", "overview"),
  legacyTab("students", "นักเรียน", "fa-solid fa-user-graduate", "student.view_all", "student"),
  // โมดูลแรกที่อยู่นอก admin/page.tsx — Phase 2 (supabase/migrations/0011-0013)
  {
    key: "student-360",
    label: "ข้อมูลนักเรียน 360°",
    icon: "fa-solid fa-address-card",
    permission: "student.view_all",
    group: "student",
    href: "/admin/student-360",
    legacy: false,
    phase: 2,
  },
  legacyTab("data_requests", "คำขอแก้ไขข้อมูล", "fa-solid fa-user-pen", "student.update", "student"),
  legacyTab("class_groups", "กลุ่มเรียน", "fa-solid fa-users-rectangle", "schedule.manage", "academic"),
  legacyTab("class_schedule_weekly", "ตารางสัปดาห์", "fa-solid fa-calendar-week", "schedule.view", "academic"),
  legacyTab("class_schedule_override", "แก้ตารางวันพิเศษ", "fa-solid fa-calendar-day", "schedule.manage", "academic"),
  legacyTab("teachers", "ครูผู้สอน", "fa-solid fa-chalkboard-user", "student.view_all", "academic"),
  legacyTab("teacher_applications", "ใบสมัครครู", "fa-solid fa-user-plus", "system.manage", "academic"),
  legacyTab("bookings", "การจองห้อง", "fa-solid fa-calendar-check", "booking.view_all", "operations"),
  legacyTab("rooms", "ห้อง", "fa-solid fa-door-open", "room.manage", "resources"),
  legacyTab("products", "สินค้า", "fa-solid fa-box", "shop.manage_products", "operations"),
  legacyTab("shoporders", "ออเดอร์สหกรณ์", "fa-solid fa-receipt", "shop.view_all_orders", "operations"),
  legacyTab("equipment_items", "คุรุภัณฑ์", "fa-solid fa-toolbox", "equipment.manage_items", "resources"),
  legacyTab("equipment_requests", "คำขอเบิก", "fa-solid fa-clipboard-list", "equipment.view_all_requests", "resources"),
  legacyTab("projects", "โปรเจกต์", "fa-solid fa-folder-open", "project.manage", "academic"),
  legacyTab("evaluations", "ผลประเมิน", "fa-solid fa-star", "project.view", "academic"),
  legacyTab("feedbacks", "ความคิดเห็น", "fa-solid fa-comment-dots", "feedback.view_all", "operations"),
  legacyTab("line_broadcast", "ส่งข่าวสาร LINE", "fa-solid fa-bullhorn", "notifications.send", "operations"),
  legacyTab("admins", "ผู้ดูแลระบบ", "fa-solid fa-user-shield", "system.manage", "system"),
  legacyTab("settings", "ตั้งค่า", "fa-solid fa-gear", "system.manage", "system"),
];

/** Modules the caller may see, in sidebar order. */
export function visibleModules(permissions: readonly string[]): ModuleDescriptor[] {
  const all = permissions.includes("*");
  return MODULES.filter((m) => all || permissions.includes(m.permission));
}

export function modulesByGroup(
  permissions: readonly string[]
): { group: ModuleGroup; label: string; modules: ModuleDescriptor[] }[] {
  const visible = visibleModules(permissions);
  const groups: ModuleGroup[] = ["overview", "student", "academic", "operations", "resources", "system"];

  return groups
    .map((group) => ({
      group,
      label: MODULE_GROUP_LABELS[group],
      modules: visible.filter((m) => m.group === group),
    }))
    .filter((g) => g.modules.length > 0);
}

export function findModule(key: string): ModuleDescriptor | undefined {
  return MODULES.find((m) => m.key === key);
}

/**
 * Roles that should land somewhere other than the dashboard.
 * Used by the role-aware landing logic in Phase 13.
 */
export const ROLE_HOME: Partial<Record<Role, string>> = {
  SHOP_MANAGER: "/admin?tab=shoporders",
  LIBRARY: "/admin?tab=dashboard",
  ASSET_MANAGER: "/admin?tab=equipment_requests",
  ADVISOR: "/admin?tab=students",
};
