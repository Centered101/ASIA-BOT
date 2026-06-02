import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildBookingFlexMessage, buildFeedbackFlexMessage, buildOrderFlexMessage, buildRfidScanFlexMessage, buildStudentDataChangeFlexMessage } from "@/lib/line";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type LineMessage = Record<string, unknown>;
type TestMode = "order_flex" | "feedback_flex" | "attendance_flex" | "booking_flex" | "data_change_flex" | "custom_json";
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

async function buildStudentAttendanceMessage(
  studentId?: string | null,
  tester?: { name: string; adminId: string; role: string; avatar: string | null },
): Promise<{ altText: string; contents: object; studentLabel: string }> {
  let student = null as null | {
    student_id: string;
    first_name: string;
    last_name: string;
    nickname: string | null;
    program: string;
    department: string | null;
    photo_url: string | null;
    uid: string | null;
  };

  if (studentId?.trim()) {
    const { data, error } = await supabase
      .from("students")
      .select("student_id,first_name,last_name,nickname,program,department,photo_url,uid")
      .eq("student_id", studentId.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    student = data;
  }

  const fullName = student ? `${student.first_name} ${student.last_name}`.trim() : tester?.name || "ทดสอบ ระบบ";
  const sid = student?.student_id ?? tester?.adminId ?? "9999";
  const nicknameText = student?.nickname ? ` (${student.nickname})` : "";
  const contents = buildRfidScanFlexMessage({
    action: "checkin",
    studentName: fullName,
    studentId: sid,
    nickname: student?.nickname ?? "ทดสอบ",
    program: student?.program ?? tester?.role ?? "admin",
    department: student?.department ?? "555 ASIA-BOT Test",
    studentPhotoUrl: student?.photo_url ?? tester?.avatar ?? null,
    location: "school",
    locationLabel: "โรงเรียน",
    uid: student?.uid ?? `${sid}-TESTLINE`,
    scannedAt: new Date().toISOString(),
  });

  return {
    altText: `แจ้งเตือนเข้าโรงเรียน ${fullName}${nicknameText} รหัส ${sid}`,
    contents,
    studentLabel: `${fullName}${nicknameText} (${sid})`,
  };
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
  const fallbackGroupId = process.env.LINE_GROUP_ADMIN;
  const targetId = String(body.to || "").trim() || fallbackGroupId;
  if (!targetId) return NextResponse.json({ status: "error", message: "LINE target not set" }, { status: 500 });

  const mode = (body.mode || "order_flex") as TestMode;
  const altText = String(body.altText || "🔔 ASIA-BOT LINE test");
  const messages: LineMessage[] = [];
  let studentLabel = "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-lb.vercel.app";
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

    if (mode === "attendance_flex") {
      const built = await buildStudentAttendanceMessage(String(body.student_id || ""), {
        name: adminName,
        adminId: admin.admin_id,
        role: admin.role,
        avatar: testerPhotoUrl,
      });
      studentLabel = built.studentLabel;
      messages.push({ type: "flex", altText: `${built.altText} · ทดสอบโดย ${adminName}`, contents: built.contents });
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
