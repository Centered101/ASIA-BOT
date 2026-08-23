import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import { resolveOwnStudentId } from "@/lib/server/student-identity";
import { hasPermission } from "@/lib/rbac/definitions";
import { generateDocumentRequestCode } from "@/lib/server/documents";
import type { Database } from "@/types/database";

/**
 * คำขอให้โรงเรียนออกเอกสารให้ — ใบรับรอง Transcript ใบจบ (0023)
 *
 * ขาส่งเข้าแฟ้มอยู่ที่ /api/student/documents คนละ workflow กัน:
 * ที่นี่จบเมื่อนักเรียนได้รับเอกสาร ไม่ใช่เมื่อฝ่ายทะเบียนตรวจไฟล์ผ่าน
 */

type RequestInsert = Database["public"]["Tables"]["document_requests"]["Insert"];

const CreateSchema = z.object({
  document_type: z.string().trim().min(1, "ต้องเลือกประเภทเอกสาร"),
  copies: z.number().int().positive().max(20).default(1),
  purpose: z.string().trim().max(300).nullable().optional(),
  delivery_mode: z.enum(["pickup", "delivery"]).default("pickup"),
  delivery_note: z.string().trim().max(300).nullable().optional(),
});

export const GET = withAuth(
  async (req, { principal }) => {
    const requested = new URL(req.url).searchParams.get("student_id")?.trim();
    const canSeeOthers = hasPermission(principal.permissions, "document.view_all");
    const own = await resolveOwnStudentId(principal);
    const studentId = canSeeOthers && requested ? requested : own;

    if (!studentId) {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ไม่ได้ผูกกับนักเรียน จึงไม่มีคำขอเอกสาร" },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();
    const [types, requests] = await Promise.all([
      supabase
        .from("document_types")
        .select("key, label, description, fee, student_can_request, sort_order")
        .eq("kind", "issue")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("document_requests")
        .select("id, request_code, document_type, copies, purpose, delivery_mode, delivery_note, status, fee, paid_at, issued_file_url, admin_note, completed_at, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (types.error || requests.error) {
      return NextResponse.json(
        { status: "error", message: types.error?.message ?? requests.error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      data: {
        student_id: studentId,
        types: types.data ?? [],
        requests: requests.data ?? [],
      },
    });
  },
  { permission: "document.view_own" }
);

export const POST = withAuth(
  async (req, { principal }) => {
    const parsed = await parseBody(req, CreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const requested = new URL(req.url).searchParams.get("student_id")?.trim();
    const canRequestForOthers = hasPermission(principal.permissions, "document.issue");
    const own = await resolveOwnStudentId(principal);
    const studentId = canRequestForOthers && requested ? requested : own;

    if (!studentId) {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ไม่ได้ผูกกับนักเรียน จึงขอเอกสารไม่ได้" },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();
    const { data: type } = await supabase
      .from("document_types")
      .select("key, label, kind, active, fee, student_can_request")
      .eq("key", body.document_type)
      .maybeSingle();

    if (!type || !type.active || type.kind !== "issue") {
      return NextResponse.json(
        { status: "error", message: "ประเภทเอกสารนี้ขอไม่ได้" },
        { status: 400 }
      );
    }

    // บางอย่างนักเรียนขอเองไม่ได้ เช่นใบจบการศึกษา ต้องให้ฝ่ายทะเบียนเป็นคนออก
    if (!type.student_can_request && !canRequestForOthers) {
      return NextResponse.json(
        { status: "error", message: `${type.label} ต้องให้ฝ่ายทะเบียนเป็นผู้ออกให้ ติดต่อที่ห้องทะเบียน` },
        { status: 403 }
      );
    }

    // ค่าธรรมเนียมคิดจากตารางประเภท ไม่ใช่จากค่าที่ส่งมาใน body
    // ไม่งั้นใครก็แก้ราคาตัวเองเป็นศูนย์ได้ก่อนกดส่ง
    const payload: RequestInsert = {
      request_code: generateDocumentRequestCode(),
      student_id: studentId,
      document_type: body.document_type,
      copies: body.copies,
      purpose: body.purpose ?? null,
      delivery_mode: body.delivery_mode,
      delivery_note: body.delivery_note ?? null,
      status: "pending",
      fee: Number(type.fee ?? 0) * body.copies,
    };

    const { data, error } = await supabase
      .from("document_requests")
      .insert(payload)
      .select("id, request_code")
      .single();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    // ไทม์ไลน์เริ่มที่การยื่นคำขอ เพื่อให้ประวัติครบตั้งแต่ก้าวแรก เหมือนงานซ่อม
    await supabase.from("document_request_history").insert({
      request_id: data.id,
      from_status: null,
      to_status: "pending",
      note: "ยื่นคำขอเข้าระบบ",
      changed_by: principal.subjectId,
    });

    return {
      response: NextResponse.json({
        status: "success",
        id: data.id,
        request_code: data.request_code,
        fee: payload.fee,
        message: `ส่งคำขอแล้ว รหัส ${data.request_code}`,
      }),
      audit: { entityId: data.id, after: { ...payload } },
    };
  },
  {
    permission: "document.request",
    audit: { action: "document.request", entityType: "document_request" },
  }
);
