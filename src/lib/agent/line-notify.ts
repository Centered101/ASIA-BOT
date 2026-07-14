import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "./types";
import {
  buildBookingFlexMessage,
  buildEquipmentRequestFlexMessage,
  buildFeedbackFlexMessage,
  buildOrderFlexMessage,
  sendLineFlexMessage,
  sendLineMessage,
} from "@/lib/line";
import { getLineNotificationTarget } from "@/lib/line-targets";

function studentName(ctx: UserContext) {
  return ctx.studentData
    ? `${ctx.studentData.first_name} ${ctx.studentData.last_name}`.trim()
    : ctx.displayName;
}

function studentId(ctx: UserContext) {
  return ctx.studentData?.student_id || ctx.userId;
}

export async function notifyAiBookingCreated(
  supabase: SupabaseClient,
  ctx: UserContext,
  params: {
    bookingId?: string | null;
    roomName: string;
    bookingDate: string;
    slotId: number;
    attendees?: number | null;
    purpose: string;
  },
) {
  try {
    const { data: slot } = await (supabase as any)
      .from("time_slots")
      .select("start_time, end_time")
      .eq("id", params.slotId)
      .maybeSingle();

    await sendLineFlexMessage(
      await getLineNotificationTarget(supabase, "booking"),
      `🤖 AI สร้างคำขอจองห้องใหม่ — ${studentName(ctx)} — ${params.roomName}`,
      buildBookingFlexMessage({
        bookingId: params.bookingId ?? null,
        roomName: params.roomName,
        studentName: studentName(ctx),
        studentId: studentId(ctx),
        studentPhotoUrl: ctx.studentData?.photo_url ?? null,
        nickname: ctx.studentData?.nickname ?? null,
        program: ctx.studentData?.program ?? null,
        department: ctx.studentData?.department ?? null,
        bookingDate: params.bookingDate,
        startTime: slot?.start_time ?? "",
        endTime: slot?.end_time ?? "",
        attendees: params.attendees ?? 1,
        purpose: `[AI] ${params.purpose}`,
        status: "pending",
        sourceLabel: "ทำงานผ่าน AI",
      }),
    );
  } catch (e) {
    console.error("[LINE] AI booking notify failed:", e);
  }
}

export async function notifyAiOrderCreated(
  supabase: SupabaseClient,
  ctx: UserContext,
  params: {
    orderId: string;
    items: { name: string; qty: number; price: number; unit?: string | null; imageUrl?: string | null }[];
    total: number;
    deliveryMode: string;
  },
) {
  try {
    await sendLineFlexMessage(
      await getLineNotificationTarget(supabase, "order"),
      `🤖 AI สร้างออเดอร์สหกรณ์ใหม่ #${params.orderId.slice(-8).toUpperCase()} — ${studentName(ctx)}`,
      buildOrderFlexMessage({
        orderId: params.orderId,
        studentName: studentName(ctx),
        studentId: studentId(ctx),
        studentPhotoUrl: ctx.studentData?.photo_url ?? null,
        items: params.items.map(item => ({
          name: item.name,
          qty: item.qty,
          price: item.price,
          unit: item.unit || "ชิ้น",
          imageUrl: item.imageUrl ?? null,
        })),
        total: params.total,
        deliveryMode: params.deliveryMode,
        status: "pending",
        sourceLabel: "ทำงานผ่าน AI",
      }),
    );
  } catch (e) {
    console.error("[LINE] AI order notify failed:", e);
  }
}

export async function notifyAiFeedbackSubmitted(
  supabase: SupabaseClient,
  ctx: UserContext,
  params: {
    feedbackId?: string | null;
    type: "comment" | "report";
    category?: string | null;
    message: string;
  },
) {
  try {
    const typeLabel = params.type === "comment" ? "ความคิดเห็น" : "รายงานปัญหา";
    await sendLineFlexMessage(
      await getLineNotificationTarget(supabase, "feedback"),
      `🤖 AI ส่ง${typeLabel}ใหม่ — ${studentName(ctx)}`,
      buildFeedbackFlexMessage({
        feedbackId: params.feedbackId ?? "unknown",
        type: params.type,
        name: studentName(ctx),
        studentId: studentId(ctx),
        studentPhotoUrl: ctx.studentData?.photo_url ?? null,
        category: params.category ?? "AI Assistant",
        message: `[AI] ${params.message}`,
        sourceLabel: "ทำงานผ่าน AI",
      }),
    );
  } catch (e) {
    console.error("[LINE] AI feedback notify failed:", e);
  }
}

export async function notifyAiEquipmentRequestCreated(
  supabase: SupabaseClient,
  ctx: UserContext,
  params: {
    requestCode: string;
    itemName: string;
    itemImageUrl?: string | null;
    quantity: number;
    unit?: string | null;
    borrowDate: string;
    dueDate: string;
    purpose?: string | null;
    requesterPhone?: string | null;
    department?: string | null;
  },
) {
  try {
    await sendLineFlexMessage(
      await getLineNotificationTarget(supabase, "equipment"),
      `🤖 AI สร้างคำขอเบิกคุรุภัณฑ์ใหม่ ${params.requestCode} — ${studentName(ctx)}`,
      buildEquipmentRequestFlexMessage({
        requestCode: params.requestCode,
        itemName: params.itemName,
        itemImageUrl: params.itemImageUrl ?? null,
        department: params.department ?? ctx.studentData?.department ?? "ไม่ระบุสาขา",
        requesterName: studentName(ctx),
        requesterPhotoUrl: ctx.studentData?.photo_url ?? null,
        requesterPhone: params.requesterPhone ?? null,
        quantity: params.quantity,
        unit: params.unit || "ชิ้น",
        borrowDate: params.borrowDate,
        dueDate: params.dueDate,
        purpose: params.purpose ? `[AI] ${params.purpose}` : "สร้างคำขอผ่าน AI",
        status: "pending",
        sourceLabel: "ทำงานผ่าน AI",
      }),
    );
  } catch (e) {
    console.error("[LINE] AI equipment notify failed:", e);
  }
}

export async function notifyAiRuntimeIssue(
  supabase: SupabaseClient,
  ctx: Pick<UserContext, "channel" | "role" | "userId" | "displayName">,
  message: string,
) {
  try {
    const target = await getLineNotificationTarget(supabase, "admin");
    await sendLineMessage(
      target,
      [
        "🤖 ASIA-BOT AI มีปัญหาพิเศษ",
        `ผู้ใช้: ${ctx.displayName || ctx.userId}`,
        `บทบาท: ${ctx.role}`,
        `ช่องทาง: ${ctx.channel}`,
        `รายละเอียด: ${message}`,
      ].join("\n"),
    );
  } catch (e) {
    console.error("[LINE] AI runtime notify failed:", e);
  }
}
