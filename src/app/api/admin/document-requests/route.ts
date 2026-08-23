import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import {
  ALL_REQUEST_STATUSES, OPEN_REQUEST_STATUSES,
  canTransitionRequest, generateVerifyToken,
} from "@/lib/server/documents";
import type { Database, DocumentRequestStatus } from "@/types/database";

type RequestUpdate = Database["public"]["Tables"]["document_requests"]["Update"];

/**
 * คิวคำขอเอกสารของฝ่ายทะเบียน — ขาที่โรงเรียนต้องออกเอกสารให้ (0023)
 *
 * เดินสถานะทีละขั้นตาม DOCUMENT_REQUEST_TRANSITIONS ห้ามข้าม และทุกครั้งที่
 * เปลี่ยนจะเขียนลง document_request_history เพราะคอลัมน์ reviewed_by
 * เก็บได้แค่คนล่าสุด แต่คำถามที่ต้องตอบได้คือ "ใครอนุมัติเมื่อไหร่"
 */

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "reviewing", "approved", "processing", "ready", "completed", "rejected"]),
  admin_note: z.string().trim().max(500).nullable().optional(),
  issued_file_url: z.string().trim().url().nullable().optional(),
  mark_paid: z.boolean().optional(),
});

export const GET = withAuth(
  async (req) => {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");

    const supabase = getServiceClient();
    let q = supabase
      .from("document_requests")
      .select("id, request_code, student_id, document_type, copies, purpose, delivery_mode, delivery_note, status, fee, paid_at, issued_file_url, verify_token, admin_note, reviewed_by, reviewed_at, completed_at, created_at")
      .order("created_at", { ascending: true })
      .limit(200);

    if (statusParam && statusParam !== "all") {
      if (!ALL_REQUEST_STATUSES.includes(statusParam as DocumentRequestStatus)) {
        return NextResponse.json(
          { status: "error", message: `สถานะ "${statusParam}" ไม่มีอยู่จริง` },
          { status: 400 }
        );
      }
      q = q.eq("status", statusParam as DocumentRequestStatus);
    } else if (!statusParam) {
      // ค่าตั้งต้นคือคำขอที่ยังไม่จบ ตรงกับ index document_requests_queue_idx
      q = q.in("status", OPEN_REQUEST_STATUSES);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const ids = [...new Set(rows.map((r) => r.student_id))];
    const [students, types] = await Promise.all([
      ids.length
        ? supabase.from("students").select("student_id, first_name, last_name, nickname, program, student_phone").in("student_id", ids)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("document_types").select("key, label").eq("kind", "issue"),
    ]);

    const studentOf = new Map(
      (students.data ?? []).map((s) => [
        s.student_id,
        { name: `${s.first_name} ${s.last_name}`.trim(), nickname: s.nickname, program: s.program, phone: s.student_phone },
      ])
    );
    const labelOf = new Map((types.data ?? []).map((t) => [t.key, t.label]));

    return NextResponse.json({
      status: "success",
      count: rows.length,
      data: rows.map((r) => ({
        ...r,
        type_label: labelOf.get(r.document_type) ?? r.document_type,
        student: studentOf.get(r.student_id) ?? null,
      })),
    });
  },
  { permission: "document.view_all" }
);

export const PATCH = withAuth(
  async (req, { principal }) => {
    const parsed = await parseBody(req, PatchSchema);
    if (!parsed.ok) return parsed.response;
    const { id, status, admin_note, issued_file_url, mark_paid } = parsed.data;

    const supabase = getServiceClient();
    const { data: before } = await supabase
      .from("document_requests")
      .select("id, request_code, student_id, status, fee, paid_at, verify_token")
      .eq("id", id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json({ status: "error", message: "ไม่พบคำขอ" }, { status: 404 });
    }

    if (!canTransitionRequest(before.status, status)) {
      return NextResponse.json(
        { status: "error", message: `เปลี่ยนจาก "${before.status}" ไป "${status}" ไม่ได้` },
        { status: 409 }
      );
    }

    // ไม่อนุมัติต้องบอกเหตุผล เหตุผลเดียวกับการตีกลับเอกสารในแฟ้ม
    if (status === "rejected" && !admin_note?.trim()) {
      return NextResponse.json(
        { status: "error", message: "ต้องระบุเหตุผลที่ไม่อนุมัติ" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const patch: RequestUpdate = {
      status,
      reviewed_by: principal.subjectId,
      reviewed_at: now,
      updated_at: now,
    };
    if (admin_note !== undefined) patch.admin_note = admin_note ?? null;
    if (issued_file_url !== undefined) patch.issued_file_url = issued_file_url ?? null;
    if (mark_paid && !before.paid_at) patch.paid_at = now;
    if (status === "completed") patch.completed_at = now;

    // โค้ดตรวจสอบออกตอนเอกสารพร้อมจ่าย ไม่ใช่ตอนสร้างคำขอ — คำขอที่ยังไม่ถูก
    // อนุมัติไม่ควรมีโค้ดที่สแกนแล้วขึ้นว่า "เอกสารจริง" ลอยอยู่ในระบบ
    if (status === "ready" && !before.verify_token) {
      patch.verify_token = generateVerifyToken();
    }

    const { error } = await supabase.from("document_requests").update(patch).eq("id", id);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    // เขียนไทม์ไลน์แยก ถ้าเขียนไม่ได้ก็ไม่ตีคำขอที่เปลี่ยนสำเร็จไปแล้วให้เป็น error
    const { error: historyError } = await supabase.from("document_request_history").insert({
      request_id: id,
      from_status: before.status,
      to_status: status,
      note: admin_note ?? null,
      changed_by: principal.subjectId,
    });
    if (historyError) console.error("[documents] เขียนไทม์ไลน์ไม่สำเร็จ:", historyError.message);

    return {
      response: NextResponse.json({
        status: "success",
        message: `อัปเดตคำขอ ${before.request_code} แล้ว`,
      }),
      audit: { entityId: id, before: { ...before }, after: { ...patch } },
    };
  },
  {
    permission: "document.issue",
    audit: { action: "document.request.update", entityType: "document_request" },
  }
);
