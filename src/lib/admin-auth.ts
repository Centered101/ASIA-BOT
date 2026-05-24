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
};

export async function checkAdminAuth(req: Request): Promise<AdminSession | null> {
  const adminId = req.headers.get("x-admin-id");
  if (!adminId) return null;

  // Env var fallback: admin_id token IS the ADMIN_PASSWORD
  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && adminId === envPassword) {
    return { id: "env", admin_id: "env", role: "superadmin", first_name: "Admin", last_name: null };
  }

  // DB lookup
  const { data } = await supabase
    .from("admins")
    .select("id, admin_id, role, first_name, last_name, admin_status")
    .eq("admin_id", adminId)
    .eq("admin_status", "active")
    .single();

  if (!data) return null;
  return { id: data.id, admin_id: data.admin_id, role: data.role, first_name: data.first_name, last_name: data.last_name };
}
