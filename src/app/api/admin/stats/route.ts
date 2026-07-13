import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Breakdown = { label: string; value: number };

function compactLabel(value: unknown, fallback = "ไม่ระบุ") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function countBy<T>(
  rows: T[] | null | undefined,
  getLabel: (row: T) => unknown,
  options?: { fallback?: string; limit?: number; labelMap?: Record<string, string> }
): Breakdown[] {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    const raw = compactLabel(getLabel(row), options?.fallback);
    const label = options?.labelMap?.[raw] ?? raw;
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, options?.limit ?? 8);
}

const bookingStatusLabel: Record<string, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  cancelled: "ยกเลิก",
};
const orderStatusLabel: Record<string, string> = {
  pending: "รอดำเนินการ",
  paid: "ชำระแล้ว",
  cancelled: "ยกเลิก",
  refunded: "คืนเงิน",
};
const equipmentStatusLabel: Record<string, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  picked_up: "รับแล้ว",
  returned: "คืนแล้ว",
  rejected: "ปฏิเสธ",
  cancelled: "ยกเลิก",
};
const teacherStatusLabel: Record<string, string> = {
  active: "ใช้งาน",
  inactive: "ไม่ใช้งาน",
  pending: "รอตรวจ",
  reviewing: "กำลังตรวจ",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
};
const dayLabel: Record<string, string> = {
  "1": "จันทร์",
  "2": "อังคาร",
  "3": "พุธ",
  "4": "พฤหัส",
  "5": "ศุกร์",
  "6": "เสาร์",
  "7": "อาทิตย์",
};

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    students,
    pendingBookings,
    totalBookings,
    feedbackTotal,
    feedbackPending,
    todayEntries,
    inactiveCards,
    lostCards,
    paidOrders,
    pendingOrders,
    pendingDataRequests,
    pendingNameRequests,
    lowStockProducts,
    pendingTeacherApps,
    pendingEquipmentRequests,
    studentRows,
    bookingRows,
    orderRows,
    equipmentRequestRows,
    teacherRows,
    projectRows,
    evaluationRows,
    classGroupRows,
    classScheduleRows,
    roomRows,
    productRows,
    equipmentItemRows,
  ] =
    await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase.from("feedback").select("id", { count: "exact", head: true }),
      supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("entry_logs").select("id", { count: "exact", head: true }).gte("scanned_at", todayStart.toISOString()),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("card_status", "inactive"),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("card_status", "lost"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      (supabase.from("change_requests") as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
      (supabase.from("name_change_requests") as any).select("id", { count: "exact", head: true }).eq("status", "pending"),
      (supabase.from("products") as any)
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .is("deleted_at", null)
        .lte("stock", 5),
      (supabase.from("teachers") as any)
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "reviewing"]),
      supabase.from("equipment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("students").select("student_id, program, department, entry_year, student_phone"),
      supabase.from("bookings").select("status, booking_date"),
      supabase.from("orders").select("status, total, created_at"),
      supabase.from("equipment_requests").select("status, department, delivery_mode, quantity"),
      (supabase.from("teachers") as any).select("status, department, subject"),
      supabase.from("projects").select("id, project_date, created_at"),
      supabase.from("evaluations").select("id, overall, creative, content, presentation, usability, project_id"),
      (supabase.from("class_groups") as any).select("program, grade, department"),
      (supabase.from("class_schedules") as any).select("day_of_week, room_name, subject, teacher, class_group_id"),
      supabase.from("rooms").select("status, capacity, location"),
      (supabase.from("products") as any).select("category, tag, stock, active"),
      supabase.from("equipment_items").select("category, department, total_quantity, available_quantity, active, deleted_at"),
    ]);

  const inactiveCardCount = inactiveCards.count ?? 0;
  const lostCardCount = lostCards.count ?? 0;
  const paidOrderCount = paidOrders.count ?? 0;
  const pendingOrderCount = pendingOrders.count ?? 0;
  const teacherData = (teacherRows as any).data ?? [];
  const projectData = projectRows.data ?? [];
  const evaluationData = evaluationRows.data ?? [];
  const classGroupData = (classGroupRows as any).data ?? [];
  const classScheduleData = (classScheduleRows as any).data ?? [];
  const roomData = roomRows.data ?? [];
  const productData = (productRows as any).data ?? [];
  const equipmentItemData = equipmentItemRows.data ?? [];
  const activeProducts = productData.filter((p: any) => p.active !== false);
  const activeEquipmentItems = equipmentItemData.filter((i: any) => i.active !== false && !i.deleted_at);
  const totalEquipmentQty = activeEquipmentItems.reduce((sum: number, item: any) => sum + (Number(item.total_quantity) || 0), 0);
  const availableEquipmentQty = activeEquipmentItems.reduce((sum: number, item: any) => sum + (Number(item.available_quantity) || 0), 0);
  const studentData = studentRows.data ?? [];
  const entryYears = studentData
    .map((row: any) => parseInt(String(row.entry_year ?? ""), 10))
    .filter((year: number) => Number.isFinite(year));
  const latestEntryYear = entryYears.length ? Math.max(...entryYears) : null;
  const oldNewByProgram = ["ปวช", "ปวส"].flatMap(program => ([
    {
      label: `${program} ใหม่`,
      value: studentData.filter((row: any) => row.program === program && latestEntryYear !== null && Number(row.entry_year) === latestEntryYear).length,
    },
    {
      label: `${program} เก่า`,
      value: studentData.filter((row: any) => row.program === program && latestEntryYear !== null && Number(row.entry_year) < latestEntryYear).length,
    },
  ]));
  const averageEvaluation =
    evaluationData.length > 0
      ? Number((evaluationData.reduce((sum, row) => sum + (Number(row.overall) || 0), 0) / evaluationData.length).toFixed(2))
      : 0;

  return NextResponse.json({
    status: "success",
    data: {
      students: students.count ?? 0,
      pendingBookings: pendingBookings.count ?? 0,
      totalBookings: totalBookings.count ?? 0,
      feedbackTotal: feedbackTotal.count ?? 0,
      feedbackPending: feedbackPending.count ?? 0,
      todayEntries: todayEntries.count ?? 0,
      inactiveCards: inactiveCardCount,
      lostCards: lostCardCount,
      paidOrders: paidOrderCount,
      pendingOrders: pendingOrderCount,
      orderUpdates: paidOrderCount + pendingOrderCount,
      pendingDataRequests: (pendingDataRequests.count ?? 0) + (pendingNameRequests.count ?? 0),
      rfidIssues: inactiveCardCount + lostCardCount,
      lowStockProducts: lowStockProducts.count ?? 0,
      pendingTeacherApps: pendingTeacherApps.count ?? 0,
      pendingEquipmentRequests: pendingEquipmentRequests.count ?? 0,
      teacherTotal: teacherData.length,
      activeTeachers: teacherData.filter((t: any) => t.status === "active").length,
      projectTotal: projectData.length,
      evaluationTotal: evaluationData.length,
      averageEvaluation,
      classGroupTotal: classGroupData.length,
      scheduleTotal: classScheduleData.length,
      roomTotal: roomData.length,
      productTotal: activeProducts.length,
      equipmentItemTotal: activeEquipmentItems.length,
      totalEquipmentQty,
      availableEquipmentQty,
      breakdowns: {
        studentsOldNewByProgram: oldNewByProgram,
        studentsLatestEntryYear: latestEntryYear ? [{ label: String(latestEntryYear), value: latestEntryYear }] : [],
        studentsByProgram: countBy(studentData, (row) => row.program, { limit: 6 }),
        studentsByDepartment: countBy(studentData, (row) => row.department, { fallback: "ไม่ระบุสาขา", limit: 8 }),
        studentsByEntryYear: countBy(studentData, (row) => row.entry_year, { fallback: "ไม่ระบุปี", limit: 6 }),
        bookingsByStatus: countBy((bookingRows.data ?? []) as any[], (row) => row.status, { labelMap: bookingStatusLabel }),
        ordersByStatus: countBy((orderRows.data ?? []) as any[], (row) => row.status, { labelMap: orderStatusLabel }),
        equipmentRequestsByStatus: countBy((equipmentRequestRows.data ?? []) as any[], (row) => row.status, { labelMap: equipmentStatusLabel }),
        equipmentRequestsByDepartment: countBy((equipmentRequestRows.data ?? []) as any[], (row) => row.department, { fallback: "ไม่ระบุสาขา", limit: 8 }),
        teachersByStatus: countBy(teacherData, (row: any) => row.status, { labelMap: teacherStatusLabel }),
        teachersBySubject: countBy(teacherData, (row: any) => row.subject, { fallback: "ไม่ระบุวิชา", limit: 8 }),
        classGroupsByProgram: countBy(classGroupData, (row: any) => row.program, { fallback: "ไม่ระบุระดับ", limit: 6 }),
        schedulesByDay: countBy(classScheduleData, (row: any) => row.day_of_week, { labelMap: dayLabel, limit: 7 }),
        schedulesBySubject: countBy(classScheduleData, (row: any) => row.subject, { fallback: "ไม่ระบุวิชา", limit: 8 }),
        roomsByStatus: countBy(roomData, (row) => row.status, { fallback: "ไม่ระบุสถานะ", limit: 6 }),
        productsByCategory: countBy(activeProducts, (row: any) => row.category, { fallback: "ไม่ระบุหมวด", limit: 8 }),
        equipmentItemsByCategory: countBy(activeEquipmentItems, (row: any) => row.category, { fallback: "ไม่ระบุประเภท", limit: 8 }),
        evaluationsByScore: countBy(evaluationData, (row) => {
          const score = Number(row.overall) || 0;
          return score > 0 ? `${score} ดาว` : "ไม่ระบุคะแนน";
        }, { limit: 5 }),
      },
    },
  });
}
