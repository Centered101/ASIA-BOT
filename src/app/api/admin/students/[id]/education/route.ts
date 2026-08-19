import { studentChildRoutes } from "@/lib/server/student-records";
import { EducationSchema, EducationUpdateSchema } from "@/lib/server/student-record-schemas";

// ประวัติการศึกษาก่อนเข้าเรียนที่นี่ — โรงเรียนเดิม วุฒิที่ใช้สมัคร
// schema อยู่ที่ student-record-schemas.ts เพราะฝั่งนักเรียนใช้ชุดเดียวกัน

export const { GET, POST, PATCH, DELETE } = studentChildRoutes({
  table: "student_education_history",
  label: "ประวัติการศึกษา",
  auditEntity: "student_education",
  createSchema: EducationSchema,
  updateSchema: EducationUpdateSchema,
  orderBy: "graduated_year",
});
