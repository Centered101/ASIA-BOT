import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import { ALL_STATUSES, generateRequestCode, targetError } from "@/lib/server/maintenance";
import { hasPermission } from "@/lib/rbac/definitions";
import { buildMaintenanceRequestFlexMessage, sendLineFlexMessage } from "@/lib/line";
import { getLineNotificationTarget } from "@/lib/line-targets";
import { MAINTENANCE_URGENCY_TH } from "@/lib/server/maintenance";
import type { Database, MaintenanceStatus } from "@/types/database";

type RequestInsert = Database["public"]["Tables"]["maintenance_requests"]["Insert"];

// แจ้งซ่อมสำหรับผู้ใช้ทั่วไป — นักเรียน ครู เจ้าหน้าที่ ใครก็แจ้งได้
// การจัดการงาน (เลื่อนสถานะ มอบหมาย ค่าใช้จ่าย) อยู่ที่ /api/admin/maintenance

const CATEGORIES = [
  "ไฟฟ้า", "ประปา", "แอร์", "โครงสร้าง",
  "เฟอร์นิเจอร์", "อุปกรณ์", "คอมพิวเตอร์", "อื่นๆ",
] as const;

// ไม่รับข้อมูลผู้แจ้งจาก body เลย — ทั้งชื่อและเบอร์มาจากบัญชีที่ล็อกอิน
// ถ้ารับจาก body ใครก็แจ้งซ่อมในนามคนอื่นได้ ฝ่ายอาคารจะติดต่อผิดคน
// และ audit log จะชี้ไปผิดคนด้วย ถ้าเบอร์ไม่ถูกให้ไปแก้ที่โปรไฟล์
const CreateSchema = z.object({
  target_kind: z.enum(["asset", "equipment_item", "room", "other"]).default("other"),
  asset_id: z.string().uuid().nullable().optional(),
  equipment_item_id: z.string().uuid().nullable().optional(),
  room_id: z.string().uuid().nullable().optional(),
  target_label: z.string().trim().nullable().optional(),
  // จำนวนที่เสีย ใช้เฉพาะคลังยืม จะถูกกันออกจากยอดที่ยืมได้จนกว่างานจะปิด
  affected_quantity: z.number().int().positive().nullable().optional(),
  location_note: z.string().trim().nullable().optional(),
  category: z.enum(CATEGORIES).default("อื่นๆ"),
  symptom: z.string().trim().min(1, "ต้องระบุอาการเสีย"),
  urgency: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  photo_urls: z.array(z.string().trim().url()).max(10).optional(),
});

/**
 * ชื่อสิ่งที่จะซ่อมสำหรับใส่ในข้อความแจ้งเตือน
 *
 * ฝั่ง DB เก็บเป็น FK สามตัวกับ target_label ผู้รับแจ้งต้องอ่านเป็นชื่อ
 * ไม่ใช่ UUID จึงต้องไปดึงชื่อจริงมาก่อนส่ง
 */
async function describeTarget(
  supabase: ReturnType<typeof getServiceClient>,
  body: { target_kind: string; asset_id?: string | null; room_id?: string | null; equipment_item_id?: string | null; target_label?: string | null }
): Promise<string> {
  if (body.target_kind === "asset" && body.asset_id) {
    const { data } = await supabase
      .from("assets").select("name, asset_code").eq("id", body.asset_id).maybeSingle();
    if (data) return `${data.asset_code ? `[${data.asset_code}] ` : ""}${data.name}`;
  }
  if (body.target_kind === "room" && body.room_id) {
    const { data } = await supabase.from("rooms").select("name").eq("id", body.room_id).maybeSingle();
    if (data) return `ห้อง ${data.name}`;
  }
  if (body.target_kind === "equipment_item" && body.equipment_item_id) {
    const { data } = await supabase
      .from("equipment_items").select("name").eq("id", body.equipment_item_id).maybeSingle();
    if (data) return data.name;
  }
  return body.target_label?.trim() || "ไม่ระบุ";
}

/** เบอร์ติดต่อกลับจาก profile — students.student_phone / admins.phone / teachers.phone */
async function lookupPhone(
  supabase: ReturnType<typeof getServiceClient>,
  subjectType: string,
  subjectId: string
): Promise<string | null> {
  if (subjectType === "student") {
    const { data } = await supabase
      .from("students").select("student_phone").eq("student_id", subjectId).maybeSingle();
    return data?.student_phone ?? null;
  }
  if (subjectType === "admin") {
    const { data } = await supabase
      .from("admins").select("phone").eq("admin_id", subjectId).maybeSingle();
    return data?.phone ?? null;
  }
  if (subjectType === "teacher") {
    const { data } = await supabase
      .from("teachers").select("phone").eq("id", subjectId).maybeSingle();
    return data?.phone ?? null;
  }
  return null;
}

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

    // เบอร์ติดต่อกลับดึงจาก profile ตามชนิดของผู้ใช้ ไม่ใช่จากฟอร์ม
    // คนละคอลัมน์กันในแต่ละตาราง จึงต้องแยกตาม subjectType
    const reporterPhone = await lookupPhone(supabase, principal.subjectType, principal.subjectId);

    const payload: RequestInsert = {
      request_code: requestCode,
      // ชื่อและตัวตนผู้แจ้งมาจาก principal ทั้งคู่ ไม่ใช่จาก body
      reporter_name: principal.displayName,
      reporter_phone: reporterPhone,
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
      // เก็บจำนวนเฉพาะเมื่อเป็นของในคลัง ของรายชิ้นมีชิ้นเดียวอยู่แล้ว
      affected_quantity:
        body.target_kind === "equipment_item" ? body.affected_quantity ?? 1 : null,
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

    // แจ้งฝ่ายอาคารผ่าน LINE — งานซ่อมที่ไม่มีใครเห็นก็เท่ากับไม่ได้แจ้ง
    // ห่อ try/catch เพราะคำขอถูกบันทึกไปแล้ว LINE ล่มไม่ควรทำให้ผู้ใช้
    // เข้าใจว่าแจ้งไม่สำเร็จแล้วกดซ้ำจนได้งานซ้ำ
    try {
      const targetName = await describeTarget(supabase, body);
      await sendLineFlexMessage(
        await getLineNotificationTarget(supabase, "maintenance"),
        `${body.urgency === "critical" ? "🚨" : "🔧"} แจ้งซ่อมใหม่: ${targetName} — ${MAINTENANCE_URGENCY_TH[body.urgency]}`,
        buildMaintenanceRequestFlexMessage({
          requestCode,
          targetName,
          category: body.category,
          symptom: body.symptom,
          urgency: body.urgency,
          reporterName: principal.displayName,
          reporterPhone: reporterPhone,
          locationNote: body.location_note ?? null,
          affectedQuantity: payload.affected_quantity ?? null,
          photoUrl: body.photo_urls?.[0] ?? null,
        })
      );
    } catch (e) {
      console.error("[LINE] maintenance notify failed:", e);
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
