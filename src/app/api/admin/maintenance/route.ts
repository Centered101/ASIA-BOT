import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { ALL_STATUSES, OPEN_STATUSES } from "@/lib/server/maintenance";
import type { MaintenanceStatus, MaintenanceUrgency } from "@/types/database";

/**
 * รูปร่างของแถวที่ query นี้คืน
 *
 * ต้องประกาศเองเพราะ database.ts ใส่ `Relationships: []` ไว้กับตารางใหม่
 * ตัว typed client จึงแปลง join แบบ assets(...) ไม่ได้และคืน never ออกมา
 * การเติม metadata ของ relationship ให้ครบทุกตารางเป็นงานยาวที่ให้ประโยชน์
 * น้อยกว่าการระบุ type ตรงจุดที่ใช้จริงจุดเดียวแบบนี้
 */
type QueueRow = {
  id: string;
  request_code: string;
  reporter_name: string;
  reporter_student_id: string | null;
  reporter_phone: string | null;
  target_kind: string;
  target_label: string | null;
  location_note: string | null;
  category: string;
  symptom: string;
  urgency: MaintenanceUrgency;
  status: MaintenanceStatus;
  assigned_to: string | null;
  scheduled_on: string | null;
  cost: number | null;
  completed_at: string | null;
  created_at: string;
  assets: { id: string; name: string; asset_code: string | null } | null;
  rooms: { id: string; name: string } | null;
  equipment_items: { id: string; name: string } | null;
};

// คิวงานของฝ่ายอาคารสถานที่ พร้อมยอดสรุปตามสถานะและความเร่งด่วน
// แบบเดียวกับ get_all_equipment_requests ของ AI agent: คำถามที่ถามบ่อยที่สุด
// คือ "ค้างกี่งาน" ซึ่งควรตอบจากยอดรวม ไม่ใช่ให้ฝั่งเรียกไปนับเอง

export const GET = withAuth(
  async (req) => {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const urgency = url.searchParams.get("urgency");
    const assetId = url.searchParams.get("asset_id");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 200);

    const supabase = getServiceClient();

    let q = supabase
      .from("maintenance_requests")
      .select(
        "id, request_code, reporter_name, reporter_student_id, reporter_phone, target_kind, target_label, location_note, category, symptom, urgency, status, assigned_to, scheduled_on, cost, completed_at, created_at, assets(id, name, asset_code), rooms(id, name), equipment_items(id, name)"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    // "open" ไม่ใช่สถานะจริงในตาราง แต่เป็นคำถามที่ฝ่ายอาคารถามบ่อยที่สุด
    // คือ "อะไรค้างอยู่บ้าง" จึงรับเป็นคำสั่งกรองพิเศษ
    if (statusParam === "open") {
      q = q.in("status", OPEN_STATUSES);
    } else if (statusParam) {
      if (!ALL_STATUSES.includes(statusParam as MaintenanceStatus)) {
        return NextResponse.json(
          { status: "error", message: `สถานะ "${statusParam}" ไม่มีอยู่จริง` },
          { status: 400 }
        );
      }
      q = q.eq("status", statusParam as MaintenanceStatus);
    }

    if (urgency) q = q.eq("urgency", urgency as "low" | "normal" | "high" | "critical");
    if (assetId) q = q.eq("asset_id", assetId);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as unknown as QueueRow[];
    const by_status: Record<string, number> = {};
    const by_urgency: Record<string, number> = {};
    for (const r of rows) {
      by_status[r.status] = (by_status[r.status] ?? 0) + 1;
      if (OPEN_STATUSES.includes(r.status)) {
        by_urgency[r.urgency] = (by_urgency[r.urgency] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      status: "success",
      data: rows,
      count: rows.length,
      by_status,
      // นับความเร่งด่วนเฉพาะงานที่ยังค้าง งานที่ปิดแล้วไม่ใช่ภาระของคิว
      by_urgency_open: by_urgency,
      open_total: rows.filter((r) => OPEN_STATUSES.includes(r.status)).length,
      // เตือนว่ายอดถูกตัดที่ limit ฝั่งเรียกจะได้ไม่รายงานว่าเป็นยอดทั้งหมด
      truncated: rows.length === limit,
    });
  },
  { permission: "maintenance.view_all" }
);
