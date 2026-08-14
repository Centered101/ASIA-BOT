import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import { ALL_STATUSES, generateRequestCode, targetError } from "@/lib/server/maintenance";
import { hasPermission } from "@/lib/rbac/definitions";
import type { Database, MaintenanceStatus } from "@/types/database";

type RequestInsert = Database["public"]["Tables"]["maintenance_requests"]["Insert"];

// แจ้งซ่อมสำหรับผู้ใช้ทั่วไป — นักเรียน ครู เจ้าหน้าที่ ใครก็แจ้งได้
// การจัดการงาน (เลื่อนสถานะ มอบหมาย ค่าใช้จ่าย) อยู่ที่ /api/admin/maintenance

const CATEGORIES = [
  "ไฟฟ้า", "ประปา", "แอร์", "โครงสร้าง",
  "เฟอร์นิเจอร์", "อุปกรณ์", "คอมพิวเตอร์", "อื่นๆ",
] as const;

const CreateSchema = z.object({
  reporter_name: z.string().trim().min(1, "ต้องระบุชื่อผู้แจ้ง"),
  reporter_phone: z.string().trim().nullable().optional(),
  target_kind: z.enum(["asset", "equipment_item", "room", "other"]).default("other"),
  asset_id: z.string().uuid().nullable().optional(),
  equipment_item_id: z.string().uuid().nullable().optional(),
  room_id: z.string().uuid().nullable().optional(),
  target_label: z.string().trim().nullable().optional(),
  location_note: z.string().trim().nullable().optional(),
  category: z.enum(CATEGORIES).default("อื่นๆ"),
  symptom: z.string().trim().min(1, "ต้องระบุอาการเสีย"),
  urgency: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  photo_urls: z.array(z.string().trim().url()).max(10).optional(),
});

export const POST = withAuth(
  async (req, { principal }) => {
    const parsed = await parseBody(req, CreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // ตรวจที่นี่เพื่อให้ได้ข้อความไทยบอกว่าขาดอะไร แทน error 23514 ดิบ ๆ
    // จาก CHECK constraint ซึ่งเป็นด่านสุดท้ายในชั้น DB
    const targetProblem = targetError(body);
    if (targetProblem) {
      return NextResponse.json({ status: "error", message: targetProblem }, { status: 400 });
    }

    const supabase = getServiceClient();
    const requestCode = generateRequestCode();

    const payload: RequestInsert = {
      request_code: requestCode,
      reporter_name: body.reporter_name,
      reporter_phone: body.reporter_phone ?? null,
      // บันทึกว่าใครแจ้งจาก principal ไม่ใช่จาก body เพื่อให้ปลอมชื่อคนแจ้งไม่ได้
      reporter_student_id: principal.subjectType === "student" ? principal.subjectId : null,
      reporter_admin_id: principal.subjectType === "admin" ? principal.subjectId : null,
      target_kind: body.target_kind,
      // เขียนเฉพาะ id ที่ตรงกับ kind ที่เลือก ป้องกันข้อมูลค้างจาก kind อื่น
      // ที่ผู้ใช้เคยเลือกไว้ก่อนเปลี่ยนใจในฟอร์ม
      asset_id: body.target_kind === "asset" ? body.asset_id ?? null : null,
      equipment_item_id:
        body.target_kind === "equipment_item" ? body.equipment_item_id ?? null : null,
      room_id: body.target_kind === "room" ? body.room_id ?? null : null,
      target_label: body.target_label ?? null,
      location_note: body.location_note ?? null,
      category: body.category,
      symptom: body.symptom,
      urgency: body.urgency,
      status: "reported",
    };

    const { data, error } = await supabase
      .from("maintenance_requests")
      .insert(payload)
      .select("id, request_code")
      .single();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    // รูปตอนแจ้งคือหลักฐาน "ก่อนซ่อม" เสมอ
    if (body.photo_urls?.length) {
      const { error: photoError } = await supabase.from("maintenance_photos").insert(
        body.photo_urls.map((url) => ({
          request_id: data.id,
          phase: "before" as const,
          image_url: url,
          uploaded_by: principal.subjectId,
        }))
      );
      // คำขอถูกสร้างแล้ว รูปแนบไม่ได้จึงไม่ควรทำให้ผู้ใช้คิดว่าแจ้งไม่สำเร็จ
      // แต่ต้องไม่เงียบ ส่งกลับไปใน response
      if (photoError) {
        return NextResponse.json({
          status: "success",
          id: data.id,
          request_code: data.request_code,
          warning: `แจ้งซ่อมสำเร็จแต่แนบรูปไม่ได้: ${photoError.message}`,
        });
      }
    }

    // ไทม์ไลน์เริ่มต้นที่การแจ้ง เพื่อให้ประวัติครบตั้งแต่ก้าวแรก
    await supabase.from("maintenance_status_history").insert({
      request_id: data.id,
      from_status: null,
      to_status: "reported",
      note: "แจ้งเข้าระบบ",
      changed_by: principal.subjectId,
    });

    return {
      response: NextResponse.json({
        status: "success",
        id: data.id,
        request_code: data.request_code,
        message: `แจ้งซ่อมสำเร็จ รหัส ${data.request_code}`,
      }),
      audit: { entityId: data.id, after: { ...payload } },
    };
  },
  {
    permission: "maintenance.create",
    audit: { action: "maintenance.create", entityType: "maintenance_request" },
  }
);

/** คำขอของตัวเอง — หรือทั้งหมดถ้ามีสิทธิ์ maintenance.view_all */
export const GET = withAuth(
  async (req, { principal }) => {
    const supabase = getServiceClient();
    const seeAll = hasPermission(principal.permissions, "maintenance.view_all");

    let q = supabase
      .from("maintenance_requests")
      .select(
        "id, request_code, target_kind, target_label, location_note, category, symptom, urgency, status, assigned_to, scheduled_on, completed_at, created_at, assets(name, asset_code), rooms(name), equipment_items(name)"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (!seeAll) {
      // เห็นเฉพาะที่ตัวเองแจ้ง คนละคอลัมน์กันระหว่างนักเรียนกับแอดมิน
      q =
        principal.subjectType === "student"
          ? q.eq("reporter_student_id", principal.subjectId)
          : q.eq("reporter_admin_id", principal.subjectId);
    }

    // กรอง status จาก query string ต้องอยู่ในชุดที่มีจริง ไม่งั้นค่าที่พิมพ์ผิด
    // จะกลายเป็นตัวกรองที่ไม่ตรงอะไรเลย แล้วดูเหมือนว่าไม่มีงานค้าง
    const statusParam = new URL(req.url).searchParams.get("status");
    if (statusParam) {
      if (!ALL_STATUSES.includes(statusParam as MaintenanceStatus)) {
        return NextResponse.json(
          { status: "error", message: `สถานะ "${statusParam}" ไม่มีอยู่จริง` },
          { status: 400 }
        );
      }
      q = q.eq("status", statusParam as MaintenanceStatus);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      data: data ?? [],
      count: data?.length ?? 0,
      scope: seeAll ? "all" : "own",
    });
  },
  { permission: "maintenance.view_own" }
);
