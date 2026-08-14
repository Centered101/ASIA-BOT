import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";

/**
 * รายการ "ของที่จะแจ้งซ่อม" สำหรับฟอร์มแจ้งซ่อม
 *
 * แยกจาก /api/admin/assets เพราะหน้านั้นต้องใช้สิทธิ์ asset.view ซึ่งนักเรียน
 * ไม่มี แต่นักเรียนต้องเลือกครุภัณฑ์ที่จะแจ้งได้ ไม่งั้นก็ต้องพิมพ์ชื่อเอง
 * ทุกครั้งทั้งที่ของชิ้นนั้นมีเลขติดอยู่
 *
 * คืนเฉพาะฟิลด์ที่ฟอร์มต้องใช้ ไม่รวมราคา ผู้รับผิดชอบ หรือแหล่งงบประมาณ
 * ซึ่งเป็นข้อมูลของฝ่ายพัสดุ ไม่ใช่ของคนแจ้งซ่อม
 */
export const GET = withAuth(
  async (req) => {
    const search = new URL(req.url).searchParams.get("q")?.trim();
    const supabase = getServiceClient();

    const [rooms, assets] = await Promise.all([
      supabase.from("rooms").select("id, name, location").order("name"),
      (() => {
        let q = supabase
          .from("assets")
          .select("id, name, asset_code, category, room_id, location_note")
          // ของที่จำหน่ายไปแล้วไม่ควรโผล่ในฟอร์มแจ้งซ่อม
          .is("disposed_at", null)
          .order("name")
          .limit(300);
        if (search) {
          q = q.or(`name.ilike.%${search}%,asset_code.ilike.%${search}%`);
        }
        return q;
      })(),
    ]);

    // ไม่กลืน error เป็นรายการว่าง ไม่งั้นฟอร์มจะดูเหมือนไม่มีครุภัณฑ์ในระบบ
    const partialErrors = [
      rooms.error ? `rooms: ${rooms.error.message}` : null,
      assets.error ? `assets: ${assets.error.message}` : null,
    ].filter(Boolean);

    return NextResponse.json({
      status: "success",
      ...(partialErrors.length ? { partial_errors: partialErrors } : {}),
      data: {
        rooms: rooms.data ?? [],
        assets: assets.data ?? [],
      },
    });
  },
  { permission: "maintenance.create" }
);
