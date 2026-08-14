import { z } from "zod";
import { studentChildRoutes } from "@/lib/server/student-records";

// ผลงาน รางวัล และการแข่งขันรายบุคคล

const KINDS = ["competition", "award", "certificate", "performance", "publication"] as const;
const LEVELS = ["school", "district", "province", "region", "national", "international"] as const;

const Base = z.object({
  kind: z.enum(KINDS).optional(),
  title: z.string().trim().min(1, "ต้องระบุชื่อผลงาน"),
  level: z.enum(LEVELS).nullable().optional(),
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

export const { GET, POST, PATCH, DELETE } = studentChildRoutes({
  table: "student_achievements",
  label: "ผลงาน",
  auditEntity: "achievement",
  createSchema: Base,
  updateSchema: Base.partial().extend({ id: z.string().uuid("ต้องระบุ id ของรายการที่จะแก้") }),
  orderBy: "event_date",
});
