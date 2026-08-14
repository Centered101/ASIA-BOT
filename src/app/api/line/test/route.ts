import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildBookingFlexMessage, buildEquipmentRequestFlexMessage, buildFeedbackFlexMessage, buildOrderFlexMessage, buildStudentDataChangeFlexMessage } from "@/lib/line";
import { checkAdminAuth } from "@/lib/admin-auth";
import { getLineNotificationTarget } from "@/lib/line-targets";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type LineMessage = Record<string, unknown>;
type TestMode = "order_flex" | "feedback_flex" | "booking_flex" | "data_change_flex" | "equipment_flex" | "custom_json";
const lineTestCooldowns = new Map<string, number>();
const LINE_TEST_COOLDOWN_MS = 15_000;

async function pushLineMessage(to: string, messages: LineMessage[]) {
  const token = process.env.LINE_TOKEN;
  if (!token) return { ok: false, status: 500, body: "LINE_TOKEN not set" };
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages }),
  }).catch(err => ({ ok: false, status: 0, text: async () => String(err) } as Response));
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

function customMessagesFromPayload(payload: unknown, altText: string): LineMessage[] {
  if (!payload || typeof payload !== "object") throw new Error("JSON ต้องเป็น object");
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.messages)) return obj.messages as LineMessage[];
  if (obj.type === "flex" || obj.type === "text" || obj.type === "image") return [obj];
  if (obj.type === "bubble" || obj.type === "carousel") return [{ type: "flex", altText, contents: obj }];
  if (obj.contents && typeof obj.contents === "object") return [{ type: "flex", altText, contents: obj.contents }];
  throw new Error("JSON ต้องเป็น LINE message, { messages: [...] }, หรือ Flex contents");
}

function absoluteAssetUrl(url: string | null | undefined, siteUrl: string) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

export async function GET() {
  const token = process.env.LINE_TOKEN
  const groupAdmin = process.env.LINE_GROUP_ADMIN

  if (!token) return NextResponse.json({ error: 'LINE_TOKEN not set' }, { status: 500 })

  const [botRes, groupRes] = await Promise.all([
    fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
    }),
    groupAdmin
      ? fetch(`https://api.line.me/v2/bot/group/${groupAdmin}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      : Promise.resolve(null),
  ])

  const botBody  = await botRes.text()
  const groupBody = groupRes ? await groupRes.text() : null

  return NextResponse.json({
    token_prefix:    token.slice(0, 20) + '...',
    bot_info:        { status: botRes.status,           ok: botRes.ok,           body: JSON.parse(botBody) },
    group_admin:     { id: groupAdmin ?? '(not set)',   status: groupRes?.status ?? null, ok: groupRes?.ok ?? null, body: groupBody ? JSON.parse(groupBody) : null },
  })
}

export async function POST(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });
  const adminName = [admin.first_name, admin.last_name].filter(Boolean).join(" ") || admin.admin_id || "Admin";
  const cooldownKey = `${admin.admin_id}:${req.headers.get("x-forwarded-for") ?? "local"}`;
  const nowMs = Date.now();
  const lastSentAt = lineTestCooldowns.get(cooldownKey) ?? 0;
  const remainingMs = LINE_TEST_COOLDOWN_MS - (nowMs - lastSentAt);
  if (remainingMs > 0) {
    return NextResponse.json({
      status: "error",
      message: `กรุณารอ ${Math.ceil(remainingMs / 1000)} วินาทีก่อนส่ง LINE test อีกครั้ง`,
      cooldown_seconds: Math.ceil(remainingMs / 1000),
      admin: adminName,
    }, { status: 429 });
  }

  const token = process.env.LINE_TOKEN;
  if (!token) return NextResponse.json({ status: "error", message: "LINE_TOKEN not set" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const fallbackGroupId = await getLineNotificationTarget(supabase as any, "admin");
  const targetId = String(body.to || "").trim() || fallbackGroupId;
  if (!targetId) return NextResponse.json({ status: "error", message: "LINE target not set" }, { status: 500 });

  const mode = (body.mode || "order_flex") as TestMode;
  const altText = String(body.altText || "🔔 ASIA-BOT LINE test");
  const messages: LineMessage[] = [];
  const studentLabel = "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";
  const testerPhotoUrl = absoluteAssetUrl(admin.avatar, siteUrl) || `${siteUrl.replace(/\/$/, "")}/admin/favicon.ico`;
  const dummyProductImage = "https://dummyimage.com/240x240/eaf7ff/0f172a.png&text=240x240";
  const dummyFeedbackImage = "https://dummyimage.com/1000x450/84d4fa/0f172a.png&text=1000x450+-+20:9";

  try {
    if (mode === "order_flex") {
      const flexContents = buildOrderFlexMessage({
        orderId: "test-order-id-12345678",
        studentName: adminName,
        studentId: admin.admin_id,
        studentPhotoUrl: testerPhotoUrl,
        items: [{ name: "ขนมปัง", qty: 2, price: 15, unit: "ชิ้น", imageUrl: dummyProductImage }],
        total: 30,
        deliveryMode: "pickup",
        status: "pending",
      });
      messages.push({ type: "flex", altText: "🔔 LINE test — order flex", contents: flexContents });
    }

    if (mode === "feedback_flex") {
      messages.push({
        type: "flex",
        altText: "📝 LINE test — feedback flex",
        contents: buildFeedbackFlexMessage({
          feedbackId: "test-feedback",
          type: "report",
          name: adminName,
          studentId: admin.admin_id,
          studentPhotoUrl: testerPhotoUrl,
          category: "ทดสอบระบบ",
          message: `นี่คือ Feedback Flex สำหรับแจ้งเตือนแอดมิน\nส่งทดสอบโดย: ${adminName}`,
          imageUrls: [dummyFeedbackImage],
        }),
      });
    }

    if (mode === "booking_flex") {
      messages.push({
        type: "flex",
        altText: "📅 LINE test — booking flex",
        contents: buildBookingFlexMessage({
          bookingId: "test-booking",
          roomName: "ห้องประชุม",
          studentName: adminName,
          studentId: admin.admin_id,
          studentPhotoUrl: testerPhotoUrl,
          nickname: "เทสต์",
          program: admin.role,
          department: "555 ASIA-BOT Test",
          bookingDate: new Date().toISOString().slice(0, 10),
          startTime: "10:15:00",
          endTime: "12:15:00",
          attendees: 3,
          phone: "08x-xxx-xxxx",
          purpose: `ทดสอบรูปแบบแจ้งเตือนการจองห้อง\nส่งทดสอบโดย: ${adminName}`,
          status: "pending",
        }),
      });
    }

    if (mode === "data_change_flex") {
      messages.push({
        type: "flex",
        altText: "📝 LINE test — student data change flex",
        contents: buildStudentDataChangeFlexMessage({
          studentId: admin.admin_id,
          studentName: adminName,
          studentPhotoUrl: testerPhotoUrl,
          nickname: "เทสต์",
          program: admin.role,
          department: "555 ASIA-BOT Test",
          changes: [
            { label: "ชื่อ-นามสกุล", oldValue: "ชื่อเดิม นามสกุลเดิม", newValue: "ชื่อใหม่ นามสกุลใหม่" },
            { label: "แผนก/สาขา", oldValue: "คอมพิวเตอร์", newValue: "เทคโนโลยี" },
            { label: "หมายเหตุ", oldValue: null, newValue: `ส่งทดสอบโดย: ${adminName}` },
          ],
        }),
      });
    }

    if (mode === "equipment_flex") {
      messages.push({
        type: "flex",
        altText: "🧰 LINE test — equipment flex",
        contents: buildEquipmentRequestFlexMessage({
          requestCode: "test-equipment",
          itemName: "โปรเจกเตอร์",
          itemImageUrl: dummyProductImage,
          department: "555 ASIA-BOT Test",
          requesterName: adminName,
          requesterPhotoUrl: testerPhotoUrl,
          requesterPhone: "08x-xxx-xxxx",
          quantity: 1,
          unit: "เครื่อง",
          borrowDate: new Date().toISOString().slice(0, 10),
          dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
          purpose: `ทดสอบรูปแบบแจ้งเตือนคำขอยืม-คืนคุรุภัณฑ์\nส่งทดสอบโดย: ${adminName}`,
          status: "pending",
        }),
      });
    }

    if (mode === "custom_json") {
      messages.push(...customMessagesFromPayload(body.payload, altText));
    }
  } catch (err) {
    return NextResponse.json({ status: "error", message: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  if (messages.length === 0) return NextResponse.json({ status: "error", message: "ไม่มีข้อความสำหรับส่ง" }, { status: 400 });
  if (messages.length > 5) return NextResponse.json({ status: "error", message: "LINE ส่งได้สูงสุด 5 messages ต่อครั้ง" }, { status: 400 });

  const result = await pushLineMessage(targetId, messages);
  if (!result.ok) {
    return NextResponse.json({
      status: "error",
      message: "LINE push failed",
      http_status: result.status,
      body: result.body,
      target_id: targetId,
    }, { status: result.status || 500 });
  }

  lineTestCooldowns.set(cooldownKey, Date.now());

  return NextResponse.json({
    status: "success",
    target_id: targetId,
    mode,
    sent_count: messages.length,
    student: studentLabel || null,
    admin: adminName,
    cooldown_seconds: LINE_TEST_COOLDOWN_MS / 1000,
  });
}
