import { z } from "zod";

/**
 * รูปร่างข้อมูลของแฟ้มนักเรียน — ใช้ร่วมกันระหว่างฝั่งแอดมินกับฝั่งนักเรียน
 *
 * เดิม schema พวกนี้ประกาศอยู่ในไฟล์ route ของแอดมินแต่ละตัว พอเปิดให้นักเรียน
 * กรอกเองได้ ถ้าก๊อปไปไว้อีกฝั่งจะกลายเป็นสองชุดที่ต้องแก้พร้อมกัน แล้ววันหนึ่ง
 * กฎจะเพี้ยนกัน เช่นแอดมินบังคับ GPA 0-4 แต่ฝั่งนักเรียนไม่บังคับ
 */

export const GUARDIAN_RELATIONSHIPS = ["บิดา", "มารดา", "ผู้ปกครอง", "ญาติ", "อื่นๆ"] as const;

export const GuardianSchema = z.object({
  full_name: z.string().trim().min(1, "ต้องระบุชื่อผู้ปกครอง"),
  relationship: z.enum(GUARDIAN_RELATIONSHIPS).optional(),
  phone: z.string().trim().nullable().optional(),
  phone_alt: z.string().trim().nullable().optional(),
  email: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง").nullable().optional().or(z.literal("")),
  line_user_id: z.string().trim().nullable().optional(),
  national_id: z.string().trim().nullable().optional(),
  occupation: z.string().trim().nullable().optional(),
  workplace: z.string().trim().nullable().optional(),
  income_range: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  is_primary: z.boolean().optional(),
  is_emergency_contact: z.boolean().optional(),
  note: z.string().trim().nullable().optional(),
});

export const EducationSchema = z.object({
  school_name: z.string().trim().min(1, "ต้องระบุชื่อโรงเรียนเดิม"),
  level: z.string().trim().nullable().optional(),
  province: z.string().trim().nullable().optional(),
  // CHECK ใน DB บังคับ 0-4 อยู่แล้ว ตรวจซ้ำที่นี่เพื่อให้ได้ข้อความไทยแทน error ดิบ
  gpa: z.number().min(0, "GPA ต้องอยู่ระหว่าง 0-4").max(4, "GPA ต้องอยู่ระหว่าง 0-4").nullable().optional(),
  graduated_year: z.string().trim().nullable().optional(),
  document_url: z.string().trim().url("ลิงก์เอกสารไม่ถูกต้อง").nullable().optional().or(z.literal("")),
  note: z.string().trim().nullable().optional(),
});

export const ACHIEVEMENT_KINDS = ["competition", "award", "certificate", "performance", "publication"] as const;
export const ACHIEVEMENT_LEVELS = ["school", "district", "province", "region", "national", "international"] as const;

export const AchievementSchema = z.object({
  kind: z.enum(ACHIEVEMENT_KINDS).optional(),
  title: z.string().trim().min(1, "ต้องระบุชื่อผลงาน"),
  level: z.enum(ACHIEVEMENT_LEVELS).nullable().optional(),
  rank: z.string().trim().nullable().optional(),
  organizer: z.string().trim().nullable().optional(),
  event_name: z.string().trim().nullable().optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD").nullable().optional(),
  academic_year: z.string().trim().nullable().optional(),
  team_members: z.string().trim().nullable().optional(),
  advisor_name: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  image_urls: z.array(z.string().trim()).nullable().optional(),
  document_url: z.string().trim().nullable().optional(),
});

/**
 * ตอนแก้ไขทุกช่องเป็น optional แต่ต้องมี id เสมอ
 *
 * เขียนแยกทีละตัวแทนการทำ helper generic เพราะ helper ทำให้ TypeScript
 * สรุปชนิดของ id กลายเป็น unknown แล้วโค้ดที่เรียกใช้ต้อง cast ทิ้งทั้งหมด
 */
const editId = { id: z.string().uuid("ต้องระบุ id ของรายการที่จะแก้") };

export const GuardianUpdateSchema = GuardianSchema.partial().extend(editId);
export const EducationUpdateSchema = EducationSchema.partial().extend(editId);
export const AchievementUpdateSchema = AchievementSchema.partial().extend(editId);
