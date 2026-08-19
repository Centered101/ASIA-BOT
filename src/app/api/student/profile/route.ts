import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import {
  AchievementSchema, AchievementUpdateSchema,
  EducationSchema, EducationUpdateSchema,
  GuardianSchema, GuardianUpdateSchema,
} from "@/lib/server/student-record-schemas";

/**
 * แฟ้มของฉัน — นักเรียนกรอกข้อมูลตัวเองได้
 *
 * ครอบสามอย่าง: ผู้ปกครอง ประวัติการศึกษาเดิม ผลงานและรางวัล
 * ส่วนไทม์ไลน์การเปลี่ยนแปลงให้ "อ่านอย่างเดียว" ไม่มีทางเขียน เพราะตารางนั้น
 * บันทึกสิ่งที่โรงเรียนตัดสิน (ย้ายสาขา พักการเรียน ลาออก) ถ้านักเรียนเขียนได้
 * ก็สร้างประวัติปลอมของตัวเองได้ แล้วตารางทั้งตารางจะเชื่อถือไม่ได้อีก
 *
 * กติกาความเป็นเจ้าของสองชั้น ทั้งคู่บังคับฝั่ง server:
 *   1. student_id มาจาก principal เสมอ ไม่เคยรับจาก body หรือ query
 *      ไม่งั้นนักเรียนเปลี่ยนรหัสใน request แล้วไปแก้แฟ้มเพื่อนได้
 *   2. แก้/ลบได้เฉพาะแถวที่ source = 'student' — แถวที่ฝ่ายทะเบียนกรอกไว้
 *      นักเรียนเห็นแต่แตะไม่ได้ (ดูเหตุผลใน 0020_student_self_service.sql)
 *
 * ใช้ schema ชุดเดียวกับฝั่งแอดมิน กฎการตรวจจึงไม่มีทางเพี้ยนกันสองฝั่ง
 */

const KINDS = {
  guardians: {
    table: "guardians" as const,
    label: "ผู้ปกครอง",
    create: GuardianSchema,
    update: GuardianUpdateSchema,
    order: "created_at",
  },
  education: {
    table: "student_education_history" as const,
    label: "ประวัติการศึกษา",
    create: EducationSchema,
    update: EducationUpdateSchema,
    order: "graduated_year",
  },
  achievements: {
    table: "student_achievements" as const,
    label: "ผลงาน",
    create: AchievementSchema,
    update: AchievementUpdateSchema,
    order: "event_date",
  },
};

type Kind = keyof typeof KINDS;

const KindSchema = z.enum(["guardians", "education", "achievements"]);

/** อ่าน kind จาก query ทีเดียว ทุก method ใช้ตัวเดียวกัน */
function readKind(req: Request): { ok: true; kind: Kind } | { ok: false; response: NextResponse } {
  const raw = new URL(req.url).searchParams.get("kind");
  const parsed = KindSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { status: "error", message: "ต้องระบุ kind เป็น guardians, education หรือ achievements" },
        { status: 400 }
      ),
    };
  }
  return { ok: true, kind: parsed.data };
}

/** บัญชีที่ไม่ใช่นักเรียนไม่มีแฟ้มให้จัดการ — ครูใช้หน้าแอดมินแทน */
function notAStudent() {
  return NextResponse.json(
    { status: "error", message: "บัญชีนี้ไม่ใช่บัญชีนักเรียน" },
    { status: 403 }
  );
}

/**
 * GET — คืนทั้งแฟ้มในครั้งเดียว
 *
 * ไม่แยกเป็นสี่ request เพราะหน้าเดียวใช้ครบทุกส่วนอยู่แล้ว การยิงสี่รอบ
 * ทำให้หน้าโหลดเป็นขั้น ๆ และตัวเลขสรุปกระพริบตามลำดับที่ตอบกลับมา
 */
export const GET = withAuth(
  async (_req, { principal }) => {
    if (principal.subjectType !== "student") return notAStudent();
    const studentId = principal.subjectId;
    const supabase = getServiceClient();

    const [guardians, education, achievements, timeline] = await Promise.all([
      supabase.from("guardians").select("*")
        .eq("student_id", studentId).order("is_primary", { ascending: false }),
      supabase.from("student_education_history").select("*")
        .eq("student_id", studentId).order("graduated_year", { ascending: false }),
      supabase.from("student_achievements").select("*")
        .eq("student_id", studentId).order("event_date", { ascending: false }),
      supabase.from("student_status_changes").select("*")
        .eq("student_id", studentId).order("effective_date", { ascending: false }).limit(50),
    ]);

    const failed = [guardians, education, achievements, timeline].find((r) => r.error);
    if (failed?.error) {
      return NextResponse.json({ status: "error", message: failed.error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      data: {
        guardians: guardians.data ?? [],
        education: education.data ?? [],
        achievements: achievements.data ?? [],
        // อ่านอย่างเดียว ไม่มี endpoint ให้เขียน
        timeline: timeline.data ?? [],
      },
    });
  },
  { permission: "student.view_own" }
);

export const POST = withAuth(
  async (req, { principal }) => {
    if (principal.subjectType !== "student") return notAStudent();
    const k = readKind(req);
    if (!k.ok) return k.response;
    const spec = KINDS[k.kind];

    const parsed = await parseBody(req, spec.create);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data as Record<string, unknown>;

    const studentId = principal.subjectId;
    const supabase = getServiceClient();

    // ผู้ปกครองหลักมีได้คนเดียว มี unique index กันอยู่ในชั้น DB ถ้าไม่ปลดคนเดิม
    // ก่อน error 23505 จะโผล่ออกมาเป็น 500 ทั้งที่ผู้ใช้แค่ตั้งใจเปลี่ยนคนหลัก
    if (k.kind === "guardians" && body.is_primary === true) {
      await supabase.from("guardians").update({ is_primary: false })
        .eq("student_id", studentId).eq("is_primary", true);
    }

    const payload: Record<string, unknown> = {
      ...body,
      student_id: studentId,
      // ประทับว่ามาจากนักเรียน แถวนี้จึงแก้/ลบเองได้ในภายหลัง
      source: "student",
      recorded_by: studentId,
    };
    if (payload.email === "") payload.email = null;
    if (payload.document_url === "") payload.document_url = null;

    const { data, error } = await supabase
      .from(spec.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(payload as any)
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
    permission: "student.update_own",
    audit: { action: "student_profile.create", entityType: "student_profile" },
  }
);

export const PATCH = withAuth(
  async (req, { principal }) => {
    if (principal.subjectType !== "student") return notAStudent();
    const k = readKind(req);
    if (!k.ok) return k.response;
    const spec = KINDS[k.kind];

    const parsed = await parseBody(req, spec.update);
    if (!parsed.ok) return parsed.response;
    const { id, ...rest } = parsed.data as { id: string } & Record<string, unknown>;

    const studentId = principal.subjectId;
    const supabase = getServiceClient();

    // เงื่อนไขสามข้อพร้อมกัน: แถวนี้มีจริง เป็นของนักเรียนคนนี้ และนักเรียนกรอกเอง
    const { data: before } = await supabase
      .from(spec.table).select("*")
      .eq("id", id).eq("student_id", studentId).eq("source", "student")
      .maybeSingle();

    if (!before) {
      // ไม่แยกข้อความว่า "ไม่พบ" กับ "แก้ไม่ได้" เพราะทั้งสองกรณีผู้ใช้ทำอะไรไม่ได้
      // เหมือนกัน และการแยกจะบอกใบ้ว่ามีแถวนั้นอยู่จริงในแฟ้มคนอื่น
      return NextResponse.json(
        { status: "error", message: `ไม่พบรายการนี้ หรือเป็น${spec.label}ที่ทางโรงเรียนบันทึกไว้ ซึ่งแก้ไขเองไม่ได้` },
        { status: 404 }
      );
    }

    if (k.kind === "guardians" && rest.is_primary === true) {
      await supabase.from("guardians").update({ is_primary: false })
        .eq("student_id", studentId).eq("is_primary", true).neq("id", id);
    }

    // แตะเฉพาะคีย์ที่ส่งมาจริง คีย์ที่ไม่ส่งต้องไม่ถูกอ่านว่า "ตั้งเป็น null"
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [key, v] of Object.entries(rest)) {
      if (v === undefined) continue;
      update[key] = v === "" && (key === "email" || key === "document_url") ? null : v;
    }

    const { error } = await supabase
      .from(spec.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: id, before, after: update },
    };
  },
  {
    permission: "student.update_own",
    audit: { action: "student_profile.update", entityType: "student_profile" },
  }
);

export const DELETE = withAuth(
  async (req, { principal }) => {
    if (principal.subjectType !== "student") return notAStudent();
    const k = readKind(req);
    if (!k.ok) return k.response;
    const spec = KINDS[k.kind];

    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ status: "error", message: "ต้องระบุ id" }, { status: 400 });
    }

    const studentId = principal.subjectId;
    const supabase = getServiceClient();

    const { data: before } = await supabase
      .from(spec.table).select("*")
      .eq("id", id).eq("student_id", studentId).eq("source", "student")
      .maybeSingle();

    if (!before) {
      return NextResponse.json(
        { status: "error", message: `ไม่พบรายการนี้ หรือเป็น${spec.label}ที่ทางโรงเรียนบันทึกไว้ ซึ่งลบเองไม่ได้` },
        { status: 404 }
      );
    }

    const { error } = await supabase.from(spec.table).delete().eq("id", id);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: id, before },
    };
  },
  {
    permission: "student.update_own",
    audit: { action: "student_profile.delete", entityType: "student_profile" },
  }
);
