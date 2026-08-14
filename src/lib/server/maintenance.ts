import type { MaintenanceStatus, MaintenanceTargetKind } from "@/types/database";

/**
 * ตรรกะของ workflow งานซ่อม แยกออกมาจาก route เพื่อให้ทดสอบได้โดยไม่ต้องมี DB
 *
 * ไม่มี "server-only" ที่หัวไฟล์โดยตั้งใจ — ไฟล์นี้เป็นตรรกะล้วน ไม่แตะ
 * ฐานข้อมูลหรือ secret หน้า UI จึงนำ ALLOWED ไปใช้ตัดสินว่าจะแสดงปุ่มไหนได้
 * ไม่ต้องเดาเองแล้วหลุดไม่ตรงกับฝั่ง server
 */

/** ลำดับขั้นปกติของงานซ่อม ใช้แสดงเป็นแถบความคืบหน้าใน UI */
export const MAINTENANCE_FLOW: MaintenanceStatus[] = [
  "reported",
  "received",
  "inspecting",
  "assigned",
  "repairing",
  "waiting_inspection",
  "completed",
];

export const MAINTENANCE_STATUS_TH: Record<MaintenanceStatus, string> = {
  reported: "แจ้งเข้ามา",
  received: "รับเรื่องแล้ว",
  inspecting: "กำลังตรวจสอบ",
  assigned: "มอบหมายช่างแล้ว",
  repairing: "กำลังซ่อม",
  waiting_inspection: "รอตรวจรับ",
  completed: "ตรวจรับแล้ว",
  cancelled: "ยกเลิก",
};

/**
 * สถานะไหนไปสถานะไหนได้บ้าง
 *
 * กติกา:
 *  - เดินหน้าได้ทีละขั้นตามลำดับ ห้ามข้าม เพราะการข้ามจาก reported ไป
 *    completed แปลว่าไม่มีใครตรวจสอบหรือรับงานเลย แต่ระบบจะบันทึกว่าซ่อมเสร็จ
 *  - ถอยหลังได้เฉพาะกรณีที่เกิดจริง: ตรวจรับไม่ผ่านต้องกลับไปซ่อมใหม่
 *    และมอบหมายผิดคนต้องกลับไปตรวจสอบใหม่
 *  - ยกเลิกได้จากทุกขั้นที่ยังไม่ปิดงาน
 *  - completed กับ cancelled เป็นปลายทาง ไม่ไปไหนต่อ ถ้าต้องซ่อมอีกให้เปิด
 *    คำขอใหม่ ประวัติของรอบก่อนจะได้ไม่ถูกเขียนทับ
 */
export const MAINTENANCE_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  reported: ["received", "cancelled"],
  received: ["inspecting", "cancelled"],
  inspecting: ["assigned", "cancelled"],
  assigned: ["repairing", "inspecting", "cancelled"],
  repairing: ["waiting_inspection", "cancelled"],
  waiting_inspection: ["completed", "repairing", "cancelled"],
  completed: [],
  cancelled: [],
};

/** ทุกสถานะที่มีอยู่จริง ใช้ตรวจค่าที่มาจาก query string */
export const ALL_STATUSES: MaintenanceStatus[] = [...MAINTENANCE_FLOW, "cancelled"];

export function canTransition(from: MaintenanceStatus, to: MaintenanceStatus): boolean {
  return MAINTENANCE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** ข้อความไทยบอกว่าทำไมเปลี่ยนไม่ได้ ใช้ตอบกลับ API ตรง ๆ */
export function transitionError(
  from: MaintenanceStatus,
  to: MaintenanceStatus
): string | null {
  if (from === to) return "สถานะเดิมกับสถานะใหม่เหมือนกัน";
  if (canTransition(from, to)) return null;

  if (MAINTENANCE_TRANSITIONS[from].length === 0) {
    return `งานนี้อยู่สถานะ "${MAINTENANCE_STATUS_TH[from]}" ซึ่งปิดแล้ว เปลี่ยนต่อไม่ได้ ถ้าต้องซ่อมอีกให้เปิดคำขอใหม่`;
  }

  const allowed = MAINTENANCE_TRANSITIONS[from]
    .map((s) => MAINTENANCE_STATUS_TH[s])
    .join(" หรือ ");
  return `เปลี่ยนจาก "${MAINTENANCE_STATUS_TH[from]}" ไป "${MAINTENANCE_STATUS_TH[to]}" ไม่ได้ ขั้นถัดไปที่ทำได้คือ ${allowed}`;
}

/** สถานะที่ถือว่างานยังค้างอยู่ ใช้กรองคิวงานและนับยอด */
export const OPEN_STATUSES: MaintenanceStatus[] = MAINTENANCE_FLOW.filter(
  (s) => s !== "completed"
);

/**
 * ตรวจว่าคำขอระบุ "ของที่จะซ่อม" ครบตาม target_kind ที่เลือกหรือไม่
 *
 * DB มี CHECK constraint กติกาเดียวกันเป็นด่านสุดท้าย แต่ตรวจที่นี่ด้วย
 * เพื่อให้ผู้ใช้ได้ข้อความไทยที่บอกว่าขาดอะไร แทน error 23514 ดิบ ๆ
 */
export function targetError(input: {
  target_kind: MaintenanceTargetKind;
  asset_id?: string | null;
  equipment_item_id?: string | null;
  room_id?: string | null;
  target_label?: string | null;
}): string | null {
  switch (input.target_kind) {
    case "asset":
      return input.asset_id ? null : "เลือกครุภัณฑ์ที่จะแจ้งซ่อม";
    case "equipment_item":
      return input.equipment_item_id ? null : "เลือกอุปกรณ์ที่จะแจ้งซ่อม";
    case "room":
      return input.room_id ? null : "เลือกห้องที่จะแจ้งซ่อม";
    case "other":
      return input.target_label?.trim()
        ? null
        : "ระบุชื่อสิ่งที่จะซ่อม เช่น โต๊ะตัวที่สามในห้อง 302";
  }
}

/** รหัสคำขอ รูปแบบเดียวกับ equipment_requests เพื่อให้อ่านคู่กันได้ */
export function generateRequestCode(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MT-${today}-${suffix}`;
}
