import type { SupabaseClient } from "@supabase/supabase-js";

export type LineNotificationType =
  | "admin"
  | "broadcast"
  | "booking"
  | "feedback"
  | "order"
  | "attendance"
  | "data_change"
  | "equipment";

const FALLBACK_ENV: Record<LineNotificationType, string | undefined> = {
  admin: process.env.LINE_GROUP_ADMIN,
  broadcast: process.env.LINE_GROUP_ADMIN,
  booking: process.env.LINE_GROUP_ADMIN,
  feedback: process.env.LINE_GROUP_ADMIN,
  order: process.env.LINE_GROUP_ADMIN,
  attendance: process.env.LINE_GROUP_ATTEND || process.env.LINE_GROUP_ADMIN,
  data_change: process.env.LINE_GROUP_ADMIN,
  equipment: process.env.LINE_GROUP_ADMIN,
};

export async function getLineNotificationTarget(
  supabase: SupabaseClient,
  type: LineNotificationType = "admin",
) {
  try {
    const exact = await supabase
      .from("line_notification_channels")
      .select("group_id")
      .eq("category_key", type)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (exact.data?.group_id) return exact.data.group_id as string;

    if (type !== "admin") {
      const admin = await supabase
        .from("line_notification_channels")
        .select("group_id")
        .eq("category_key", "admin")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (admin.data?.group_id) return admin.data.group_id as string;
    }
  } catch {
    // The table may not be migrated yet. Keep legacy env-based delivery working.
  }

  return FALLBACK_ENV[type] || process.env.LINE_GROUP_ADMIN || "";
}

export async function isLineNotificationGroup(
  supabase: SupabaseClient,
  groupId: string,
  type: LineNotificationType = "admin",
) {
  if (!groupId) return false;
  if (type === "admin" && groupId === process.env.LINE_GROUP_ADMIN) return true;
  if (type === "attendance" && groupId === process.env.LINE_GROUP_ATTEND) return true;

  try {
    const { data } = await supabase
      .from("line_notification_channels")
      .select("id")
      .eq("group_id", groupId)
      .eq("category_key", type)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    return Boolean(data?.id);
  } catch {
    return false;
  }
}

export async function recordLineGroupSeen(supabase: SupabaseClient, groupId: string) {
  if (!groupId) return;

  try {
    const { data: existing } = await supabase
      .from("line_notification_channels")
      .select("id")
      .eq("group_id", groupId)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("line_notification_channels")
        .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      return;
    }

    await supabase
      .from("line_notification_channels")
      .insert({
        group_id: groupId,
        name: `LINE group ${groupId.slice(-6)}`,
        category_key: "admin",
        is_active: false,
        is_default: false,
        notes: "พบจาก LINE webhook อัตโนมัติ รอ superadmin เปิดใช้งาน",
        last_seen_at: new Date().toISOString(),
      });
  } catch {
    // Ignore when the migration has not been applied.
  }
}
