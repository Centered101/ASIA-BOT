import { NextRequest, NextResponse } from "next/server";
import { equipmentUnderRepair, effectiveAvailable } from "@/lib/server/maintenance-stock";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildEquipmentRequestFlexMessage, sendLineFlexMessage } from "@/lib/line";
import { getLineNotificationTarget } from "@/lib/line-targets";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_BORROW_QUANTITY = 6;
const HISTORY_RETENTION_DAYS = 30;
const HISTORY_MAX_ITEMS = 99;
const HISTORY_CLEANUP_STATUSES = ["returned", "rejected", "cancelled"];

function generateRequestCode() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EQ-${today}-${suffix}`;
}

async function cleanupStudentEquipmentHistory(studentId: string) {
  const cutoff = new Date(Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await (supabase as any)
    .from("equipment_requests")
    .delete()
    .eq("student_id", studentId)
    .in("status", HISTORY_CLEANUP_STATUSES)
    .lt("created_at", cutoff);

  const { data: extraRows } = await (supabase as any)
    .from("equipment_requests")
    .select("id")
    .eq("student_id", studentId)
    .in("status", HISTORY_CLEANUP_STATUSES)
    .order("created_at", { ascending: false })
    .range(HISTORY_MAX_ITEMS, 1000);

  const extraIds = (extraRows ?? []).map((row: { id: string }) => row.id);
  if (extraIds.length > 0) {
    await (supabase as any)
      .from("equipment_requests")
      .delete()
      .in("id", extraIds);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equipment_item_id, student_id, requester_phone, quantity, purpose, borrow_date, due_date, delivery_mode, delivery_loc, time_slot } = body;
    const requestItems = Array.isArray(body.items)
      ? body.items.map((item: { equipment_item_id?: string; quantity?: number }) => ({
          equipment_item_id: item.equipment_item_id,
          quantity: Number(item.quantity),
        }))
      : [{ equipment_item_id, quantity: Number(quantity) }];

    const dueDateFinal = due_date || borrow_date;
    if (!student_id?.trim() || !borrow_date || requestItems.length === 0 || requestItems.some((item: { equipment_item_id?: string; quantity: number }) => !item.equipment_item_id || !item.quantity)) {
      return NextResponse.json({ status: "error", message: "กรุณาเข้าสู่ระบบและกรอกข้อมูลให้ครบ" }, { status: 400 });
    }
    if (requestItems.some((item: { quantity: number }) => item.quantity <= 0)) {
      return NextResponse.json({ status: "error", message: "จำนวนต้องมากกว่า 0" }, { status: 400 });
    }
    if (requestItems.some((item: { quantity: number }) => item.quantity > MAX_BORROW_QUANTITY)) {
      return NextResponse.json({ status: "error", message: `เบิกได้ไม่เกิน ${MAX_BORROW_QUANTITY} ชิ้นต่อคำขอ` }, { status: 400 });
    }
    const deliveryModeFinal: "pickup" | "delivery" = delivery_mode === "delivery" ? "delivery" : "pickup";
    if (deliveryModeFinal === "delivery" && !delivery_loc?.trim()) {
      return NextResponse.json({ status: "error", message: "กรุณาระบุสถานที่รับ-ส่ง" }, { status: 400 });
    }
    if (!time_slot?.trim()) {
      return NextResponse.json({ status: "error", message: "กรุณาเลือกช่วงเวลา" }, { status: 400 });
    }

    // ใช้ชื่อ-สาขาจากบัญชีที่ login จริง ไม่รับค่าจาก client เพื่อป้องกันการปลอมแปลง
    const { data: student, error: studentError } = await (supabase as any)
      .from("students")
      .select("student_id, first_name, last_name, department, student_phone, photo_url")
      .eq("student_id", student_id.trim())
      .maybeSingle();

    if (studentError) return NextResponse.json({ status: "error", message: studentError.message }, { status: 500 });
    if (!student) return NextResponse.json({ status: "error", message: "ไม่พบบัญชีนักเรียน กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
    if (!student.department?.trim()) {
      return NextResponse.json({ status: "error", message: "บัญชีนี้ยังไม่มีข้อมูลสาขาวิชา กรุณาแก้ไขข้อมูลส่วนตัวก่อน" }, { status: 400 });
    }

    const requester_name = `${student.first_name} ${student.last_name}`.trim();
    const department = student.department.trim();

    const itemIds = requestItems.map((item: { equipment_item_id: string }) => item.equipment_item_id);
    const { data: itemRows, error: itemError } = await supabase
      .from("equipment_items")
      .select("id, name, unit, active, deleted_at, available_quantity, image_url")
      .in("id", itemIds);

    if (itemError) return NextResponse.json({ status: "error", message: itemError.message }, { status: 500 });
    if (!itemRows || itemRows.length !== itemIds.length || itemRows.some(item => !item.active || item.deleted_at)) {
      return NextResponse.json({ status: "error", message: "ไม่พบคุรุภัณฑ์ที่เลือก" }, { status: 404 });
    }
    // หักของที่ติดซ่อมออกก่อนตรวจ ไม่งั้นจะอนุมัติให้ยืมของที่กำลังซ่อมอยู่
    // ดูเหตุผลที่ไม่ลด available_quantity ตรง ๆ ใน lib/server/maintenance-stock.ts
    const underRepair = await equipmentUnderRepair(supabase, itemIds);
    for (const requestItem of requestItems) {
      const item = itemRows.find(row => row.id === requestItem.equipment_item_id);
      if (!item) {
        return NextResponse.json({ status: "error", message: "ไม่พบคุรุภัณฑ์ที่เลือก" }, { status: 404 });
      }
      const repairing = underRepair[item.id] ?? 0;
      const usable = effectiveAvailable(item.available_quantity, repairing);
      if (requestItem.quantity > usable) {
        const reason = repairing > 0 ? ` (ติดซ่อมอยู่ ${repairing} ${item.unit ?? "ชิ้น"})` : "";
        return NextResponse.json({ status: "error", message: `คุรุภัณฑ์คงเหลือไม่พอ: ${item.name} เหลือ ${usable}${reason}` }, { status: 409 });
      }
    }

    const requester_phone_final = requester_phone?.trim() || student.student_phone || null;

    const request_code = generateRequestCode();
    const rows = requestItems.map((requestItem: { equipment_item_id: string; quantity: number }) => ({
      request_code,
      equipment_item_id: requestItem.equipment_item_id,
      student_id: student.student_id,
      department,
      requester_name,
      requester_phone: requester_phone_final,
      quantity: requestItem.quantity,
      purpose: purpose?.trim() || null,
      borrow_date,
      due_date: dueDateFinal,
      delivery_mode: deliveryModeFinal,
      delivery_loc: deliveryModeFinal === "delivery" ? delivery_loc.trim() : "คุรุภัณฑ์",
      time_slot: time_slot.trim(),
    }));

    const { data: created, error } = await supabase
      .from("equipment_requests")
      .insert(rows)
      .select("id");

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    const firstItem = itemRows[0];
    try {
      await sendLineFlexMessage(
        await getLineNotificationTarget(supabase as any, "equipment"),
        `🧰 คำขอเบิกคุรุภัณฑ์ใหม่: ${requestItems.length} รายการ — ${requester_name}`,
        buildEquipmentRequestFlexMessage({
          requestCode: request_code,
          itemName: requestItems.length > 1 ? `${firstItem.name} และอีก ${requestItems.length - 1} รายการ` : firstItem.name,
          itemImageUrl: firstItem.image_url,
          department,
          requesterName: requester_name,
          requesterPhotoUrl: student.photo_url,
          requesterPhone: requester_phone_final,
          quantity: requestItems.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0),
          unit: "ชิ้น",
          borrowDate: borrow_date,
          dueDate: dueDateFinal,
          purpose: purpose?.trim() || null,
          status: "pending",
        })
      );
    } catch (e) {
      console.error("[LINE] equipment request admin notify failed:", e);
    }

    return NextResponse.json({ status: "success", request_code, id: created?.[0]?.id });
  } catch (error) {
    console.error("[api/equipment/requests] post failed:", error);
    return NextResponse.json({ status: "error", message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("student_id")?.trim();
  if (!studentId) {
    return NextResponse.json({ status: "error", message: "ไม่พบรหัสนักเรียน" }, { status: 400 });
  }

  await cleanupStudentEquipmentHistory(studentId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("equipment_requests")
    .select("id, request_code, quantity, purpose, borrow_date, due_date, returned_at, delivery_mode, delivery_loc, time_slot, picked_up_at, status, admin_note, created_at, equipment_items(name, unit, category)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MAX_ITEMS);

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data: data ?? [] });
}
