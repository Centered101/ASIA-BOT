import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import { ROLE_LABELS, type Role } from "@/lib/rbac/definitions";

/**
 * ตำแหน่งในโรงเรียนของนักเรียน = role ใน user_roles
 *
 * ไม่มีตารางตำแหน่งแยกโดยตั้งใจ ถ้าเก็บสองที่ วันหนึ่งจะเจอแฟ้มที่เขียนว่า
 * "ประธานนักเรียน" แต่ระบบไม่ให้สิทธิ์อะไรเลย เพราะไม่มีใครไปเพิ่ม role ให้
 * — ตำแหน่งที่ไม่มีผลกับสิ่งที่ทำได้จริงคือข้อความประดับ ไม่ใช่ตำแหน่ง
 *
 * ใช้ system.manage ไม่ใช่ student.update เพราะนี่คือการ **เปลี่ยนสิทธิ์**
 * ของบัญชีหนึ่ง ไม่ใช่การแก้ข้อมูลประวัติ ฝ่ายทะเบียนที่แก้ชื่อ-ที่อยู่ได้
 * ไม่ควรตั้งใครเป็นผู้ดูแลระบบได้ด้วยการกดปุ่มในหน้าแฟ้มนักเรียน
 */

/**
 * role ที่ห้ามให้นักเรียนเด็ดขาด
 *
 * ไม่ได้ทำเป็น allowlist เพราะรายชื่อ role งอกได้เรื่อย ๆ และการลืมเพิ่มเข้า
 * allowlist แค่ทำให้ตั้งไม่ได้ (รำคาญแต่ปลอดภัย) ส่วนการลืมเพิ่มเข้า denylist
 * จะเปิดสิทธิ์โดยไม่ตั้งใจ — ที่นี่จึงกันเฉพาะตัวที่อันตรายจริงและตรวจซ้ำ
 * อีกชั้นว่า role นั้นต้องไม่มีสิทธิ์ระดับระบบ
 */
const FORBIDDEN_FOR_STUDENT: Role[] = ["SUPER_ADMIN", "ADMIN", "EXECUTIVE"];

const Body = z.object({
  role_key: z.string().trim().min(1, "ต้องระบุตำแหน่ง"),
  scope_type: z.enum(["class_group", "department", "room"]).nullable().optional(),
  scope_id: z.string().trim().nullable().optional(),
});

/** หา account_id ของนักเรียน — ไม่มีก็ให้ role ไม่ได้ */
async function loadAccount(studentId: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("students")
    .select("student_id, account_id")
    .eq("student_id", studentId)
    .maybeSingle();
  return data;
}

export const POST = withAuth<{ id: string }>(
  async (req, { params }) => {
    const studentId = decodeURIComponent(params.id).trim();
    const parsed = await parseBody(req, Body);
    if (!parsed.ok) return parsed.response;
    const { role_key, scope_type, scope_id } = parsed.data;

    const student = await loadAccount(studentId);
    if (!student) {
      return NextResponse.json({ status: "error", message: "ไม่พบนักเรียน" }, { status: 404 });
    }
    if (!student.account_id) {
      // เกิดกับนักเรียนที่ยังไม่ถูก backfill เข้า user_accounts — บอกให้ตรง
      // ดีกว่าปล่อยให้กดแล้วเงียบ
      return NextResponse.json(
        { status: "error", message: "นักเรียนคนนี้ยังไม่มีบัญชีในระบบตัวตนกลาง จึงตั้งตำแหน่งไม่ได้" },
        { status: 409 }
      );
    }

    if (FORBIDDEN_FOR_STUDENT.includes(role_key as Role)) {
      return NextResponse.json(
        { status: "error", message: `ตั้ง "${ROLE_LABELS[role_key as Role] ?? role_key}" ให้นักเรียนไม่ได้` },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // role ต้องมีอยู่จริงในตาราง roles ไม่งั้น FK จะเด้งออกมาเป็น 500
    const { data: role } = await supabase
      .from("roles").select("key").eq("key", role_key).maybeSingle();
    if (!role) {
      return NextResponse.json({ status: "error", message: "ไม่รู้จักตำแหน่งนี้" }, { status: 400 });
    }

    // กันให้ซ้ำ — ตาราง user_roles ไม่มี unique index กันไว้
    // ต้องใช้ .is() กับค่า null เพราะ .eq() แปลเป็น "= NULL" ซึ่งไม่เคยเป็นจริงใน SQL
    // ถ้าใช้ .eq() ตำแหน่งที่ไม่มี scope จะถูกเพิ่มซ้ำได้ไม่จำกัด
    let dup = supabase
      .from("user_roles").select("id")
      .eq("account_id", student.account_id)
      .eq("role_key", role_key);
    dup = scope_type ? dup.eq("scope_type", scope_type) : dup.is("scope_type", null);
    dup = scope_id ? dup.eq("scope_id", scope_id) : dup.is("scope_id", null);
    const { data: existing } = await dup.maybeSingle();
    if (existing) {
      return NextResponse.json({ status: "error", message: "มีตำแหน่งนี้อยู่แล้ว" }, { status: 409 });
    }

    const payload = {
      account_id: student.account_id,
      role_key,
      scope_type: scope_type ?? null,
      scope_id: scope_id ?? null,
    };

    const { data, error } = await supabase
      .from("user_roles").insert(payload).select("id").single();
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success", id: data.id }),
      audit: { entityId: data.id, after: { student_id: studentId, ...payload } },
    };
  },
  {
    permission: "system.manage",
    audit: { action: "student_role.grant", entityType: "user_role" },
  }
);

export const DELETE = withAuth<{ id: string }>(
  async (req, { params }) => {
    const studentId = decodeURIComponent(params.id).trim();
    const rowId = new URL(req.url).searchParams.get("role_id")?.trim();
    if (!rowId) {
      return NextResponse.json({ status: "error", message: "ต้องระบุ role_id" }, { status: 400 });
    }

    const student = await loadAccount(studentId);
    if (!student?.account_id) {
      return NextResponse.json({ status: "error", message: "ไม่พบนักเรียน" }, { status: 404 });
    }

    const supabase = getServiceClient();

    // ผูกกับ account ของนักเรียนใน URL ด้วย กันถอน role ของคนอื่นด้วย id หลุด ๆ
    const { data: before } = await supabase
      .from("user_roles").select("*")
      .eq("id", rowId).eq("account_id", student.account_id)
      .maybeSingle();
    if (!before) {
      return NextResponse.json(
        { status: "error", message: "ไม่พบตำแหน่งนี้ของนักเรียนคนนี้" },
        { status: 404 }
      );
    }

    // STUDENT คือ role พื้นฐานที่ทำให้เข้าระบบฝั่งนักเรียนได้ ถอนแล้วบัญชีจะ
    // ใช้งานอะไรไม่ได้เลย ซึ่งไม่มีใครตั้งใจตอนกดปุ่มลบ "ตำแหน่ง"
    if (before.role_key === "STUDENT") {
      return NextResponse.json(
        { status: "error", message: "ถอนตำแหน่งนักเรียนไม่ได้ เป็นสิทธิ์พื้นฐานของบัญชี" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("user_roles").delete().eq("id", rowId);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: rowId, before },
    };
  },
  {
    permission: "system.manage",
    audit: { action: "student_role.revoke", entityType: "user_role" },
  }
);
