import { getServiceClient } from "@/lib/server/supabase-server";
import { resolvePrincipal } from "@/lib/server/session";

export type AdminSession = {
  id: string;
  admin_id: string;
  role: "superadmin" | "admin" | "staff";
  first_name: string | null;
  last_name: string | null;
  avatar: string | null;
};

export function hasAdminRole(session: AdminSession, roles: AdminSession["role"][]) {
  return roles.includes(session.role);
}

/**
 * Admin auth for API routes.
 *
 * As of Phase 1 this delegates the identity decision to `resolvePrincipal`,
 * which checks the signed session cookie first and falls back to the legacy
 * `x-admin-id` header while AUTH_LEGACY_HEADER is on. Every route that already
 * imports `checkAdminAuth` therefore gains cookie support with no edit.
 *
 * The returned shape is deliberately unchanged — 37 routes read `.admin_id`,
 * `.role`, `.first_name`, `.last_name`, `.avatar`, and `.id`, and `role` is
 * still the raw `admins.role` value so existing `hasAdminRole(...)` checks
 * behave exactly as before.
 */
export async function checkAdminAuth(req: Request): Promise<AdminSession | null> {
  const principal = await resolvePrincipal(req);
  if (!principal || principal.subjectType !== "admin") return null;

  // Break-glass env superadmins have no `admins` row to read.
  if (principal.accountId === null && (principal.subjectId === "__env_superadmin__" || principal.subjectId === "env")) {
    const isNamed = principal.subjectId === "__env_superadmin__";
    return {
      id: "env",
      admin_id: principal.subjectId,
      role: "superadmin",
      first_name: isNamed ? "Super Admin" : "Admin",
      last_name: null,
      avatar: null,
    };
  }

  const { data } = await getServiceClient()
    .from("admins")
    .select("id, admin_id, role, first_name, last_name, avatar, admin_status")
    .eq("admin_id", principal.subjectId)
    .eq("admin_status", "active")
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id,
    admin_id: data.admin_id,
    role: data.role,
    first_name: data.first_name,
    last_name: data.last_name,
    avatar: data.avatar,
  };
}
