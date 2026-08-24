import { describe, it, expect } from "vitest";

import { ALL_TOOLS, getToolsForRole } from "./index";
import { studentTools } from "./students";
import { attendanceTools } from "./attendance";
import { bookingTools } from "./booking";
import { shopTools } from "./shop";
import { scheduleTools } from "./schedule";
import { feedbackTools } from "./feedback";
import { equipmentTools } from "./equipment";
import { dashboardTools } from "./dashboard";
import { documentTools } from "./documents";
import { notificationTools } from "./notifications";
import { maintenanceTools } from "./maintenance";
import type { UserRole } from "../types";

/**
 * Registering an agent tool takes five separate edits: import it, spread it
 * into ALL_TOOLS, allow it per role, map it in TOOL_MODULES, and add a case to
 * executeToolCall. Nothing checked that those five agreed, and they drifted —
 * attendance.ts exported three working tools that no file imported, so the
 * agent could not answer a single attendance question while ChatBubble still
 * rendered a card for them.
 *
 * These tests exist so that drift fails the build instead of going unnoticed.
 */

const DECLARED = [
  ...studentTools,
  ...attendanceTools,
  ...bookingTools,
  ...shopTools,
  ...scheduleTools,
  ...feedbackTools,
  ...equipmentTools,
  ...documentTools,
  ...notificationTools,
  ...maintenanceTools,
  ...dashboardTools,
];

const ROLES: UserRole[] = [
  "guest",
  "student",
  "parent",
  "teacher",
  "librarian",
  "cooperative_staff",
  "school_admin",
  "executive",
  "it_admin",
  "superadmin",
];

describe("tool registry", () => {
  it("registers every tool declared by a tool module", () => {
    const registered = new Set(ALL_TOOLS.map((t) => t.name));
    const missing = DECLARED.map((t) => t.name).filter((n) => !registered.has(n));
    expect(missing, `declared but not in ALL_TOOLS: ${missing.join(", ")}`).toEqual([]);
  });

  it("registers nothing that no module declares", () => {
    const declared = new Set(DECLARED.map((t) => t.name));
    const ghosts = ALL_TOOLS.map((t) => t.name).filter((n) => !declared.has(n));
    expect(ghosts, `in ALL_TOOLS with no implementation: ${ghosts.join(", ")}`).toEqual([]);
  });

  it("names each tool once", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(names.length).toBe(new Set(names).size);
  });

  it("gives every tool a description and an object schema", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.description, `${tool.name} has no description`).toBeTruthy();
      expect(tool.input_schema.type, `${tool.name} schema is not an object`).toBe("object");
    }
  });
});

describe("per-role allowlists", () => {
  it("never allows a tool that does not exist", () => {
    const registered = new Set(ALL_TOOLS.map((t) => t.name));
    for (const role of ROLES) {
      const ghosts = getToolsForRole(role)
        .map((t) => t.name)
        .filter((n) => !registered.has(n));
      expect(ghosts, `${role} allows unknown: ${ghosts.join(", ")}`).toEqual([]);
    }
  });

  it("gives superadmin everything", () => {
    expect(getToolsForRole("superadmin").length).toBe(ALL_TOOLS.length);
  });

  it("gives guest only public school info", () => {
    expect(getToolsForRole("guest").map((t) => t.name)).toEqual(["get_school_info"]);
  });

  it("never lets a student reach an all-students tool", () => {
    const names = getToolsForRole("student").map((t) => t.name);
    expect(names).not.toContain("search_students");
    expect(names).not.toContain("get_all_orders");
    expect(names).not.toContain("get_all_bookings");
    expect(names).not.toContain("get_school_stats");
  });
});

describe("attendance tools", () => {
  // The regression this suite was written for.
  const NAMES = [
    "get_attendance_status",
    "get_attendance_summary",
    "get_attendance_by_date_range",
  ];

  it("are registered", () => {
    const registered = ALL_TOOLS.map((t) => t.name);
    for (const name of NAMES) expect(registered).toContain(name);
  });

  it("reach students, teachers, school admins, and superadmins", () => {
    for (const role of ["student", "teacher", "school_admin", "superadmin"] as UserRole[]) {
      const names = getToolsForRole(role).map((t) => t.name);
      expect(names, `${role} cannot see attendance`).toContain("get_attendance_status");
    }
  });

  it("stay away from roles with no attendance capability", () => {
    for (const role of ["guest", "librarian", "cooperative_staff"] as UserRole[]) {
      const names = getToolsForRole(role).map((t) => t.name);
      for (const name of NAMES) expect(names, `${role} should not have ${name}`).not.toContain(name);
    }
  });

  it("stay away from parent until the parent-student link exists", () => {
    // executeAttendanceTool only permits reading someone else with
    // attendance.view_all; parent holds attendance.view_children, so every call
    // would be denied. Granting it would be a button that always fails.
    const names = getToolsForRole("parent").map((t) => t.name);
    for (const name of NAMES) expect(names).not.toContain(name);
  });
});

describe("document, notification and maintenance tools", () => {
  // เพิ่มตอนต่อบอทเข้ากับศูนย์เอกสาร (0023) ศูนย์แจ้งเตือน (0022) และงานซ่อม
  it("let a student handle their own documents, inbox and repairs", () => {
    const names = getToolsForRole("student").map((t) => t.name);
    for (const name of [
      "get_document_types",
      "request_document",
      "get_my_document_requests",
      "get_my_documents",
      "get_my_notifications",
      "create_maintenance_request",
      "get_my_maintenance_requests",
    ]) {
      expect(names, `student cannot ${name}`).toContain(name);
    }
  });

  it("keeps school-wide queues away from students", () => {
    const names = getToolsForRole("student").map((t) => t.name);
    expect(names).not.toContain("get_pending_document_requests");
    expect(names).not.toContain("get_open_maintenance_requests");
  });

  it("gives the registrar and buildings queues to school admins", () => {
    const names = getToolsForRole("school_admin").map((t) => t.name);
    expect(names).toContain("get_pending_document_requests");
    expect(names).toContain("get_open_maintenance_requests");
  });

  it("leaves the inbox closed to guests", () => {
    expect(getToolsForRole("guest").map((t) => t.name)).not.toContain("get_my_notifications");
  });
});
