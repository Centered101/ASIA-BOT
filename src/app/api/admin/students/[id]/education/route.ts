import { z } from "zod";
import { studentChildRoutes } from "@/lib/server/student-records";

// ประวัติการศึกษาก่อนเข้าเรียนที่นี่ — โรงเรียนเดิม วุฒิที่ใช้สมัคร

const Base = z.object({
  school_name: z.string().trim().min(1, "ต้องระบุชื่อโรงเรียนเดิม"),
  level: z.string().trim().nullable().optional(),
  province: z.string().trim().nullable().optional(),
  // CHECK ใน DB บังคับ 0-4 อยู่แล้ว ตรวจซ้ำที่นี่เพื่อให้ได้ข้อความไทยแทน error ดิบ
  gpa: z.number().min(0, "GPA ต้องอยู่ระหว่าง 0-4").max(4, "GPA ต้องอยู่ระหว่าง 0-4").nullable().optional(),
  graduated_year: z.string().trim().nullable().optional(),
  document_url: z.string().trim().url("ลิงก์เอกสารไม่ถูกต้อง").nullable().optional().or(z.literal("")),
  note: z.string().trim().nullable().optional(),
});

export const { GET, POST, PATCH, DELETE } = studentChildRoutes({
  table: "student_education_history",
  label: "ประวัติการศึกษา",
  auditEntity: "student_education",
  createSchema: Base,
  updateSchema: Base.partial().extend({ id: z.string().uuid("ต้องระบุ id ของรายการที่จะแก้") }),
  orderBy: "graduated_year",
});
