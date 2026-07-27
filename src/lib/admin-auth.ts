import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export async function checkAdminAuth(req: Request): Promise<AdminSession | null> {
  const adminId = req.headers.get("x-admin-id");
  if (!adminId) return null;

  const fallbackUsername = process.env.ADMIN_FALLBACK_USERNAME;
  const fallbackPassword = process.env.ADMIN_FALLBACK_PASSWORD;
  if (fallbackUsername && fallbackPassword && adminId === "__env_superadmin__") {
    return { id: "env", admin_id: "__env_superadmin__", role: "superadmin", first_name: "Super Admin", last_name: null, avatar: null };
  }

  // Env var fallback: admin_id token IS the ADMIN_PASSWORD
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && adminId === envPassword) {
    return { id: "env", admin_id: "env", role: "superadmin", first_name: "Admin", last_name: null, avatar: null };
  }

  // DB lookup
  const { data } = await supabase
    .from("admins")
    .select("id, admin_id, role, first_name, last_name, avatar, admin_status")
    .eq("admin_id", adminId)
    .eq("admin_status", "active")
    .single();

  if (!data) return null;
  return { id: data.id, admin_id: data.admin_id, role: data.role, first_name: data.first_name, last_name: data.last_name, avatar: data.avatar };
}
