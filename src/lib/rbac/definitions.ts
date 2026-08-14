/**
 * Role and permission definitions — the single source of truth for ASIA-BOT.
 *
 * This started life as `src/lib/agent/permissions.ts`, where a genuinely good
 * capability model existed but only the AI agent consulted it; the API layer
 * knew only `admins.role` (superadmin | admin | staff). This module promotes
 * that model to app-wide scope and adds the roles the school actually needs.
 *
 * Kept free of server-only imports so both route handlers and client code can
 * import the types and role labels.
 *
 * Must stay in sync with supabase/migrations/0003_rbac.sql, which seeds the
 * same data into `roles` / `permissions` / `role_permissions`.
 */

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "EXECUTIVE"
  | "REGISTRAR"
  | "FINANCE"
  | "ACADEMIC"
  | "STUDENT_AFFAIRS"
  | "TEACHER"
  | "ADVISOR"
  | "DUAL_EDUCATION"
  | "ACTIVITY"
  | "LIBRARY"
  | "NURSE"
  | "ASSET_MANAGER"
  | "MAINTENANCE"
  | "SHOP_MANAGER"
  | "STUDENT"
  | "PARENT"
  | "ALUMNI"
  | "GUEST";

export type SubjectType = "admin" | "teacher" | "student" | "parent" | "alumni";

/** Thai labels for UI. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "ผู้ดูแลสูงสุด",
  ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
  REGISTRAR: "ฝ่ายทะเบียน",
  FINANCE: "ฝ่ายการเงิน",
  ACADEMIC: "ฝ่ายวิชาการ",
  STUDENT_AFFAIRS: "ฝ่ายกิจการนักเรียน",
  TEACHER: "ครูผู้สอน",
  ADVISOR: "ครูที่ปรึกษา",
  DUAL_EDUCATION: "ฝ่ายทวิภาคี",
  ACTIVITY: "ฝ่ายกิจกรรม",
  LIBRARY: "ห้องสมุด",
  NURSE: "ห้องพยาบาล",
  ASSET_MANAGER: "ผู้ดูแลครุภัณฑ์",
  MAINTENANCE: "ฝ่ายอาคารสถานที่",
  SHOP_MANAGER: "ผู้ดูแลสหกรณ์",
  STUDENT: "นักเรียน",
  PARENT: "ผู้ปกครอง",
  ALUMNI: "ศิษย์เก่า",
  GUEST: "ผู้เยี่ยมชม",
};

/** Wildcard held only by SUPER_ADMIN. */
export const ALL_PERMISSIONS = "*" as const;

const STUDENT_PERMISSIONS = [
  "school.info",
  "student.view_own",
  "attendance.view_own",
  "schedule.view",
  "booking.view_own",
  "booking.create",
  "shop.view_products",
  "shop.view_own_orders",
  "shop.create_order",
  "equipment.view_items",
  "equipment.view_own_requests",
  "equipment.create_request",
  "feedback.create",
  "project.view",
];

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: [ALL_PERMISSIONS],

  ADMIN: [
    "school.info", "dashboard.view",
    "student.view_all", "student.create", "student.update", "student.export",
    "attendance.view_all", "attendance.update", "attendance.export",
    "schedule.view", "schedule.manage",
    "booking.view_all", "booking.approve", "room.manage",
    "shop.view_products", "shop.manage_products", "shop.view_all_orders", "shop.manage_orders",
    "equipment.view_items", "equipment.manage_items", "equipment.view_all_requests", "equipment.approve",
    "feedback.view_all", "feedback.manage",
    "project.view", "project.manage",
    "notifications.send", "iot.manage",
  ],

  EXECUTIVE: [
    "school.info", "dashboard.view",
    "student.view_all", "attendance.view_all",
    "booking.view_all", "schedule.view", "feedback.view_all",
  ],

  REGISTRAR: [
    "school.info", "dashboard.view",
    "student.view_all", "student.create", "student.update", "student.export",
    "schedule.view",
  ],

  FINANCE: ["school.info", "dashboard.view", "student.view_all"],

  // Also the mapping target for the legacy `staff` role, so it must cover
  // everything staff can reach today. The admin panel's NAV_SECTIONS applies no
  // role gating, so staff currently opens every tab; the API convention is that
  // mutations check ["superadmin","admin"] and reads do not. The two shop.view_*
  // entries preserve that read access — without them the products and
  // shoporders tabs would break for staff.
  ACADEMIC: [
    "school.info", "dashboard.view",
    "student.view_all",
    "attendance.view_all", "attendance.update",
    "schedule.view", "schedule.manage",
    "booking.view_all", "booking.approve",
    "equipment.view_items", "equipment.view_own_requests", "equipment.create_request",
    "feedback.view_all", "project.view",
    "shop.view_products", "shop.view_all_orders",
  ],

  STUDENT_AFFAIRS: [
    "school.info", "dashboard.view",
    "student.view_all", "attendance.view_all",
    "feedback.view_all", "feedback.manage",
  ],

  TEACHER: [
    "school.info", "schedule.view",
    "student.view_all", "attendance.view_all", "attendance.update",
    "booking.view_all", "booking.create",
    "equipment.view_items", "equipment.view_own_requests", "equipment.create_request",
    "project.view",
  ],

  // Scoped: view_advisees resolves through user_roles.scope_id -> class_groups.id
  ADVISOR: [
    "school.info", "schedule.view",
    "student.view_advisees", "attendance.view_advisees",
    "booking.create", "equipment.view_items", "equipment.create_request",
  ],

  DUAL_EDUCATION: ["school.info", "dashboard.view", "student.view_all", "attendance.view_all"],

  ACTIVITY: ["school.info", "dashboard.view", "student.view_all", "notifications.send"],

  LIBRARY: ["school.info", "student.view_all", "library.manage"],

  NURSE: ["school.info", "student.view_all"],

  ASSET_MANAGER: [
    "school.info",
    "equipment.view_items", "equipment.manage_items",
    "equipment.view_all_requests", "equipment.approve",
  ],

  MAINTENANCE: ["school.info", "equipment.view_items"],

  SHOP_MANAGER: [
    "school.info",
    "shop.view_products", "shop.manage_products",
    "shop.view_all_orders", "shop.manage_orders",
  ],

  STUDENT: STUDENT_PERMISSIONS,

  PARENT: ["school.info", "student.view_children", "attendance.view_children", "schedule.view"],

  ALUMNI: ["school.info", "project.view"],

  GUEST: ["school.info"],
};

/**
 * Legacy `admins.role` -> new Role.
 *
 * Existing accounts keep EXACTLY their current access: this is a rename, not
 * a re-grant. `staff` maps to ACADEMIC because that is the closest match to
 * what README documents staff can already reach (dashboard, students, checkin,
 * bookings, shop, projects, feedback, settings).
 */
export const LEGACY_ADMIN_ROLE_MAP: Record<string, Role> = {
  superadmin: "SUPER_ADMIN",
  admin: "ADMIN",
  staff: "ACADEMIC",
};

/** Default role for an account that has no explicit user_roles row. */
export const DEFAULT_ROLE_BY_SUBJECT: Record<SubjectType, Role> = {
  admin: "ACADEMIC",
  teacher: "TEACHER",
  student: "STUDENT",
  parent: "PARENT",
  alumni: "ALUMNI",
};

/**
 * FROZEN legacy model for the AI agent's own role names.
 *
 * `can(ctx, ...)` gates 20+ code paths across src/lib/agent/tools/**, so these
 * sets are reproduced verbatim from the original agent/permissions.ts. They
 * are NOT derived from ROLE_PERMISSIONS above: mapping `school_admin`->ADMIN
 * or `it_admin`->ADMIN would silently widen what the agent may do, and
 * mapping `teacher`->TEACHER would silently narrow it (the agent's teacher has
 * schedule.manage and booking.approve; the new TEACHER role does not).
 *
 * Migrating the agent onto the roles above is a deliberate change with its own
 * regression pass — see LEGACY_AGENT_ROLE_MAP for the intended target.
 */
export const LEGACY_AGENT_ROLE_PERMISSIONS: Record<string, string[]> = {
  guest: ["school.info"],
  student: [
    "school.info",
    "attendance.view_own",
    "booking.view_own",
    "booking.create",
    "shop.view_products",
    "shop.view_own_orders",
    "shop.create_order",
    "equipment.view_items",
    "equipment.view_own_requests",
    "equipment.create_request",
    "schedule.view",
    "feedback.create",
    "student.view_own",
  ],
  parent: ["school.info", "attendance.view_children", "student.view_children", "schedule.view"],
  teacher: [
    "school.info",
    "attendance.view_all",
    "schedule.view",
    "schedule.manage",
    "student.view_all",
    "booking.view_all",
    "booking.create",
    "booking.approve",
    "equipment.view_items",
    "equipment.view_own_requests",
    "equipment.create_request",
  ],
  librarian: ["school.info", "student.view_all", "library.manage"],
  cooperative_staff: [
    "shop.view_products",
    "shop.manage_products",
    "shop.view_all_orders",
    "shop.manage_orders",
    "equipment.view_items",
  ],
  school_admin: [
    "school.info",
    "attendance.view_all",
    "student.view_all",
    "booking.view_all",
    "booking.approve",
    "equipment.view_items",
    "equipment.view_own_requests",
    "equipment.create_request",
    // ทั้ง admin และ staff map มาเป็น school_admin (ดู ADMIN_ROLE_MAP ใน
    // channels/web.ts) และทั้งคู่เรียก GET /api/admin/equipment-requests
    // ได้อยู่แล้วโดยไม่ถูกจำกัด role สิทธิ์นี้จึงตรงกับของเดิม ไม่ได้ขยายเพิ่ม
    "equipment.view_all_requests",
    "feedback.view_all",
    "feedback.manage",
    "schedule.view",
    "schedule.manage",
    "dashboard.view",
    "notifications.send",
    "shop.view_all_orders",
  ],
  executive: [
    "school.info",
    "dashboard.view",
    "attendance.view_all",
    "student.view_all",
    "feedback.view_all",
    "booking.view_all",
    "schedule.view",
  ],
  it_admin: [
    "school.info",
    "iot.manage",
    "student.view_all",
    "dashboard.view",
    "system.manage",
    "schedule.view",
  ],
  superadmin: [ALL_PERMISSIONS],
};

/**
 * Intended target when the agent migrates onto the roles above.
 * Not used for enforcement yet — see the note on
 * LEGACY_AGENT_ROLE_PERMISSIONS for why.
 */
export const LEGACY_AGENT_ROLE_MAP: Record<string, Role> = {
  guest: "GUEST",
  student: "STUDENT",
  parent: "PARENT",
  teacher: "TEACHER",
  librarian: "LIBRARY",
  cooperative_staff: "SHOP_MANAGER",
  school_admin: "ADMIN",
  executive: "EXECUTIVE",
  it_admin: "ADMIN",
  superadmin: "SUPER_ADMIN",
};

export function isRole(value: string): value is Role {
  return value in ROLE_PERMISSIONS;
}

/** Union of the permissions granted by every role held. */
export function permissionsForRoles(roles: readonly Role[]): string[] {
  const out = new Set<string>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) out.add(permission);
  }
  return [...out];
}

/** Does this permission set satisfy `permission`? */
export function hasPermission(permissions: readonly string[], permission: string): boolean {
  return permissions.includes(ALL_PERMISSIONS) || permissions.includes(permission);
}
