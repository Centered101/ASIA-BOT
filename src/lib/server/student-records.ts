import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "./supabase-server";
import { withAuth } from "./with-auth";
import { parseBody } from "./validation";

/**
 * ตัวช่วยสร้าง CRUD ของ "ระเบียนลูกของนักเรียน"
 *
 * ตาราง student_education_history, student_achievements และ
 * student_positions มีรูปร่างเหมือนกันหมด: ผูกกับ student_id, ต้องยืนยันว่า
 * แถวนั้นเป็นของนักเรียนใน URL จริงก่อนแก้, ใช้สิทธิ์ student.update
 * และต้องเขียน audit log พร้อม before/after
 *
 * เขียนครั้งเดียวแล้วใช้ซ้ำ ดีกว่าก๊อปสามรอบแล้วแก้พลาดไปทีละที่ ส่วน
 * schema ของแต่ละตารางยังแยกกันชัดเจน เพราะฟิลด์ต่างกันจริง
 *
 * ไม่ครอบ guardians เพราะตารางนั้นมีกติกาเพิ่ม (ผู้ปกครองหลักได้คนเดียว
 * ต้องปลดคนเดิมก่อน) ซึ่งถ้าดันเข้ามาที่นี่จะทำให้ helper รู้เรื่องเฉพาะทาง
 * ของตารางเดียวโดยไม่จำเป็น
 */

type ChildTable =
  | "student_education_history"
  | "student_achievements"
  | "student_positions";

type Options<TCreate extends z.ZodTypeAny, TUpdate extends z.ZodTypeAny> = {
  table: ChildTable;
  /** ชื่อที่ใช้ในข้อความ error ภาษาไทย เช่น "ประวัติการศึกษา" */
  label: string;
  /** ใช้ตั้งชื่อ action ใน audit log เช่น "achievement" -> achievement.create */
  auditEntity: string;
  createSchema: TCreate;
  updateSchema: TUpdate;
  /** คอลัมน์ที่ใช้เรียงตอน GET เรียงมากไปน้อย */
  orderBy: string;
};

export function studentChildRoutes<
  TCreate extends z.ZodTypeAny,
  TUpdate extends z.ZodTypeAny,
>(opts: Options<TCreate, TUpdate>) {
  const { table, label, auditEntity, createSchema, updateSchema, orderBy } = opts;

  /** ยืนยันว่าแถวนี้เป็นของนักเรียนใน URL จริง กัน IDOR ข้ามนักเรียน */
  async function loadOwned(rowId: string, studentId: string) {
    const { data } = await getServiceClient()
      .from(table)
      .select("*")
      .eq("id", rowId)
      .eq("student_id", studentId)
      .maybeSingle();
    return data;
  }

  const GET = withAuth<{ id: string }>(
    async (_req, { params }) => {
      const studentId = decodeURIComponent(params.id).trim();
      const { data, error } = await getServiceClient()
        .from(table)
        .select("*")
        .eq("student_id", studentId)
        .order(orderBy, { ascending: false });

      if (error) {
        return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
      }
      return NextResponse.json({ status: "success", data: data ?? [], count: data?.length ?? 0 });
    },
    { permission: "student.view_all" }
  );

  const POST = withAuth<{ id: string }>(
    async (req, { params }) => {
      const studentId = decodeURIComponent(params.id).trim();
      const parsed = await parseBody(req, createSchema);
      if (!parsed.ok) return parsed.response;

      const supabase = getServiceClient();

      const { data: student } = await supabase
        .from("students")
        .select("student_id")
        .eq("student_id", studentId)
        .maybeSingle();
      if (!student) {
        return NextResponse.json({ status: "error", message: "ไม่พบนักเรียน" }, { status: 404 });
      }

      const payload = { ...(parsed.data as Record<string, unknown>), student_id: studentId };
      const { data, error } = await supabase
        .from(table)
        // schema ของ zod คุมรูปร่างมาแล้ว แต่ TS มองเป็น unknown ตรงนี้
        // เพราะ table เป็น union จึงต้อง cast ที่จุดเรียกจุดเดียว
        .insert(payload as never)
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
    { permission: "student.update", audit: { action: `${auditEntity}.create`, entityType: auditEntity } }
  );

  const PATCH = withAuth<{ id: string }>(
    async (req, { params }) => {
      const studentId = decodeURIComponent(params.id).trim();
      const parsed = await parseBody(req, updateSchema);
      if (!parsed.ok) return parsed.response;

      const { id: rowId, ...rest } = parsed.data as { id: string } & Record<string, unknown>;
      const before = await loadOwned(rowId, studentId);
      if (!before) {
        return NextResponse.json(
          { status: "error", message: `ไม่พบ${label}รายการนี้ของนักเรียนคนนี้` },
          { status: 404 }
        );
      }

      // แตะเฉพาะคีย์ที่ส่งมาจริง คีย์ที่ไม่ส่งต้องไม่ถูกอ่านว่า "ตั้งเป็น null"
      const update: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) update[k] = v;
      if (Object.keys(update).length === 0) {
        return NextResponse.json(
          { status: "error", message: "ไม่มีข้อมูลที่จะแก้ไข" },
          { status: 400 }
        );
      }

      const { error } = await getServiceClient()
        .from(table)
        .update(update as never)
        .eq("id", rowId);

      if (error) {
        return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
      }

      return {
        response: NextResponse.json({ status: "success" }),
        audit: { entityId: rowId, before, after: update },
      };
    },
    { permission: "student.update", audit: { action: `${auditEntity}.update`, entityType: auditEntity } }
  );

  const DELETE = withAuth<{ id: string }>(
    async (req, { params }) => {
      const studentId = decodeURIComponent(params.id).trim();
      const rowId = new URL(req.url).searchParams.get("record_id")?.trim();
      if (!rowId) {
        return NextResponse.json({ status: "error", message: "ต้องระบุ record_id" }, { status: 400 });
      }

      const before = await loadOwned(rowId, studentId);
      if (!before) {
        return NextResponse.json(
          { status: "error", message: `ไม่พบ${label}รายการนี้ของนักเรียนคนนี้` },
          { status: 404 }
        );
      }

      const { error } = await getServiceClient().from(table).delete().eq("id", rowId);
      if (error) {
        return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
      }

      return {
        response: NextResponse.json({ status: "success" }),
        audit: { entityId: rowId, before },
      };
    },
    { permission: "student.update", audit: { action: `${auditEntity}.delete`, entityType: auditEntity } }
  );

  return { GET, POST, PATCH, DELETE };
}
