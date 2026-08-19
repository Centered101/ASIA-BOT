import { studentChildRoutes } from "@/lib/server/student-records";
import { AchievementSchema, AchievementUpdateSchema } from "@/lib/server/student-record-schemas";

// ผลงาน รางวัล และการแข่งขันรายบุคคล
// schema อยู่ที่ student-record-schemas.ts เพราะฝั่งนักเรียนใช้ชุดเดียวกัน

export const { GET, POST, PATCH, DELETE } = studentChildRoutes({
  table: "student_achievements",
  label: "ผลงาน",
  auditEntity: "achievement",
  createSchema: AchievementSchema,
  updateSchema: AchievementUpdateSchema,
  orderBy: "event_date",
});
