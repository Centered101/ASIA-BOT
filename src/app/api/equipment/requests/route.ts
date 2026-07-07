import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildEquipmentRequestFlexMessage, sendLineFlexMessage } from "@/lib/line";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_BORROW_QUANTITY = 6;

function generateRequestCode() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EQ-${today}-${suffix}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equipment_item_id, student_id, requester_phone, quantity, purpose, borrow_date, due_date, delivery_mode, delivery_loc, time_slot } = body;

    if (!equipment_item_id || !student_id?.trim() || !quantity || !borrow_date || !due_date) {
      return NextResponse.json({ status: "error", message: "กรุณาเข้าสู่ระบบและกรอกข้อมูลให้ครบ" }, { status: 400 });
    }
    if (Number(quantity) <= 0) {
      return NextResponse.json({ status: "error", message: "จำนวนต้องมากกว่า 0" }, { status: 400 });
    }
    if (Number(quantity) > MAX_BORROW_QUANTITY) {
      return NextResponse.json({ status: "error", message: `เบิกได้ไม่เกิน ${MAX_BORROW_QUANTITY} ชิ้นต่อคำขอ` }, { status: 400 });
    }
    if (borrow_date > due_date) {
      return NextResponse.json({ status: "error", message: "วันที่คืนต้องไม่ก่อนวันที่ยืม" }, { status: 400 });
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

    const { data: item, error: itemError } = await supabase
      .from("equipment_items")
      .select("id, name, unit, active, deleted_at, available_quantity, image_url")
      .eq("id", equipment_item_id)
      .maybeSingle();

    if (itemError) return NextResponse.json({ status: "error", message: itemError.message }, { status: 500 });
    if (!item || !item.active || item.deleted_at) {
      return NextResponse.json({ status: "error", message: "ไม่พบคุรุภัณฑ์ที่เลือก" }, { status: 404 });
    }
    if (Number(quantity) > item.available_quantity) {
      return NextResponse.json({ status: "error", message: `คุรุภัณฑ์คงเหลือไม่พอ (เหลือ ${item.available_quantity} ${item.unit})` }, { status: 409 });
    }

    const requester_phone_final = requester_phone?.trim() || student.student_phone || null;

    const request_code = generateRequestCode();
    const { data: created, error } = await supabase
      .from("equipment_requests")
      .insert({
        request_code,
        equipment_item_id,
        student_id: student.student_id,
        department,
        requester_name,
        requester_phone: requester_phone_final,
        quantity: Number(quantity),
        purpose: purpose?.trim() || null,
        borrow_date,
        due_date,
        delivery_mode: deliveryModeFinal,
        delivery_loc: deliveryModeFinal === "delivery" ? delivery_loc.trim() : "คุรุภัณฑ์",
        time_slot: time_slot.trim(),
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    try {
      await sendLineFlexMessage(
        process.env.LINE_GROUP_ADMIN ?? "",
        `🧰 คำขอเบิกคุรุภัณฑ์ใหม่: ${item.name} — ${requester_name}`,
        buildEquipmentRequestFlexMessage({
          requestCode: request_code,
          itemName: item.name,
          itemImageUrl: item.image_url,
          department,
          requesterName: requester_name,
          requesterPhotoUrl: student.photo_url,
          requesterPhone: requester_phone_final,
          quantity: Number(quantity),
          unit: item.unit,
          borrowDate: borrow_date,
          dueDate: due_date,
          purpose: purpose?.trim() || null,
          status: "pending",
        })
      );
    } catch (e) {
      console.error("[LINE] equipment request admin notify failed:", e);
    }

    return NextResponse.json({ status: "success", request_code, id: created?.id });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("equipment_requests")
    .select("id, request_code, quantity, purpose, borrow_date, due_date, returned_at, delivery_mode, delivery_loc, time_slot, picked_up_at, status, admin_note, created_at, equipment_items(name, unit, category)")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data: data ?? [] });
}
