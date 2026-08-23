/**
 * ตัวเลือกและป้ายไทยของแฟ้มนักเรียน — ใช้ได้ทั้งฝั่ง client และ server
 *
 * แยกออกจาก student-record-schemas.ts เพราะไฟล์นั้น import zod ซึ่งไม่ควรถูก
 * ลากเข้า bundle ฝั่งผู้ใช้เพียงเพื่อเอารายการตัวเลือกไปวาด dropdown
 *
 * ป้ายไทยเคยเขียนซ้ำอยู่สองหน้า (แฟ้มฝั่งแอดมินกับฝั่งนักเรียน) แล้วแปลไม่ตรงกัน
 * — national เคยเป็นทั้ง "ระดับชาติ" และ "ระดับประเทศ" นักเรียนกับครูจึงเห็น
 * ผลงานชิ้นเดียวกันคนละชื่อ ย้ายมารวมที่นี่เพื่อให้เพิ่มค่าใหม่ทีเดียวได้ทุกหน้า
 */

export const GUARDIAN_RELATIONSHIPS = ["บิดา", "มารดา", "ผู้ปกครอง", "ญาติ", "อื่นๆ"] as const;

export const ACHIEVEMENT_KINDS = [
  "competition", "award", "certificate", "performance", "publication",
] as const;

export const ACHIEVEMENT_LEVELS = [
  "school", "district", "province", "region", "national", "international",
] as const;

export const KIND_TH: Record<string, string> = {
  competition: "การแข่งขัน", award: "รางวัล", certificate: "เกียรติบัตร",
  performance: "การแสดง", publication: "ผลงานเผยแพร่",
};

export const LEVEL_TH: Record<string, string> = {
  school: "ระดับโรงเรียน", district: "ระดับอำเภอ", province: "ระดับจังหวัด",
  region: "ระดับภาค", national: "ระดับชาติ", international: "ระดับนานาชาติ",
};

export const SCOPE_TH: Record<string, string> = {
  class: "ระดับห้อง", department: "ระดับสาขา", school: "ระดับโรงเรียน",
  club: "ชมรม", other: "อื่นๆ",
};

/** สถานะนักเรียน ตรงกับ CHECK ของคอลัมน์ students.student_status */
export const STATUS_TH: Record<string, string> = {
  studying: "กำลังเรียน", on_leave: "พักการเรียน", transferred: "ย้ายสถานศึกษา",
  graduated: "จบการศึกษา", resigned: "ลาออก", expelled: "ให้ออก",
};

/** ชนิดการเปลี่ยนแปลงในไทม์ไลน์ ตรงกับ student_status_changes.change_type */
export const CHANGE_TH: Record<string, string> = {
  status: "เปลี่ยนสถานะ", department: "ย้ายสาขา", class_group: "ย้ายห้อง",
  advisor: "เปลี่ยนครูที่ปรึกษา", program: "เปลี่ยนหลักสูตร",
};
