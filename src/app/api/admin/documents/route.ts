import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import { OPEN_DOCUMENT_STATUSES } from "@/lib/server/documents";
import type { StudentDocumentStatus } from "@/types/database";

/**
 * คิวตรวจเอกสารของฝ่ายทะเบียน — ขาที่นักเรียนส่งเข้าแฟ้ม (0023)
 *
 * คนละเส้นกับ /api/admin/document-requests ซึ่งเป็นคำขอให้ออกเอกสาร
 * ที่นี่จบเมื่อไฟล์ผ่านการตรวจ ไม่มีของต้องส่งมอบ
 */

const ALL_STATUSES: StudentDocumentStatus[] = [
  "pending", "reviewing", "approved", "rejected", "revision_required",
];

const ReviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "reviewing", "approved", "rejected", "revision_required"]),
  review_note: z.string().trim().max(500).nullable().optional(),
});

export const GET = withAuth(
  async (req) => {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const studentParam = url.searchParams.get("student_id")?.trim();

    const supabase = getServiceClient();
    let q = supabase
      .from("student_documents")
      .select("id, student_id, document_type, file_url, file_name, note, status, review_note, reviewed_by, reviewed_at, source, created_at")
      .order("created_at", { ascending: true })
      .limit(200);

    if (studentParam) q = q.eq("student_id", studentParam);

    if (statusParam && statusParam !== "all") {
      if (!ALL_STATUSES.includes(statusParam as StudentDocumentStatus)) {
        return NextResponse.json(
          { status: "error", message: `สถานะ "${statusParam}" ไม่มีอยู่จริง` },
          { status: 400 }
        );
      }
      q = q.eq("status", statusParam as StudentDocumentStatus);
    } else if (!statusParam) {
      // ค่าตั้งต้นคือคิวที่ยังไม่ตรวจ เพราะนั่นคือคำถามที่ฝ่ายทะเบียนเปิดหน้านี้มาถาม
      q = q.in("status", OPEN_DOCUMENT_STATUSES);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const rows = data ?? [];

    // ชื่อนักเรียนกับชื่อประเภทดึงแยกแล้วต่อในโค้ด — database.ts ใส่
    // Relationships: [] ไว้กับตารางใหม่ typed client จึงแปลง join ให้ไม่ได้
    const ids = [...new Set(rows.map((r) => r.student_id))];
    const [students, types] = await Promise.all([
      ids.length
        ? supabase.from("students").select("student_id, first_name, last_name, nickname, program").in("student_id", ids)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("document_types").select("key, label").eq("kind", "upload"),
    ]);

    const nameOf = new Map(
      (students.data ?? []).map((s) => [
        s.student_id,
        { name: `${s.first_name} ${s.last_name}`.trim(), nickname: s.nickname, program: s.program },
      ])
    );
    const labelOf = new Map((types.data ?? []).map((t) => [t.key, t.label]));

    return NextResponse.json({
      status: "success",
      count: rows.length,
      data: rows.map((r) => ({
        ...r,
        type_label: labelOf.get(r.document_type) ?? r.document_type,
        student: nameOf.get(r.student_id) ?? null,
      })),
    });
  },
  { permission: "document.view_all" }
);

export const PATCH = withAuth(
  async (req, { principal }) => {
    const parsed = await parseBody(req, ReviewSchema);
    if (!parsed.ok) return parsed.response;
    const { id, status, review_note } = parsed.data;

    const supabase = getServiceClient();
    const { data: before } = await supabase
      .from("student_documents")
      .select("id, student_id, document_type, status, review_note")
      .eq("id", id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json({ status: "error", message: "ไม่พบเอกสาร" }, { status: 404 });
    }

    // ตีกลับต้องบอกเหตุผลเสมอ — คำว่า "ไม่ผ่าน" เฉย ๆ ทำให้นักเรียนส่งซ้ำแบบเดิม
    // แล้วโดนตีกลับซ้ำ ซึ่งเสียเวลาทั้งสองฝ่ายโดยไม่มีใครผิด
    const needsReason = status === "rejected" || status === "revision_required";
    if (needsReason && !review_note?.trim()) {
      return NextResponse.json(
        { status: "error", message: "ต้องระบุเหตุผลว่าต้องแก้อะไร" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("student_documents")
      .update({
        status,
        review_note: review_note ?? null,
        reviewed_by: principal.subjectId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success", message: "บันทึกผลการตรวจแล้ว" }),
      audit: { entityId: id, before: { ...before }, after: { status, review_note } },
    };
  },
  {
    permission: "document.review",
    audit: { action: "document.review", entityType: "student_document" },
  }
);
