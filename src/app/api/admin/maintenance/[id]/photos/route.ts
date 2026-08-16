import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";

/**
 * รูปหลักฐานการซ่อม 3 ระยะ
 *
 * การอัปโหลดไฟล์จริงอยู่ที่ /api/admin/uploads/maintenance-photos
 * ส่วน route นี้แค่ผูก URL ที่ได้เข้ากับงานซ่อมและระยะ แยกกันเพราะการอัปโหลด
 * เป็นเรื่องของที่เก็บไฟล์ ส่วนการผูกเป็นเรื่องของงานซ่อม และผู้ใช้ทั่วไป
 * อัปโหลดได้แต่ผูกกับงานคนอื่นไม่ได้
 */

const AddSchema = z.object({
  phase: z.enum(["before", "during", "after"]),
  image_url: z.string().trim().url("รูปแบบ URL ไม่ถูกต้อง"),
  caption: z.string().trim().nullable().optional(),
});

export const POST = withAuth<{ id: string }>(
  async (req, { params, principal }) => {
    const parsed = await parseBody(req, AddSchema);
    if (!parsed.ok) return parsed.response;

    const supabase = getServiceClient();

    // ยืนยันว่างานมีอยู่จริงก่อน ไม่งั้นจะได้รูปที่ผูกกับ id มั่ว ๆ
    // ซึ่ง FK จับได้อยู่แล้วแต่ error ที่ได้จะอ่านไม่รู้เรื่อง
    const { data: request } = await supabase
      .from("maintenance_requests")
      .select("id, status")
      .eq("id", params.id)
      .maybeSingle();

    if (!request) {
      return NextResponse.json({ status: "error", message: "ไม่พบงานซ่อมนี้" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("maintenance_photos")
      .insert({
        request_id: params.id,
        phase: parsed.data.phase,
        image_url: parsed.data.image_url,
        caption: parsed.data.caption ?? null,
        uploaded_by: principal.subjectId,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success", id: data.id }),
      audit: { entityId: params.id, after: { photo_id: data.id, phase: parsed.data.phase } },
    };
  },
  {
    permission: "maintenance.update",
    audit: { action: "maintenance.photo_add", entityType: "maintenance_request" },
  }
);

export const DELETE = withAuth<{ id: string }>(
  async (req, { params }) => {
    const photoId = new URL(req.url).searchParams.get("photo_id")?.trim();
    if (!photoId) {
      return NextResponse.json({ status: "error", message: "ต้องระบุ photo_id" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // ต้องเป็นรูปของงานนี้จริง กันการลบข้ามงานด้วยการเดา id
    const { data: before } = await supabase
      .from("maintenance_photos")
      .select("*")
      .eq("id", photoId)
      .eq("request_id", params.id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json(
        { status: "error", message: "ไม่พบรูปนี้ในงานซ่อมดังกล่าว" },
        { status: 404 }
      );
    }

    const { error } = await supabase.from("maintenance_photos").delete().eq("id", photoId);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    // ไม่ลบไฟล์ใน storage ที่นี่ — ถ้ารูปถูกอ้างซ้ำจากที่อื่นจะกลายเป็นลิงก์เสีย
    // การเก็บกวาดไฟล์กำพร้าเป็นงานแยกที่ควรทำเป็นรอบ ไม่ใช่ตอนกดลบ
    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: params.id, before },
    };
  },
  {
    permission: "maintenance.update",
    audit: { action: "maintenance.photo_delete", entityType: "maintenance_request" },
  }
);
