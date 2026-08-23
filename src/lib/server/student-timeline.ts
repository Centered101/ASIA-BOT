import "server-only";
import { getServiceClient } from "./supabase-server";
import { STATUS_TH } from "@/lib/student-record-options";

/**
 * แปลงค่าในไทม์ไลน์ให้เป็นคำที่คนอ่านออก
 *
 * student_status_changes เก็บ from_value/to_value เป็น text เพื่อให้ตารางเดียว
 * บันทึกการเปลี่ยนของคอลัมน์ไหนก็ได้ (ดู 0012) ราคาที่จ่ายคือค่าที่เก็บไว้เป็น
 * "ค่าดิบของคอลัมน์นั้น" — ย้ายห้องจึงได้ uuid ของ class_group และเปลี่ยนครู
 * ที่ปรึกษาได้ id ของครู
 *
 * ผลที่นักเรียนเห็นก่อนมีไฟล์นี้:
 *   ย้ายห้อง  fe0e7f21-0da4-4bc0-88ad-259b0ecc5bd5 · มีผล 19 ส.ค. 2569
 *
 * ซึ่งไม่ได้บอกอะไรกับเจ้าของแฟ้มเลย แปลที่ฝั่งเซิร์ฟเวอร์ไม่ใช่ที่ UI เพราะ
 * ต้องอ่านตารางอื่นมาประกอบ และมีสองหน้าที่แสดงไทม์ไลน์ชุดเดียวกัน
 * (แฟ้มของนักเรียน กับ Student 360 ของฝ่ายทะเบียน)
 */

type TimelineRow = {
  change_type: string;
  from_value: string | null;
  to_value: string | null;
};

export type LabelledTimelineRow<T> = T & {
  from_label: string | null;
  to_label: string | null;
};

/** ค่าที่ไม่ใช่ uuid แปลว่าเป็นข้อความอยู่แล้ว ไม่ต้องไปหาในตารางอื่น */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withTimelineLabels<T extends TimelineRow>(
  rows: T[]
): Promise<LabelledTimelineRow<T>[]> {
  if (rows.length === 0) return [];

  const idsOf = (type: string) =>
    [...new Set(
      rows
        .filter((r) => r.change_type === type)
        .flatMap((r) => [r.from_value, r.to_value])
        .filter((v): v is string => !!v && UUID.test(v))
    )];

  const groupIds = idsOf("class_group");
  const teacherIds = idsOf("advisor");

  const supabase = getServiceClient();
  const [groups, teachers] = await Promise.all([
    groupIds.length
      ? supabase.from("class_groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [], error: null }),
    teacherIds.length
      ? supabase.from("teachers").select("id, full_name, nickname").in("id", teacherIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const teacherName = new Map(
    (teachers.data ?? []).map((t) => [t.id, t.nickname ? `${t.full_name} (${t.nickname})` : t.full_name])
  );

  // หาไม่เจอให้คืนค่าเดิม ไม่ใช่คืนค่าว่าง — ห้องที่ถูกลบไปแล้วยังต้องเห็นว่า
  // เคยมีการย้ายเกิดขึ้น ดีกว่าไทม์ไลน์ที่มีบรรทัดว่างโดยไม่มีคำอธิบาย
  const label = (type: string, value: string | null): string | null => {
    if (!value) return null;
    if (type === "class_group") return groupName.get(value) ?? value;
    if (type === "advisor") return teacherName.get(value) ?? value;
    if (type === "status") return STATUS_TH[value] ?? value;
    return value;
  };

  return rows.map((r) => ({
    ...r,
    from_label: label(r.change_type, r.from_value),
    to_label: label(r.change_type, r.to_value),
  }));
}
