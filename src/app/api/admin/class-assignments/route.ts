import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import type { Database } from "@/types/database";

/**
 * งานที่ครูสั่งในคาบ
 *
 * ผูกกับ "คาบ + วันที่" ไม่ใช่กับ "วิชา" เพราะปลายทางคือการบอกนักเรียนที่ขาด
 * ว่าวันนั้นคาบนั้นมีงานอะไร ถ้าผูกกับวิชาเฉย ๆ จะแยกไม่ออกว่างานไหนสั่งวันที่
 * เขาขาด กับงานไหนสั่งวันที่เขามาเรียนและรับโจทย์ไปแล้ว
 *
 * ครูสั่งงานตอนเช็กชื่อในคาบเดียวกันได้เลย จึงอยู่บนหน้าเดียวกัน
 */

const CreateSchema = z.object({
  class_schedule_id: z.string().uuid(),
  assigned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD"),
  title: z.string().trim().min(1, "ต้องระบุชื่องาน"),
  description: z.string().trim().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  max_score: z.number().nonnegative("คะแนนต้องไม่ติดลบ").nullable().optional(),
  attachment_url: z.string().trim().url().nullable().optional(),
});

/**
 * แก้ได้เฉพาะเนื้อหางาน ไม่ให้ย้ายคาบหรือเปลี่ยนวันที่สั่ง
 *
 * เพราะการจับคู่ "งานที่ฉันขาด" ใช้ (คาบ, วันที่) เป็นกุญแจ ถ้าย้ายได้
 * งานที่นักเรียนเคยเห็นว่าค้างจะหายไป หรืองานที่เขารับโจทย์แล้วจะโผล่มาเป็นค้าง
 * ถ้าสั่งผิดคาบให้ลบแล้วสร้างใหม่ ซึ่งตรงกับสิ่งที่เกิดขึ้นจริง
 */
const UpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "ต้องระบุชื่องาน").optional(),
  description: z.string().trim().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  max_score: z.number().nonnegative("คะแนนต้องไม่ติดลบ").nullable().optional(),
  attachment_url: z.string().trim().url().nullable().optional(),
});

export const GET = withAuth(
  async (req) => {
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("class_schedule_id")?.trim();
    const date = url.searchParams.get("assigned_date")?.trim();

    const supabase = getServiceClient();
    let q = supabase
      .from("class_assignments")
      .select("*, class_schedules(subject, teacher, room_name)")
      .order("assigned_date", { ascending: false })
      .limit(200);

    if (scheduleId) q = q.eq("class_schedule_id", scheduleId);
    if (date) q = q.eq("assigned_date", date);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ status: "success", data: data ?? [], count: data?.length ?? 0 });
  },
  { permission: "schedule.view" }
);

export const POST = withAuth(
  async (req, { principal }) => {
    const parsed = await parseBody(req, CreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // กำหนดส่งก่อนวันสั่งไม่สมเหตุสมผล และ DB ไม่ได้กันไว้
    // จับที่นี่เพื่อให้ได้ข้อความไทย แทนที่จะปล่อยให้บันทึกงานที่เลยกำหนดตั้งแต่แรก
    if (body.due_date && body.due_date < body.assigned_date) {
      return NextResponse.json(
        { status: "error", message: "กำหนดส่งต้องไม่ก่อนวันที่สั่งงาน" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data: schedule } = await supabase
      .from("class_schedules")
      .select("id")
      .eq("id", body.class_schedule_id)
      .maybeSingle();
    if (!schedule) {
      return NextResponse.json({ status: "error", message: "ไม่พบคาบเรียนนี้" }, { status: 404 });
    }

    const payload = {
      class_schedule_id: body.class_schedule_id,
      assigned_date: body.assigned_date,
      title: body.title,
      description: body.description ?? null,
      due_date: body.due_date ?? null,
      max_score: body.max_score ?? null,
      attachment_url: body.attachment_url ?? null,
      created_by: principal.subjectId,
    };

    const { data, error } = await supabase
      .from("class_assignments")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success", id: data.id }),
      audit: { entityId: data.id, after: payload },
    };
  },
  {
    permission: "schedule.manage",
    audit: { action: "class_assignment.create", entityType: "class_assignment" },
  }
);

export const PATCH = withAuth(
  async (req) => {
    const parsed = await parseBody(req, UpdateSchema);
    if (!parsed.ok) return parsed.response;
    const { id, ...rest } = parsed.data;

    const supabase = getServiceClient();
    const { data: before } = await supabase
      .from("class_assignments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json({ status: "error", message: "ไม่พบงานนี้" }, { status: 404 });
    }

    // แตะเฉพาะคีย์ที่ส่งมาจริง คีย์ที่ไม่ส่งต้องไม่ถูกอ่านว่า "ตั้งเป็น null"
    const update: Database["public"]["Tables"]["class_assignments"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (rest.title !== undefined) update.title = rest.title;
    if (rest.description !== undefined) update.description = rest.description;
    if (rest.due_date !== undefined) update.due_date = rest.due_date;
    if (rest.max_score !== undefined) update.max_score = rest.max_score;
    if (rest.attachment_url !== undefined) update.attachment_url = rest.attachment_url;

    // วันที่สั่งย้ายไม่ได้ จึงเทียบกับของเดิมเสมอ
    const dueDate = update.due_date ?? before.due_date;
    if (dueDate && dueDate < before.assigned_date) {
      return NextResponse.json(
        { status: "error", message: "กำหนดส่งต้องไม่ก่อนวันที่สั่งงาน" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("class_assignments").update(update).eq("id", id);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: id, before, after: update },
    };
  },
  {
    permission: "schedule.manage",
    audit: { action: "class_assignment.update", entityType: "class_assignment" },
  }
);

export const DELETE = withAuth(
  async (req) => {
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ status: "error", message: "ต้องระบุ id" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: before } = await supabase
      .from("class_assignments")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json({ status: "error", message: "ไม่พบงานนี้" }, { status: 404 });
    }

    const { error } = await supabase.from("class_assignments").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: id, before },
    };
  },
  {
    permission: "schedule.manage",
    audit: { action: "class_assignment.delete", entityType: "class_assignment" },
  }
);
