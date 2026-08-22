import { describe, it, expect } from "vitest";
import {
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  LEGACY_ADMIN_ROLE_MAP,
  LEGACY_AGENT_ROLE_MAP,
  LEGACY_AGENT_ROLE_PERMISSIONS,
  DEFAULT_ROLE_BY_SUBJECT,
  ALL_PERMISSIONS,
  isRole,
  permissionsForRoles,
  hasPermission,
  type Role,
} from "./definitions";

const ROLES = Object.keys(ROLE_PERMISSIONS) as Role[];

/** Every permission string any role grants, minus the wildcard. */
const KNOWN_PERMISSIONS = new Set(
  ROLES.flatMap((r) => ROLE_PERMISSIONS[r]).filter((p) => p !== ALL_PERMISSIONS),
);

describe("role table", () => {
  it("gives every role a label", () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role], `${role} has no label`).toBeTruthy();
    }
  });

  it("only grants permissions in module.action form", () => {
    for (const permission of KNOWN_PERMISSIONS) {
      expect(permission, `"${permission}" is not module.action`).toMatch(
        /^[a-z_]+\.[a-z_]+$/,
      );
    }
  });

  it("treats every declared role as a role", () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true);
    expect(isRole("NOT_A_ROLE")).toBe(false);
  });
});

describe("legacy admin roles keep their access", () => {
  // The admins.role column still drives access for anyone whose account has no
  // explicit user_roles grant. If this map loses an entry, that admin silently
  // falls back to the subject-type default — which is exactly the bug that made
  // every superadmin resolve to ACADEMIC and lose write access.
  it("maps all three legacy values", () => {
    expect(Object.keys(LEGACY_ADMIN_ROLE_MAP).sort()).toEqual([
      "admin",
      "staff",
      "superadmin",
    ]);
  });

  it("maps them to roles that exist", () => {
    for (const role of Object.values(LEGACY_ADMIN_ROLE_MAP)) {
      expect(isRole(role)).toBe(true);
    }
  });

  it("keeps superadmin unrestricted", () => {
    const permissions = permissionsForRoles([LEGACY_ADMIN_ROLE_MAP.superadmin]);
    expect(hasPermission(permissions, "shop.manage_products")).toBe(true);
    expect(hasPermission(permissions, "anything.at.all")).toBe(true);
  });

  it("lets admin manage the shop but not staff", () => {
    const admin = permissionsForRoles([LEGACY_ADMIN_ROLE_MAP.admin]);
    const staff = permissionsForRoles([LEGACY_ADMIN_ROLE_MAP.staff]);

    expect(hasPermission(admin, "shop.manage_products")).toBe(true);
    expect(hasPermission(staff, "shop.manage_products")).toBe(false);

    // staff must keep read access — the admin UI shows them those tabs.
    expect(hasPermission(staff, "shop.view_products")).toBe(true);
    expect(hasPermission(staff, "shop.view_all_orders")).toBe(true);
  });
});

describe("agent role bridge", () => {
  it("maps every agent role to a role that exists", () => {
    for (const [agentRole, role] of Object.entries(LEGACY_AGENT_ROLE_MAP)) {
      expect(isRole(role), `${agentRole} maps to unknown ${role}`).toBe(true);
    }
  });

  it("covers every agent role the permission table declares", () => {
    for (const agentRole of Object.keys(LEGACY_AGENT_ROLE_PERMISSIONS)) {
      expect(
        LEGACY_AGENT_ROLE_MAP[agentRole],
        `${agentRole} has permissions but no role mapping`,
      ).toBeTruthy();
    }
  });
});

describe("defaults per subject type", () => {
  it("assigns a real role to every subject type", () => {
    for (const [subject, role] of Object.entries(DEFAULT_ROLE_BY_SUBJECT)) {
      expect(isRole(role), `${subject} defaults to unknown ${role}`).toBe(true);
    }
  });

  it("does not let a default grant write access", () => {
    // A default is what someone gets when no grant was found. It must never be
    // more than the least-privilege read role for that subject.
    for (const role of Object.values(DEFAULT_ROLE_BY_SUBJECT)) {
      const permissions = permissionsForRoles([role]);
      expect(permissions).not.toContain(ALL_PERMISSIONS);
    }
  });
});

describe("permissionsForRoles", () => {
  it("merges without duplicating", () => {
    const merged = permissionsForRoles(["ACADEMIC", "ACADEMIC"]);
    expect(merged.length).toBe(new Set(merged).size);
  });

  it("collapses to the wildcard when any role is unrestricted", () => {
    expect(permissionsForRoles(["SUPER_ADMIN", "STUDENT"])).toContain(
      ALL_PERMISSIONS,
    );
  });

  it("returns nothing for no roles", () => {
    expect(permissionsForRoles([])).toEqual([]);
  });
});

describe("hasPermission", () => {
  it("matches exactly, not by prefix", () => {
    expect(hasPermission(["shop.view_products"], "shop.view")).toBe(false);
    expect(hasPermission(["shop.view_products"], "shop.view_products")).toBe(true);
  });

  it("denies when nothing is granted", () => {
    expect(hasPermission([], "shop.view_products")).toBe(false);
  });
});

describe("เอกสาร (0023)", () => {
  const can = (role: Role, perm: string) =>
    hasPermission(permissionsForRoles([role]), perm);

  it("ให้นักเรียนส่งและขอเอกสารของตัวเอง แต่ตรวจของคนอื่นไม่ได้", () => {
    expect(can("STUDENT", "document.upload_own")).toBe(true);
    expect(can("STUDENT", "document.request")).toBe(true);
    expect(can("STUDENT", "document.view_all")).toBe(false);
    expect(can("STUDENT", "document.review")).toBe(false);
  });

  it("ให้ศิษย์เก่าขอเอกสารได้", () => {
    // เหตุผลหลักที่ศิษย์เก่ากลับมาที่ระบบคือขอ Transcript ถ้าขอไม่ได้
    // บัญชีศิษย์เก่าก็ไม่มีประโยชน์
    expect(can("ALUMNI", "document.request")).toBe(true);
    expect(can("ALUMNI", "document.view_own")).toBe(true);
    expect(can("ALUMNI", "document.review")).toBe(false);
  });

  it("ให้ฝ่ายทะเบียนตรวจและออกเอกสาร", () => {
    expect(can("REGISTRAR", "document.view_all")).toBe(true);
    expect(can("REGISTRAR", "document.review")).toBe(true);
    expect(can("REGISTRAR", "document.issue")).toBe(true);
  });

  it("ยังไม่ให้ครูที่ปรึกษาและฝ่ายวิชาการเห็นเอกสารทุกคน", () => {
    // document.view_all แปลว่าเห็นเอกสารของนักเรียนทั้งโรงเรียน ซึ่งกว้างเกิน
    // สำหรับครูที่ปรึกษาที่ควรเห็นเฉพาะเด็กในที่ปรึกษา — ต้องรอ scope
    // (user_roles.scope_id) ต่อเข้ากับโมดูลนี้ก่อน
    expect(can("ADVISOR", "document.view_all")).toBe(false);
    expect(can("ACADEMIC", "document.view_all")).toBe(false);
  });
});
