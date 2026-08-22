import "server-only";
import { getServiceClient } from "./supabase-server";

/**
 * ศูนย์แจ้งเตือน — จุดเดียวที่ทุกโมดูลเรียกเพื่อส่งเรื่องถึงคน
 *
 * ก่อนหน้านี้แต่ละโมดูลยิง LINE เข้ากลุ่มเอง (`getLineNotificationTarget` +
 * `pushLineMessage`) ซึ่งยังใช้ได้อยู่และไม่ถูกแตะ แต่กลุ่มตอบได้แค่
 * "แจ้งเจ้าหน้าที่" — ไม่ตอบ "แจ้งนักเรียนคนนี้ ครูที่ปรึกษาของเขา และผู้ปกครอง"
 * ซึ่งเป็นสิ่งที่ roadmap ข้อ 22 ต้องการ และเป็นเรื่องที่ไม่ควรโผล่ในกลุ่มรวม
 * ตั้งแต่แรก (ค่าเทอมค้าง ผลการเรียน พฤติกรรม)
 *
 * ฟังก์ชันนี้เขียนลง `notifications` ให้ผู้รับแต่ละคน โดยเคารพ
 * `notification_preferences` ถ้าเขาปิดหมวดนั้นไว้
 *
 * ตั้งใจให้ล้มแล้วไม่ลาม: การแจ้งเตือนไม่ควรทำให้การอนุมัติเอกสารหรือการ
 * บันทึกเวลาเรียนล้มเหลวตามไปด้วย ทุก error จึงถูก log แล้วกลืน และคืนจำนวน
 * ที่ส่งสำเร็จให้ผู้เรียกตัดสินใจเองว่าจะสนใจไหม
 */

export type NotifyInput = {
  /** ผู้รับ — เป็น account id เสมอ ซ้ำได้ เดี๋ยวกรองให้ */
  accountIds: string[];
  /** ต้องมีอยู่ใน line_notification_categories */
  category: string;
  title: string;
  body?: string | null;
  /** เส้นทางในแอปที่กดแล้วไปถึงเรื่องนั้น */
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  priority?: "low" | "normal" | "high";
  /** ใครเป็นต้นเหตุ ไว้ให้ audit ตามรอยได้ */
  createdBy?: string | null;
};

/** ส่งแจ้งเตือน คืนจำนวนแถวที่เขียนสำเร็จ */
export async function notify(input: NotifyInput): Promise<number> {
  const recipients = [...new Set(input.accountIds.filter(Boolean))];
  if (recipients.length === 0) return 0;

  try {
    const supabase = getServiceClient();

    // คนที่ปิดหมวดนี้ไว้ต้องไม่ได้รับ — ไม่มีแถว = รับ จึงเช็กเฉพาะที่ปิด
    const { data: muted } = await supabase
      .from("notification_preferences")
      .select("account_id")
      .eq("category_key", input.category)
      .eq("in_app", false)
      .in("account_id", recipients);

    const mutedSet = new Set((muted ?? []).map(r => r.account_id));
    const targets = recipients.filter(id => !mutedSet.has(id));
    if (targets.length === 0) return 0;

    const { error, count } = await supabase
      .from("notifications")
      .insert(
        targets.map(account_id => ({
          account_id,
          category_key: input.category,
          title: input.title,
          body: input.body ?? null,
          link: input.link ?? null,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          priority: input.priority ?? "normal",
          created_by: input.createdBy ?? null,
        })),
        { count: "exact" }
      );

    if (error) {
      console.warn("[notify] เขียนแจ้งเตือนไม่สำเร็จ:", error.message);
      return 0;
    }
    return count ?? targets.length;
  } catch (err) {
    console.warn("[notify] เขียนแจ้งเตือนไม่สำเร็จ:", err);
    return 0;
  }
}

/**
 * หา account id จาก student_id — โมดูลส่วนใหญ่รู้จักนักเรียนด้วยรหัส ไม่ใช่ account
 * รหัสที่ยังไม่ผูก account จะหายไปเงียบ ๆ ซึ่งถูกต้อง: ส่งถึงคนที่ล็อกอินไม่ได้
 * ก็ไม่มีประโยชน์
 */
export async function accountIdsForStudents(studentIds: string[]): Promise<string[]> {
  const ids = [...new Set(studentIds.filter(Boolean))];
  if (ids.length === 0) return [];
  try {
    const { data } = await getServiceClient()
      .from("students")
      .select("account_id")
      .in("student_id", ids)
      .not("account_id", "is", null);
    return (data ?? []).map(r => r.account_id).filter((v): v is string => Boolean(v));
  } catch {
    return [];
  }
}

/** หา account id ของแอดมินที่ถือ role ที่กำหนด เช่นแจ้งฝ่ายอาคารทุกคน */
export async function accountIdsForRoles(roleKeys: string[]): Promise<string[]> {
  if (roleKeys.length === 0) return [];
  try {
    const { data } = await getServiceClient()
      .from("user_roles")
      .select("account_id")
      .in("role_key", roleKeys);
    return [...new Set((data ?? []).map(r => r.account_id).filter(Boolean))];
  } catch {
    return [];
  }
}

/**
 * ลบแจ้งเตือนของเรื่องที่ถูกยกเลิก/ลบไปแล้ว
 * กันไม่ให้กดจากกล่องแล้วเจอ 404
 */
export async function dropNotificationsFor(entityType: string, entityId: string): Promise<void> {
  try {
    await getServiceClient()
      .from("notifications")
      .delete()
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
  } catch {
    /* เงียบ — เป็นการเก็บกวาด ไม่ใช่เส้นทางหลัก */
  }
}
