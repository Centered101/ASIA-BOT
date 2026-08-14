import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { equipmentUnderRepair, effectiveAvailable } from "@/lib/server/maintenance-stock";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("equipment_items")
    .select("id, name, category, department, unit, available_quantity, image_url, description")
    .eq("active", true)
    .is("deleted_at", null)
    .order("category")
    .order("name");

  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  const items = data ?? [];

  // หักของที่ติดซ่อมออกจากยอดที่แสดง ไม่งั้นจะมีคนยืมของที่กำลังซ่อมอยู่
  // คำนวณแทนการลด available_quantity เพราะคอลัมน์นั้นมี flow อนุมัติเขียนอยู่แล้ว
  // ดูเหตุผลเต็มใน src/lib/server/maintenance-stock.ts
  const underRepair = await equipmentUnderRepair(
    supabase,
    items.map((i) => i.id)
  );

  return NextResponse.json({
    status: "success",
    data: items.map((item) => {
      const repairing = underRepair[item.id] ?? 0;
      return {
        ...item,
        // คงชื่อเดิมไว้เพื่อให้หน้าเว็บที่มีอยู่ไม่พัง แต่ค่าที่ได้หักของซ่อมแล้ว
        available_quantity: effectiveAvailable(item.available_quantity, repairing),
        // ส่งรายละเอียดไปด้วยเพื่อให้ UI บอกผู้ใช้ได้ว่าทำไมเหลือน้อยลง
        stock_total: item.available_quantity,
        under_repair: repairing,
      };
    }),
  });
}
