import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import { transitionError } from "@/lib/server/maintenance";
import { hasPermission } from "@/lib/rbac/definitions";
import type { Database, MaintenanceStatus } from "@/types/database";

type RequestUpdate = Database["public"]["Tables"]["maintenance_requests"]["Update"];

const PatchSchema = z.object({
  status: z
    .enum([
      "reported", "received", "inspecting", "assigned",
      "repairing", "waiting_inspection", "completed", "cancelled",
    ])
    .optional(),
  status_note: z.string().trim().nullable().optional(),
  assigned_to: z.string().trim().nullable().optional(),
  scheduled_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD").nullable().optional(),
  cost: z.number().nonnegative("ค่าใช้จ่ายต้องไม่ติดลบ").nullable().optional(),
  parts_note: z.string().trim().nullable().optional(),
  completion_note: z.string().trim().nullable().optional(),
  admin_note: z.string().trim().nullable().optional(),
  urgency: z.enum(["low", "normal", "high", "critical"]).optional(),
});

/** รายละเอียดงานซ่อมหนึ่งงาน พร้อมรูปและไทม์ไลน์ */
export const GET = withAuth<{ id: string }>(
  async (_req, { params }) => {
    const supabase = getServiceClient();

    const { data: request, error } = await supabase
      .from("maintenance_requests")
      .select("*, assets(id, name, asset_code, serial_number), rooms(id, name), equipment_items(id, name)")
      .eq("id", params.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
    if (!request) {
      return NextResponse.json({ status: "error", message: "ไม่พบงานซ่อมนี้" }, { status: 404 });
    }

    const [photos, history] = await Promise.all([
      supabase
        .from("maintenance_photos")
        .select("*")
        .eq("request_id", params.id)
        .order("created_at"),
      supabase
        .from("maintenance_status_history")
        .select("*")
        .eq("request_id", params.id)
        .order("created_at"),
    ]);

    // ไม่ใช้ ?? [] เงียบ ๆ — ถ้า query ล้มต้องรู้ ไม่ใช่แสดงว่า "ไม่มีรูป"
    const partialErrors = [
      photos.error ? `photos: ${photos.error.message}` : null,
      history.error ? `history: ${history.error.message}` : null,
    ].filter(Boolean);

    return NextResponse.json({
      status: "success",
      ...(partialErrors.length ? { partial_errors: partialErrors } : {}),
      data: {
        request,
        photos: photos.data ?? [],
        history: history.data ?? [],
      },
    });
  },
  { permission: "maintenance.view_all" }
);

export const PATCH = withAuth<{ id: string }>(
  async (req, { params, principal }) => {
    const parsed = await parseBody(req, PatchSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const supabase = getServiceClient();

    const { data: before } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json({ status: "error", message: "ไม่พบงานซ่อมนี้" }, { status: 404 });
    }

    const update: RequestUpdate = { updated_at: new Date().toISOString() };
    let statusChanged = false;

    if (body.status && body.status !== before.status) {
      // ปฏิเสธการข้ามขั้น ตรรกะอยู่ใน src/lib/server/maintenance.ts และมี test
      // คุมไว้ เพราะถ้าข้ามจาก reported ไป completed ได้ ระบบจะบันทึกว่าซ่อม
      // เสร็จทั้งที่ไม่มีใครตรวจสอบหรือรับงานเลย
      const problem = transitionError(before.status, body.status);
      if (problem) {
        return NextResponse.json({ status: "error", message: problem }, { status: 400 });
      }

      // ตรวจรับงานเป็นการปิดงบ ต้องใช้สิทธิ์แยกจากการเลื่อนขั้นทั่วไป
      const needed = body.status === "completed" ? "maintenance.complete" : "maintenance.update";
      if (!hasPermission(principal.permissions, needed)) {
        return NextResponse.json(
          { status: "error", message: "ไม่มีสิทธิ์เปลี่ยนสถานะเป็นขั้นนี้" },
          { status: 403 }
        );
      }

      update.status = body.status;
      statusChanged = true;
      if (body.status === "completed") update.completed_at = new Date().toISOString();
    }

    if (body.assigned_to !== undefined) {
      if (!hasPermission(principal.permissions, "maintenance.assign")) {
        return NextResponse.json(
          { status: "error", message: "ไม่มีสิทธิ์มอบหมายงาน" },
          { status: 403 }
        );
      }
      update.assigned_to = body.assigned_to;
    }

    // แตะเฉพาะคีย์ที่ส่งมาจริง คีย์ที่ไม่ส่งต้องไม่ถูกอ่านว่า "ตั้งเป็น null"
    if (body.scheduled_on !== undefined) update.scheduled_on = body.scheduled_on;
    if (body.cost !== undefined) update.cost = body.cost;
    if (body.parts_note !== undefined) update.parts_note = body.parts_note;
    if (body.completion_note !== undefined) update.completion_note = body.completion_note;
    if (body.admin_note !== undefined) update.admin_note = body.admin_note;
    if (body.urgency !== undefined) update.urgency = body.urgency;

    const { error } = await supabase
      .from("maintenance_requests")
      .update(update)
      .eq("id", params.id);

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    if (statusChanged) {
      const { error: logError } = await supabase.from("maintenance_status_history").insert({
        request_id: params.id,
        from_status: before.status,
        to_status: update.status as MaintenanceStatus,
        note: body.status_note ?? null,
        changed_by: principal.subjectId,
      });
      // งานถูกเลื่อนขั้นไปแล้ว การบันทึกไทม์ไลน์ล้มไม่ควรทำให้ดูเหมือนล้มเหลว
      // แต่ต้องไม่เงียบ เพราะไทม์ไลน์คือหลักฐานการตรวจรับ
      if (logError) {
        return {
          response: NextResponse.json({
            status: "success",
            warning: `เปลี่ยนสถานะแล้วแต่บันทึกไทม์ไลน์ไม่ได้: ${logError.message}`,
          }),
          audit: { entityId: params.id, before, after: update },
        };
      }
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: params.id, before, after: update },
    };
  },
  {
    permission: "maintenance.update",
    audit: { action: "maintenance.update", entityType: "maintenance_request" },
  }
);
