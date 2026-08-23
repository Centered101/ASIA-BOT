import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import { resolveOwnStudentId } from "@/lib/server/student-identity";
import { hasPermission } from "@/lib/rbac/definitions";
import { canStudentDeleteDocument } from "@/lib/server/documents";
import type { Database, StudentDocumentStatus } from "@/types/database";

/**
 * แฟ้มเอกสารของนักเรียน — ไฟล์ที่ส่งให้โรงเรียนเก็บ (0023)
 *
 * คนละเรื่องกับ /api/student/document-requests ซึ่งเป็นการ "ขอให้โรงเรียนออก
 * เอกสารให้" ตรงนี้คือขาส่งเข้า: สำเนาบัตร ทะเบียนบ้าน ปพ. จากที่เดิม
 *
 * นักเรียนเห็นและจัดการเฉพาะของตัวเอง คนที่มีสิทธิ์ document.view_all
 * (ฝ่ายทะเบียน) ส่ง ?student_id= มาดูของคนอื่นได้ — เหมือน class-attendance
 */

type DocumentInsert = Database["public"]["Tables"]["student_documents"]["Insert"];

const CreateSchema = z.object({
  document_type: z.string().trim().min(1, "ต้องเลือกประเภทเอกสาร"),
  file_url: z.string().trim().url("ลิงก์ไฟล์ไม่ถูกต้อง"),
  file_name: z.string().trim().max(200).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

/** สถานะที่ถือว่า "ส่งแล้ว" สำหรับคิดว่ายังขาดเอกสารอะไร — ที่ไม่ผ่านยังนับว่าขาด */
const SUBMITTED: StudentDocumentStatus[] = ["pending", "reviewing", "approved"];

export const GET = withAuth(
  async (req, { principal }) => {
    const requested = new URL(req.url).searchParams.get("student_id")?.trim();
    const canSeeOthers = hasPermission(principal.permissions, "document.view_all");

    const own = await resolveOwnStudentId(principal);
    const studentId = canSeeOthers && requested ? requested : own;

    if (!studentId) {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ไม่ได้ผูกกับนักเรียน จึงไม่มีแฟ้มเอกสาร" },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();
    const [types, docs] = await Promise.all([
      supabase
        .from("document_types")
        .select("key, label, description, is_required, sort_order")
        .eq("kind", "upload")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("student_documents")
        .select("id, document_type, file_url, file_name, note, status, review_note, reviewed_at, source, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
    ]);

    if (types.error || docs.error) {
      return NextResponse.json(
        { status: "error", message: types.error?.message ?? docs.error?.message },
        { status: 500 }
      );
    }

    // "ยังขาดอะไร" คิดฝั่งเซิร์ฟเวอร์ เพราะกติกาว่าอะไรนับว่าส่งแล้วอยู่ที่นี่
    // ถ้าปล่อยให้ UI คิดเอง วันที่เพิ่มสถานะใหม่จะมีที่ต้องแก้สองที่
    const submitted = new Set(
      (docs.data ?? [])
        .filter((d) => SUBMITTED.includes(d.status))
        .map((d) => d.document_type)
    );
    const missing = (types.data ?? [])
      .filter((t) => t.is_required && !submitted.has(t.key))
      .map((t) => ({ key: t.key, label: t.label }));

    return NextResponse.json({
      status: "success",
      data: {
        student_id: studentId,
        types: types.data ?? [],
        documents: docs.data ?? [],
        missing,
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
    const canUploadForOthers = hasPermission(principal.permissions, "document.review");
    const own = await resolveOwnStudentId(principal);
    const studentId = canUploadForOthers && requested ? requested : own;

    if (!studentId) {
      return NextResponse.json(
        { status: "error", message: "บัญชีนี้ไม่ได้ผูกกับนักเรียน จึงส่งเอกสารไม่ได้" },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();

    // ประเภทต้องมีจริงและเป็นขาส่งเข้าแฟ้ม ไม่งั้นจะได้แถวที่ชี้ไปประเภท
    // "ขอให้ออกให้" ซึ่งไม่มีความหมายในตารางนี้ (FK ปล่อยผ่านเพราะเป็นคีย์เดียวกัน)
    const { data: type } = await supabase
      .from("document_types")
      .select("key, kind, active")
      .eq("key", body.document_type)
      .maybeSingle();

    if (!type || !type.active || type.kind !== "upload") {
      return NextResponse.json(
        { status: "error", message: "ประเภทเอกสารนี้ส่งเข้าแฟ้มไม่ได้" },
        { status: 400 }
      );
    }

    const payload: DocumentInsert = {
      student_id: studentId,
      document_type: body.document_type,
      file_url: body.file_url,
      file_name: body.file_name ?? null,
      note: body.note ?? null,
      status: "pending",
      // เจ้าหน้าที่อัปแทนให้ ต้องแยกออกจากที่นักเรียนส่งเอง เหตุผลเดียวกับ 0020
      source: studentId === own ? "student" : "staff",
      uploaded_by: principal.subjectId,
    };

    const { data, error } = await supabase
      .from("student_documents")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({
        status: "success",
        id: data.id,
        message: "ส่งเอกสารเข้าแฟ้มแล้ว รอฝ่ายทะเบียนตรวจ",
      }),
      audit: { entityId: data.id, after: { ...payload } },
    };
  },
  {
    permission: "document.upload_own",
    audit: { action: "document.upload", entityType: "student_document" },
  }
);

export const DELETE = withAuth(
  async (req, { principal }) => {
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ status: "error", message: "ต้องระบุ id" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: doc } = await supabase
      .from("student_documents")
      .select("id, student_id, status, file_url")
      .eq("id", id)
      .maybeSingle();

    if (!doc) {
      return NextResponse.json({ status: "error", message: "ไม่พบเอกสาร" }, { status: 404 });
    }

    const own = await resolveOwnStudentId(principal);
    const isOwner = doc.student_id === own;
    const canManage = hasPermission(principal.permissions, "document.review");

    if (!isOwner && !canManage) {
      return NextResponse.json({ status: "error", message: "ไม่มีสิทธิ์" }, { status: 403 });
    }

    // เจ้าของลบได้เฉพาะที่ยังไม่มีใครตัดสิน ฝ่ายทะเบียนลบได้ทุกสถานะ
    // (เช่น ไฟล์ที่อัปผิดคน) ดูเหตุผลที่ canStudentDeleteDocument
    if (isOwner && !canManage && !canStudentDeleteDocument(doc.status)) {
      return NextResponse.json(
        { status: "error", message: "เอกสารที่ตรวจแล้วลบเองไม่ได้ ให้ส่งไฟล์ใหม่แทน" },
        { status: 409 }
      );
    }

    const { error } = await supabase.from("student_documents").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    // ตั้งใจไม่ลบไฟล์ใน storage ตรงนี้ — แถวถูกลบแล้วแต่ไฟล์ยังอยู่ ดีกว่า
    // ลบไฟล์สำเร็จแล้วลบแถวไม่สำเร็จ ซึ่งจะได้แฟ้มที่ชี้ไปไฟล์ที่ไม่มีอยู่จริง
    return {
      response: NextResponse.json({ status: "success", message: "ลบเอกสารแล้ว" }),
      audit: { entityId: id, before: { ...doc } },
    };
  },
  {
    permission: "document.view_own",
    audit: { action: "document.delete", entityType: "student_document" },
  }
);
