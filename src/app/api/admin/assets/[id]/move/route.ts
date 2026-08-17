import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import type { Database } from "@/types/database";

type AssetUpdate = Database["public"]["Tables"]["assets"]["Update"];
type MovementInsert = Database["public"]["Tables"]["asset_movements"]["Insert"];

/**
 * ย้ายครุภัณฑ์ / เปลี่ยนผู้รับผิดชอบ
 *
 * ทางเดียวที่แก้ room_id, location_note และ responsible_person ได้ เพราะทุกครั้ง
 * ต้องเขียน asset_movements ไปพร้อมกัน ถ้าแยกให้ PATCH แก้ได้ด้วยจะเกิดกรณี
 * "ของย้ายไปแล้วแต่ไม่มีประวัติ" ซึ่งทำให้ตรวจสอบพัสดุไม่ได้ว่าใครย้ายและย้ายเมื่อไหร่
 *
 * ค่า from_* อ่านจากแถวปัจจุบันเสมอ ไม่รับจาก client เพราะ client อาจถือข้อมูลเก่า
 * แล้วเขียนประวัติที่ไม่ตรงกับความจริง
 */

const MoveSchema = z
  .object({
    to_room_id: z.string().uuid().nullable().optional(),
    to_location: z.string().trim().nullable().optional(),
    to_person: z.string().trim().nullable().optional(),
    moved_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD").optional(),
    reason: z.string().trim().nullable().optional(),
  })
  .refine(
    (v) => v.to_room_id !== undefined || v.to_location !== undefined || v.to_person !== undefined,
    { message: "ต้องระบุอย่างน้อยหนึ่งอย่าง: ห้อง จุดวาง หรือผู้รับผิดชอบ" }
  );

export const POST = withAuth<{ id: string }>(
  async (req, { principal, params }) => {
    const parsed = await parseBody(req, MoveSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const supabase = getServiceClient();
    const { data: asset } = await supabase
      .from("assets")
      .select("id, name, room_id, location_note, responsible_person, disposed_at")
      .eq("id", params.id)
      .maybeSingle();

    if (!asset) {
      return NextResponse.json({ status: "error", message: "ไม่พบครุภัณฑ์นี้" }, { status: 404 });
    }
    if (asset.disposed_at) {
      return NextResponse.json(
        { status: "error", message: "ครุภัณฑ์ที่จำหน่ายแล้วย้ายไม่ได้" },
        { status: 409 }
      );
    }

    // คีย์ที่ไม่ส่งมา = ไม่เปลี่ยน จึงยึดค่าเดิมไว้ ไม่ใช่ล้างเป็น null
    const toRoomId = body.to_room_id !== undefined ? body.to_room_id : asset.room_id;
    const toLocation = body.to_location !== undefined ? body.to_location : asset.location_note;
    const toPerson = body.to_person !== undefined ? body.to_person : asset.responsible_person;

    // ห้องปลายทางต้องมีจริง ไม่งั้นประวัติจะชี้ไปยังห้องที่ไม่มีอยู่
    if (toRoomId && toRoomId !== asset.room_id) {
      const { data: room } = await supabase.from("rooms").select("id").eq("id", toRoomId).maybeSingle();
      if (!room) {
        return NextResponse.json({ status: "error", message: "ไม่พบห้องปลายทาง" }, { status: 404 });
      }
    }

    // กดย้ายโดยไม่เปลี่ยนอะไรเลยจะได้ประวัติแถวเปล่า ซึ่งทำให้ไทม์ไลน์อ่านยาก
    // และดูเหมือนของถูกย้ายบ่อยกว่าความจริง
    const unchanged =
      toRoomId === asset.room_id &&
      toLocation === asset.location_note &&
      toPerson === asset.responsible_person;

    if (unchanged) {
      return NextResponse.json(
        { status: "error", message: "ไม่มีอะไรเปลี่ยน จึงไม่บันทึกเป็นการย้าย" },
        { status: 400 }
      );
    }

    const movement: MovementInsert = {
      asset_id: params.id,
      from_room_id: asset.room_id,
      to_room_id: toRoomId,
      from_location: asset.location_note,
      to_location: toLocation,
      from_person: asset.responsible_person,
      to_person: toPerson,
      moved_on: body.moved_on ?? new Date().toISOString().slice(0, 10),
      reason: body.reason ?? null,
      recorded_by: principal.subjectId,
    };

    // เขียนประวัติก่อน แล้วค่อยอัปเดตที่อยู่ปัจจุบัน
    // ถ้าสลับลำดับแล้วขั้นที่สองล้ม ของจะย้ายไปแล้วโดยไม่มีประวัติ
    // ซึ่งเป็นสภาพที่แย่กว่าประวัติที่มีแถวเกินหนึ่งแถว
    const { data: inserted, error: moveError } = await supabase
      .from("asset_movements")
      .insert(movement)
      .select("id")
      .single();

    if (moveError) {
      return NextResponse.json({ status: "error", message: moveError.message }, { status: 500 });
    }

    const update: AssetUpdate = {
      room_id: toRoomId,
      location_note: toLocation,
      responsible_person: toPerson,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("assets").update(update).eq("id", params.id);
    if (error) {
      // ประวัติเขียนไปแล้วแต่ที่อยู่ไม่เปลี่ยน — บอกตรง ๆ ว่าไม่สมบูรณ์
      // ไม่ลบประวัติทิ้ง เพราะตารางเป็น append-only ตามที่ออกแบบไว้
      return NextResponse.json(
        {
          status: "error",
          message: `บันทึกประวัติแล้ว (${inserted.id}) แต่อัปเดตที่อยู่ไม่สำเร็จ: ${error.message}`,
        },
        { status: 500 }
      );
    }

    return {
      response: NextResponse.json({ status: "success", message: "บันทึกการย้ายแล้ว" }),
      audit: { entityId: params.id, before: asset, after: movement },
    };
  },
  {
    permission: "asset.manage",
    audit: { action: "asset.move", entityType: "asset" },
  }
);
