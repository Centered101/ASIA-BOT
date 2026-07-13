import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ActivityRow = {
  type: "shop" | "booking" | "equipment" | "feedback";
  title: string;
  status: string;
  created_at: string;
};

function countByStatus(rows: { status: string | null }[], groups: Record<string, string[]>) {
  return Object.entries(groups).map(([label, statuses]) => ({
    label,
    value: rows.filter(row => statuses.includes(String(row.status ?? ""))).length,
  }));
}

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get("student_id")?.trim();
  if (!studentId) {
    return NextResponse.json({ status: "error", message: "ไม่พบรหัสนักเรียน" }, { status: 400 });
  }

  try {
    const [ordersRes, bookingsRes, equipmentRes, feedbackRes] = await Promise.all([
      supabase
        .from("orders")
        .select("order_id, total, status, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("bookings")
        .select("id, booking_date, purpose, status, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("equipment_requests")
        .select("id, request_code, quantity, status, created_at, equipment_items(name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("feedback")
        .select("id, category, type, status, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const errors = [ordersRes.error, bookingsRes.error, equipmentRes.error, feedbackRes.error].filter(Boolean);
    if (errors.length) {
      console.error("[api/student/activity]", errors.map(error => error?.message).join("; "));
      return NextResponse.json({ status: "success", data: emptyActivity() });
    }

    const orders = ordersRes.data ?? [];
    const bookings = bookingsRes.data ?? [];
    const equipment = (equipmentRes.data ?? []) as {
      id: string;
      request_code: string;
      quantity: number | null;
      status: string;
      created_at: string;
      equipment_items?: { name?: string | null } | { name?: string | null }[] | null;
    }[];
    const feedback = feedbackRes.data ?? [];

    const recent: ActivityRow[] = [
      ...orders.map(row => ({
        type: "shop" as const,
        title: `สหกรณ์ ${row.order_id}`,
        status: row.status,
        created_at: row.created_at,
      })),
      ...bookings.map(row => ({
        type: "booking" as const,
        title: row.purpose || `จองห้อง ${row.booking_date}`,
        status: row.status,
        created_at: row.created_at,
      })),
      ...equipment.map(row => {
        const item = Array.isArray(row.equipment_items) ? row.equipment_items[0] : row.equipment_items;
        return {
          type: "equipment" as const,
          title: item?.name ? `เบิก ${item.name}` : `เบิกคุรุภัณฑ์ ${row.request_code}`,
          status: row.status,
          created_at: row.created_at,
        };
      }),
      ...feedback.map(row => ({
        type: "feedback" as const,
        title: row.category || (row.type === "report" ? "รายงานปัญหา" : "ความคิดเห็น"),
        status: row.status,
        created_at: row.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

    const statusRows = [
      ...countByStatus(orders, {
        "รอชำระ/รอรับ": ["pending"],
        "สำเร็จ": ["paid"],
        "ยกเลิก": ["cancelled", "refunded"],
      }),
      ...countByStatus(bookings, {
        "รออนุมัติ": ["pending"],
        "อนุมัติแล้ว": ["approved"],
        "ไม่ผ่าน": ["rejected", "cancelled"],
      }),
      ...countByStatus(equipment, {
        "รอเบิก": ["pending"],
        "กำลังใช้งาน": ["approved", "picked_up"],
        "คืนแล้ว": ["returned"],
        "ไม่ผ่าน": ["rejected", "cancelled"],
      }),
      ...countByStatus(feedback, {
        "รับเรื่อง": ["pending"],
        "กำลังดำเนินการ": ["in_progress"],
        "เสร็จแล้ว": ["resolved"],
      }),
    ];

    const statusMap = new Map<string, number>();
    for (const item of statusRows) {
      statusMap.set(item.label, (statusMap.get(item.label) ?? 0) + item.value);
    }

    const paidOrders = orders.filter(row => row.status === "paid");
    const totalSpent = paidOrders.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
    const borrowedQuantity = equipment.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);

    return NextResponse.json({
      status: "success",
      data: {
        activity: [
          { label: "ซื้อสหกรณ์", value: orders.length },
          { label: "จองห้อง", value: bookings.length },
          { label: "เบิกคุรุภัณฑ์", value: equipment.length },
          { label: "ส่งเรื่อง", value: feedback.length },
        ],
        statusBreakdown: Array.from(statusMap, ([label, value]) => ({ label, value })).filter(item => item.value > 0),
        summary: {
          totalSpent,
          paidOrders: paidOrders.length,
          borrowedQuantity,
          activeRequests: equipment.filter(row => ["pending", "approved", "picked_up"].includes(row.status)).length,
        },
        recent,
      },
    });
  } catch (error) {
    console.error("[api/student/activity] failed:", error);
    return NextResponse.json({ status: "success", data: emptyActivity() });
  }
}

function emptyActivity() {
  return {
    activity: [
      { label: "ซื้อสหกรณ์", value: 0 },
      { label: "จองห้อง", value: 0 },
      { label: "เบิกคุรุภัณฑ์", value: 0 },
      { label: "ส่งเรื่อง", value: 0 },
    ],
    statusBreakdown: [],
    summary: { totalSpent: 0, paidOrders: 0, borrowedQuantity: 0, activeRequests: 0 },
    recent: [],
  };
}
