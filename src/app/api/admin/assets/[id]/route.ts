import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import { hasPermission } from "@/lib/rbac/definitions";
import type { Database } from "@/types/database";

type AssetUpdate = Database["public"]["Tables"]["assets"]["Update"];

/**
 * ครุภัณฑ์รายชิ้น — ดู แก้ไข และจำหน่าย
 *
 * เจตนาที่ต่างจาก CRUD ทั่วไปสองข้อ:
 *
 * 1. แก้ที่อยู่และผู้รับผิดชอบผ่านที่นี่ไม่ได้ ต้องไปที่ /move
 *    เพราะ assets เก็บได้แค่ที่อยู่ปัจจุบัน ถ้าปล่อยให้ PATCH ทับ room_id ได้
 *    ตาราง asset_movements จะมีรูโหว่ และประวัติ "ของชิ้นนี้เคยอยู่ไหนบ้าง"
 *    จะเชื่อถือไม่ได้ทันทีที่มีคนเผลอแก้ทางลัด
 *
 * 2. จำหน่ายไม่ใช่การลบ ใช้ DELETE แต่เขียน disposed_at ไว้
 *    ของที่จำหน่ายแล้วยังต้องค้นเจอ เพราะประวัติซ่อมและเลขครุภัณฑ์เดิม
 *    ยังถูกอ้างถึงในเอกสารตรวจสอบพัสดุ
 */

const CONDITIONS = ["new", "good", "fair", "poor", "broken"] as const;
/** disposed ไม่อยู่ในลิสต์ — เปลี่ยนเป็นจำหน่ายต้องผ่าน DELETE เท่านั้น */
const STATUSES = ["in_use", "in_storage", "under_repair", "lost"] as const;

const PatchSchema = z.object({
  asset_code: z.string().trim().min(1).nullable().optional(),
  serial_number: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1, "ต้องระบุชื่อครุภัณฑ์").optional(),
  category: z.string().trim().min(1, "ต้องระบุหมวดหมู่").optional(),
  brand: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  department: z.string().trim().nullable().optional(),
  acquired_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD").nullable().optional(),
  price: z.number().nonnegative("ราคาต้องไม่ติดลบ").nullable().optional(),
  funding_source: z.string().trim().nullable().optional(),
  condition: z.enum(CONDITIONS).optional(),
  status: z.enum(STATUSES).optional(),
  image_urls: z.array(z.string().trim().url()).max(10).nullable().optional(),
  equipment_item_id: z.string().uuid().nullable().optional(),
  note: z.string().trim().nullable().optional(),
  /** คืนของที่จำหน่ายผิด ต้องมีสิทธิ์ระดับเดียวกับตอนจำหน่าย */
  restore: z.literal(true).optional(),
});

const DisposeSchema = z.object({
  reason: z.string().trim().min(1, "ต้องระบุเหตุผลการจำหน่าย"),
});

/** รายละเอียดครุภัณฑ์ พร้อมประวัติย้ายและประวัติซ่อมของชิ้นนี้ */
export const GET = withAuth<{ id: string }>(
  async (_req, { params }) => {
    const supabase = getServiceClient();

    const { data: asset, error } = await supabase
      .from("assets")
      .select("*, rooms(id, name), equipment_items(id, name)")
      .eq("id", params.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
    if (!asset) {
      return NextResponse.json({ status: "error", message: "ไม่พบครุภัณฑ์นี้" }, { status: 404 });
    }

    const [movements, repairs] = await Promise.all([
      supabase
        .from("asset_movements")
        .select("*")
        .eq("asset_id", params.id)
        .order("moved_on", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("maintenance_requests")
        .select("id, request_code, status, category, symptom, urgency, cost, created_at, completed_at")
        .eq("asset_id", params.id)
        .order("created_at", { ascending: false }),
    ]);

    // ไม่กลบ error เป็น [] — "ไม่มีประวัติ" กับ "อ่านประวัติไม่ได้" ต่างกันมาก
    // สำหรับของที่ต้องตรวจสอบพัสดุ
    if (movements.error) {
      return NextResponse.json({ status: "error", message: movements.error.message }, { status: 500 });
    }
    if (repairs.error) {
      return NextResponse.json({ status: "error", message: repairs.error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      data: {
        asset,
        movements: movements.data ?? [],
        repairs: repairs.data ?? [],
        // ค่าซ่อมสะสม ใช้ตอบว่าซ่อมมาเท่าไหร่แล้ว คุ้มจะซ่อมต่อหรือจำหน่าย
        repair_cost_total: (repairs.data ?? []).reduce((sum, r) => sum + (r.cost ?? 0), 0),
      },
    });
  },
  { permission: "asset.view" }
);

export const PATCH = withAuth<{ id: string }>(
  async (req, { principal, params }) => {
    const parsed = await parseBody(req, PatchSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const supabase = getServiceClient();
    const { data: before } = await supabase
      .from("assets")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json({ status: "error", message: "ไม่พบครุภัณฑ์นี้" }, { status: 404 });
    }

    if (body.restore && !hasPermission(principal.permissions, "asset.dispose")) {
      return NextResponse.json(
        { status: "error", message: "ต้องมีสิทธิ์จำหน่ายครุภัณฑ์จึงจะกู้คืนได้" },
        { status: 403 }
      );
    }

    // ของที่จำหน่ายแล้วแก้ไม่ได้ ต้องกู้คืนก่อน ไม่งั้นทะเบียนจำหน่าย
    // จะถูกแก้ย้อนหลังเงียบ ๆ โดยไม่มีร่องรอยว่าเคยจำหน่ายด้วยสภาพไหน
    if (before.disposed_at && !body.restore) {
      return NextResponse.json(
        { status: "error", message: "ครุภัณฑ์นี้จำหน่ายแล้ว ต้องกู้คืนก่อนจึงจะแก้ไขได้" },
        { status: 409 }
      );
    }

    const update: AssetUpdate = { updated_at: new Date().toISOString() };
    if (body.asset_code !== undefined) update.asset_code = body.asset_code;
    if (body.serial_number !== undefined) update.serial_number = body.serial_number;
    if (body.name !== undefined) update.name = body.name;
    if (body.category !== undefined) update.category = body.category;
    if (body.brand !== undefined) update.brand = body.brand;
    if (body.model !== undefined) update.model = body.model;
    if (body.department !== undefined) update.department = body.department;
    if (body.acquired_on !== undefined) update.acquired_on = body.acquired_on;
    if (body.price !== undefined) update.price = body.price;
    if (body.funding_source !== undefined) update.funding_source = body.funding_source;
    if (body.condition !== undefined) update.condition = body.condition;
    if (body.status !== undefined) update.status = body.status;
    if (body.image_urls !== undefined) update.image_urls = body.image_urls;
    if (body.equipment_item_id !== undefined) update.equipment_item_id = body.equipment_item_id;
    if (body.note !== undefined) update.note = body.note;

    if (body.restore) {
      update.disposed_at = null;
      update.disposed_reason = null;
      // กลับมาเป็น in_storage ไม่ใช่ in_use เพราะกู้คืนทะเบียนไม่ได้แปลว่า
      // ของกลับไปอยู่หน้างานแล้ว ต้องให้คนยืนยันสถานะจริงอีกที
      update.status = body.status ?? "in_storage";
    }

    const { error } = await supabase.from("assets").update(update).eq("id", params.id);
    if (error) {
      // เลขครุภัณฑ์ซ้ำเป็นความผิดพลาดที่เจอบ่อยที่สุดตอนแก้ทะเบียน
      // ตอบเป็นภาษาคนแทนข้อความ constraint ของ postgres
      const duplicate = error.code === "23505";
      return NextResponse.json(
        { status: "error", message: duplicate ? "เลขครุภัณฑ์นี้มีอยู่แล้วในระบบ" : error.message },
        { status: duplicate ? 409 : 500 }
      );
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: params.id, before, after: update },
    };
  },
  {
    permission: "asset.manage",
    audit: { action: "asset.update", entityType: "asset" },
  }
);

/** จำหน่าย — soft delete เท่านั้น แถวยังอยู่เพื่อให้ประวัติซ่อมไม่ขาดตอน */
export const DELETE = withAuth<{ id: string }>(
  async (req, { params }) => {
    const parsed = await parseBody(req, DisposeSchema);
    if (!parsed.ok) return parsed.response;

    const supabase = getServiceClient();
    const { data: before } = await supabase
      .from("assets")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json({ status: "error", message: "ไม่พบครุภัณฑ์นี้" }, { status: 404 });
    }
    if (before.disposed_at) {
      return NextResponse.json(
        { status: "error", message: "ครุภัณฑ์นี้จำหน่ายไปแล้ว" },
        { status: 409 }
      );
    }

    // งานซ่อมที่ยังไม่ปิดต้องจัดการก่อน ไม่งั้นจะเหลือใบแจ้งซ่อมลอย ๆ
    // ที่ชี้ไปยังของซึ่งไม่มีอยู่แล้ว และช่างจะยังเห็นมันในคิวงาน
    // ไม่ปิดให้อัตโนมัติ เพราะการปิดงานซ่อมเป็นการตัดสินใจของช่าง ไม่ใช่ผลข้างเคียง
    const { data: openJobs } = await supabase
      .from("maintenance_requests")
      .select("request_code")
      .eq("asset_id", params.id)
      .not("status", "in", "(completed,cancelled)");

    if (openJobs?.length) {
      const codes = openJobs.map((j) => j.request_code).join(", ");
      return NextResponse.json(
        {
          status: "error",
          message: `ยังมีงานซ่อมค้างอยู่ (${codes}) ให้ปิดหรือยกเลิกงานซ่อมก่อนจำหน่าย`,
        },
        { status: 409 }
      );
    }

    const update: AssetUpdate = {
      status: "disposed",
      disposed_at: new Date().toISOString(),
      disposed_reason: parsed.data.reason,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("assets").update(update).eq("id", params.id);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success", message: "จำหน่ายครุภัณฑ์แล้ว" }),
      audit: { entityId: params.id, before, after: update },
    };
  },
  {
    permission: "asset.dispose",
    audit: { action: "asset.dispose", entityType: "asset" },
  }
);
