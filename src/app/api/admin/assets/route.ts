import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import type { Database } from "@/types/database";

type AssetInsert = Database["public"]["Tables"]["assets"]["Insert"];

const CONDITIONS = ["new", "good", "fair", "poor", "broken"] as const;
const STATUSES = ["in_use", "in_storage", "under_repair", "disposed", "lost"] as const;

const CreateSchema = z.object({
  // เลขครุภัณฑ์เป็นตัวเลือก ไม่ใช่ข้อบังคับ — ของที่ยังไม่ได้ลงเลขก็ต้อง
  // บันทึกได้ ไม่งั้นคนจะปลอมเลขขึ้นมาให้ผ่านฟอร์ม แล้วทะเบียนเสียความหมาย
  asset_code: z.string().trim().min(1).nullable().optional(),
  serial_number: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1, "ต้องระบุชื่อครุภัณฑ์"),
  category: z.string().trim().min(1, "ต้องระบุหมวดหมู่"),
  brand: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  room_id: z.string().uuid().nullable().optional(),
  location_note: z.string().trim().nullable().optional(),
  responsible_person: z.string().trim().nullable().optional(),
  department: z.string().trim().nullable().optional(),
  acquired_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD").nullable().optional(),
  price: z.number().nonnegative("ราคาต้องไม่ติดลบ").nullable().optional(),
  funding_source: z.string().trim().nullable().optional(),
  condition: z.enum(CONDITIONS).optional(),
  status: z.enum(STATUSES).optional(),
  image_urls: z.array(z.string().trim().url()).max(10).nullable().optional(),
  equipment_item_id: z.string().uuid().nullable().optional(),
  note: z.string().trim().nullable().optional(),
});

export const GET = withAuth(
  async (req) => {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");
    const roomId = url.searchParams.get("room_id");
    const search = url.searchParams.get("q")?.trim();
    // "ของที่ยังไม่ได้ลงเลขครุภัณฑ์" คืองานค้างที่ฝ่ายพัสดุต้องตามเก็บ
    // จึงทำเป็นตัวกรองตรง ๆ ไม่ใช่ให้ไปหาเอาเองจากรายการทั้งหมด
    const missingCode = url.searchParams.get("missing_code") === "1";

    const supabase = getServiceClient();
    let q = supabase
      .from("assets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (category) q = q.eq("category", category);
    if (status) q = q.eq("status", status as (typeof STATUSES)[number]);
    if (roomId) q = q.eq("room_id", roomId);
    if (missingCode) q = q.is("asset_code", null).is("disposed_at", null);
    if (search) {
      q = q.or(
        `name.ilike.%${search}%,asset_code.ilike.%${search}%,serial_number.ilike.%${search}%,brand.ilike.%${search}%`
      );
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    return NextResponse.json({
      status: "success",
      data: rows,
      count: rows.length,
      missing_code_count: rows.filter((a) => !a.asset_code && !a.disposed_at).length,
    });
  },
  { permission: "asset.view" }
);

export const POST = withAuth(
  async (req) => {
    const parsed = await parseBody(req, CreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const supabase = getServiceClient();

    // ตรวจเลขซ้ำก่อน เพื่อให้ได้ข้อความไทยแทน error 23505 ดิบจาก unique index
    if (body.asset_code) {
      const { data: dupe } = await supabase
        .from("assets")
        .select("id, name")
        .eq("asset_code", body.asset_code)
        .maybeSingle();
      if (dupe) {
        return NextResponse.json(
          { status: "error", message: `เลขครุภัณฑ์ ${body.asset_code} ถูกใช้กับ "${dupe.name}" แล้ว` },
          { status: 409 }
        );
      }
    }

    const payload: AssetInsert = {
      ...body,
      asset_code: body.asset_code ?? null,
      serial_number: body.serial_number ?? null,
    };

    const { data, error } = await supabase
      .from("assets")
      .insert(payload)
      .select("id, qr_token")
      .single();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success", id: data.id, qr_token: data.qr_token }),
      audit: { entityId: data.id, after: { ...payload } },
    };
  },
  {
    permission: "asset.manage",
    audit: { action: "asset.create", entityType: "asset" },
  }
);
