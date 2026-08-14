import { z } from "zod";
import { studentChildRoutes } from "@/lib/server/student-records";

// ตำแหน่ง/ยศที่นักเรียนดำรงในโรงเรียน — ended_on = null คือยังอยู่ในตำแหน่ง

const SCOPES = ["class", "department", "school", "club", "other"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const Base = z.object({
  position: z.string().trim().min(1, "ต้องระบุชื่อตำแหน่ง"),
  scope: z.enum(SCOPES).optional(),
  scope_ref: z.string().trim().nullable().optional(),
  academic_year: z.string().trim().nullable().optional(),
  started_on: z.string().regex(DATE, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD").optional(),
  ended_on: z.string().regex(DATE, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD").nullable().optional(),
  note: z.string().trim().nullable().optional(),
});

// DB มี CHECK ว่า ended_on >= started_on แต่ constraint นั้นเห็นแค่ค่าที่ส่งมา
// ในคำสั่งเดียว ตอน PATCH ที่ส่งมาแค่ค่าเดียวจึงตรวจที่นี่ไม่ได้ทั้งหมด —
// เช็คเท่าที่ทำได้เพื่อให้ได้ข้อความไทย ที่เหลือปล่อยให้ DB เป็นด่านสุดท้าย
const withDateOrder = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (v: unknown) => {
      const o = v as { started_on?: string; ended_on?: string | null };
      if (!o.started_on || !o.ended_on) return true;
      return o.ended_on >= o.started_on;
    },
    { message: "วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม", path: ["ended_on"] }
  );

export const { GET, POST, PATCH, DELETE } = studentChildRoutes({
  table: "student_positions",
  label: "ตำแหน่ง",
  auditEntity: "student_position",
  createSchema: withDateOrder(Base),
  updateSchema: withDateOrder(
    Base.partial().extend({ id: z.string().uuid("ต้องระบุ id ของรายการที่จะแก้") })
  ),
  orderBy: "started_on",
});
