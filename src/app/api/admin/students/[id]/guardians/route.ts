import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import type { Database } from "@/types/database";

type GuardianUpdate = Database["public"]["Tables"]["guardians"]["Update"];

// ผู้ปกครองของนักเรียนหนึ่งคน — เพิ่ม/แก้/ลบ
// สิทธิ์ใช้ student.update ตัวเดียวกับการแก้ข้อมูลนักเรียน เพราะข้อมูลผู้ปกครอง
// เป็นส่วนหนึ่งของระเบียนนักเรียน ไม่ใช่ทรัพยากรแยกที่มีเจ้าของต่างหาก

const RELATIONSHIPS = ["บิดา", "มารดา", "ผู้ปกครอง", "ญาติ", "อื่นๆ"] as const;

const GuardianCreateSchema = z.object({
  full_name: z.string().trim().min(1, "ต้องระบุชื่อผู้ปกครอง"),
  relationship: z.enum(RELATIONSHIPS).optional(),
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

const GuardianUpdateSchema = GuardianCreateSchema.partial().extend({
  id: z.string().uuid("ต้องระบุ id ของผู้ปกครองที่จะแก้"),
});

/** ผู้ปกครองหลักมีได้คนเดียวต่อนักเรียน (มี unique index กันอยู่แล้วในชั้น DB) */
async function clearOtherPrimary(studentId: string, keepId: string | null) {
  const supabase = getServiceClient();
  let q = supabase
    .from("guardians")
    .update({ is_primary: false })
    .eq("student_id", studentId)
    .eq("is_primary", true);
  if (keepId) q = q.neq("id", keepId);
  await q;
}

export const POST = withAuth<{ id: string }>(
  async (req, { params }) => {
    const studentId = decodeURIComponent(params.id).trim();
    const parsed = await parseBody(req, GuardianCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const supabase = getServiceClient();

    const { data: student } = await supabase
      .from("students")
      .select("student_id")
      .eq("student_id", studentId)
      .maybeSingle();
    if (!student) {
      return NextResponse.json({ status: "error", message: "ไม่พบนักเรียน" }, { status: 404 });
    }

    // ต้องปลดคนเดิมก่อน ไม่งั้น unique index จะเด้ง 23505 ออกมาเป็น 500
    // ทั้งที่ผู้ใช้ตั้งใจจะเปลี่ยนตัวผู้ปกครองหลัก
    if (body.is_primary) await clearOtherPrimary(studentId, null);

    const { data, error } = await supabase
      .from("guardians")
      .insert({
        student_id: studentId,
        full_name: body.full_name,
        relationship: body.relationship ?? "ผู้ปกครอง",
        phone: body.phone ?? null,
        phone_alt: body.phone_alt ?? null,
        email: body.email || null,
        line_user_id: body.line_user_id ?? null,
        national_id: body.national_id ?? null,
        occupation: body.occupation ?? null,
        workplace: body.workplace ?? null,
        income_range: body.income_range ?? null,
        address: body.address ?? null,
        is_primary: body.is_primary ?? false,
        is_emergency_contact: body.is_emergency_contact ?? false,
        note: body.note ?? null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success", id: data.id }),
      audit: { entityId: data.id, after: { student_id: studentId, ...body } },
    };
  },
  {
    permission: "student.update",
    audit: { action: "guardian.create", entityType: "guardian" },
  }
);

export const PATCH = withAuth<{ id: string }>(
  async (req, { params }) => {
    const studentId = decodeURIComponent(params.id).trim();
    const parsed = await parseBody(req, GuardianUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const { id: guardianId, ...body } = parsed.data;

    const supabase = getServiceClient();

    // อ่านค่าเดิมไว้ก่อน เพื่อให้ audit log มีทั้ง before และ after
    // และเพื่อยืนยันว่าแถวนี้เป็นของนักเรียนคนที่อยู่ใน URL จริง
    const { data: before } = await supabase
      .from("guardians")
      .select("*")
      .eq("id", guardianId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!before) {
      return NextResponse.json(
        { status: "error", message: "ไม่พบผู้ปกครองรายนี้ของนักเรียนคนนี้" },
        { status: 404 }
      );
    }

    if (body.is_primary) await clearOtherPrimary(studentId, guardianId);

    // แตะเฉพาะคีย์ที่ผู้เรียกส่งมาจริง คีย์ที่ไม่ส่ง ต้องไม่ถูกอ่านว่า "ตั้งเป็น null"
    const update: GuardianUpdate = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      // email เป็น "" ได้จาก schema (ช่องว่างในฟอร์ม) แต่ DB ควรเก็บ null
      (update as Record<string, unknown>)[k] = k === "email" ? v || null : v;
    }

    const { error } = await supabase.from("guardians").update(update).eq("id", guardianId);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: guardianId, before, after: update },
    };
  },
  {
    permission: "student.update",
    audit: { action: "guardian.update", entityType: "guardian" },
  }
);

export const DELETE = withAuth<{ id: string }>(
  async (req, { params }) => {
    const studentId = decodeURIComponent(params.id).trim();
    const guardianId = new URL(req.url).searchParams.get("guardian_id")?.trim();

    if (!guardianId) {
      return NextResponse.json(
        { status: "error", message: "ต้องระบุ guardian_id" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data: before } = await supabase
      .from("guardians")
      .select("*")
      .eq("id", guardianId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!before) {
      return NextResponse.json(
        { status: "error", message: "ไม่พบผู้ปกครองรายนี้ของนักเรียนคนนี้" },
        { status: 404 }
      );
    }

    const { error } = await supabase.from("guardians").delete().eq("id", guardianId);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: guardianId, before },
    };
  },
  {
    permission: "student.update",
    audit: { action: "guardian.delete", entityType: "guardian" },
  }
);
