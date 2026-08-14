import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OPEN_STATUSES } from "./maintenance";

/**
 * จำนวนอุปกรณ์ที่ติดซ่อมอยู่ แยกตาม equipment_item
 *
 * ทำไมต้องคำนวณแทนที่จะเก็บเป็นคอลัมน์
 *
 * `equipment_items.available_quantity` ถูกเขียนโดย flow อนุมัติ/ปฏิเสธคำขอเบิก
 * อยู่แล้ว (api/admin/equipment-requests/[id]) ถ้าให้ระบบแจ้งซ่อมไปลดคอลัมน์
 * เดียวกันด้วย จะกลายเป็นสองฝ่ายเขียนเลขเดียวกันโดยไม่รู้จักกัน พอมีคำขอเบิก
 * กับงานซ่อมเกิดพร้อมกัน ยอดจะเพี้ยนแล้วกู้คืนยากเพราะไม่มีใครรู้ว่าเลขที่
 * ถูกต้องคือเท่าไหร่
 *
 * การคำนวณจากงานซ่อมที่ยังไม่ปิดจึงปลอดภัยกว่า: ไม่มีสถานะซ้ำซ้อน ไม่มี race
 * และถ้าใครลบงานซ่อมทิ้ง ยอดก็กลับมาเองโดยอัตโนมัติ
 *
 * แลกกับการ query เพิ่มหนึ่งครั้งตอนแสดงคลัง ซึ่งมี partial index รองรับแล้ว
 */
export async function equipmentUnderRepair(
  supabase: SupabaseClient,
  itemIds?: string[]
): Promise<Record<string, number>> {
  let q = supabase
    .from("maintenance_requests")
    .select("equipment_item_id, affected_quantity")
    .not("equipment_item_id", "is", null)
    .in("status", OPEN_STATUSES);

  if (itemIds?.length) q = q.in("equipment_item_id", itemIds);

  const { data, error } = await q;
  // ถ้า query ล้ม ให้ถือว่าไม่มีของติดซ่อม ดีกว่าทำให้หน้าเบิกทั้งหน้าใช้ไม่ได้
  // ผลที่แย่ที่สุดคือมีคนยืมของที่กำลังซ่อม ซึ่งเจ้าหน้าที่จับได้ตอนจ่ายของ
  if (error) {
    console.error("[maintenance-stock] นับของติดซ่อมไม่สำเร็จ:", error.message);
    return {};
  }

  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { equipment_item_id: string | null; affected_quantity: number | null }[]) {
    if (!row.equipment_item_id) continue;
    // ไม่ระบุจำนวนถือว่าเสีย 1 ชิ้น เป็นค่าที่ปลอดภัยกว่าถือว่า 0
    out[row.equipment_item_id] = (out[row.equipment_item_id] ?? 0) + (row.affected_quantity ?? 1);
  }
  return out;
}

/** จำนวนที่ยืมได้จริง = คงเหลือในคลัง ลบส่วนที่ติดซ่อม ไม่ต่ำกว่า 0 */
export function effectiveAvailable(available: number, underRepair: number): number {
  return Math.max(0, available - underRepair);
}
