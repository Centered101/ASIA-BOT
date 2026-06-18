import crypto from "crypto";

// ─── Push text ────────────────────────────────────────────────────────────────

export async function sendLineMessage(to: string, text: string): Promise<void> {
  const token = process.env.LINE_TOKEN;
  if (!token || !to) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  }).catch(() => {});
}

// ─── Push flex ────────────────────────────────────────────────────────────────

export async function sendLineFlexMessage(to: string, altText: string, contents: object): Promise<void> {
  const token = process.env.LINE_TOKEN;
  if (!token) { console.error("[LINE] LINE_TOKEN not set"); return; }
  if (!to)    { console.error("[LINE] recipient (to) is empty"); return; }
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: "flex", altText, contents }] }),
  }).catch(err => { console.error("[LINE] fetch error:", err); return null; });
  if (res && !res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[LINE] push failed ${res.status}:`, body);
  }
}

// ─── Reply ────────────────────────────────────────────────────────────────────

export async function replyLineMessage(replyToken: string, messages: object[]): Promise<void> {
  const token = process.env.LINE_TOKEN;
  if (!token || !replyToken) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages }),
  }).catch(() => {});
}

// ─── Signature verification ───────────────────────────────────────────────────

export function verifyLineSignature(body: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const digest = crypto.createHmac("sha256", secret).update(body).digest("base64");
  return digest === signature;
}

// ─── Order Flex Message builder ───────────────────────────────────────────────

type FlexOrderItem = {
  name: string;
  qty: number;
  price: number;
  unit: string;
  imageUrl?: string | null;
};

function buildLineFlexHeader(params: {
  title: string;
  subtitle: string;
  backgroundColor: string;
  photoUrl?: string | null;
  subtitleColor?: string;
}) {
  const { title, subtitle, backgroundColor, photoUrl, subtitleColor = "#000000" } = params;
  return {
    type: "box" as const,
    layout: "horizontal" as const,
    backgroundColor,
    paddingAll: "20px",
    alignItems: "center" as const,
    contents: [
      {
        type: "box" as const,
        layout: "vertical" as const,
        flex: 1,
        contents: [
          { type: "text" as const, text: title, color: "#000000", weight: "bold" as const, size: "lg" as const },
          { type: "text" as const, text: subtitle, color: subtitleColor, size: "sm" as const, margin: "sm" as const },
        ],
      },
      ...(photoUrl ? [{
        type: "box" as const,
        layout: "vertical" as const,
        width: "56px",
        height: "56px",
        cornerRadius: "8px",
        contents: [{
          type: "image" as const,
          url: photoUrl,
          size: "full" as const,
          aspectRatio: "1:1",
          aspectMode: "cover" as const,
        }],
      }] : []),
    ],
  };
}

export function buildOrderFlexMessage(params: {
  orderId: string;
  studentName: string;
  studentId?: string;
  studentPhotoUrl?: string | null;
  items: FlexOrderItem[];
  total: number;
  deliveryMode: string;
  deliveryLoc?: string | null;
  deliverySlot?: string | null;
  status?: "pending" | "paid" | "cancelled";
}) {
  const { orderId, studentName, studentId, studentPhotoUrl, items, total, deliveryMode, deliveryLoc, deliverySlot, status = "paid" } = params;
  const isPending = status === "pending";
  const isCancelled = status === "cancelled";
  const isDelivery = deliveryMode === "delivery";
  const deliveryText = isDelivery
    ? `🚚 จัดส่ง: ${deliveryLoc ?? ""} ช่วง ${deliverySlot ?? ""}`
    : "🏪 รับเองที่สหกรณ์";
  const now = new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz/shop";

  return {
    type: "bubble",
    size: "giga",
    header: buildLineFlexHeader({
      title: "สหกรณ์โรงเรียน ASIA-BOT",
      subtitle: now,
      backgroundColor: "#EC4899",
      photoUrl: studentPhotoUrl,
      subtitleColor: "#1E293B",
    }),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "20px",
      contents: [
        {
          type: "box" as const,
          layout: "horizontal" as const,
          width: isCancelled ? "90px" : isPending ? "120px" : "90px",
          backgroundColor: isCancelled ? "#EF4444" : isPending ? "#F59E0B" : "#22C55E",
          cornerRadius: "20px",
          paddingAll: "4px",
          contents: [{
            type: "text" as const,
            text: isCancelled ? "❌ ยกเลิก" : isPending ? "⏳ รอชำระเงิน" : "✅ ชำระแล้ว",
            color: "#FFFFFF",
            size: "xs" as const,
            align: "center" as const,
            weight: "bold" as const,
          }],
        },
        { type: "text", text: orderId, weight: "bold", size: "xl", color: "#0F172A" },
        {
          type: "box" as const,
          layout: "horizontal" as const,
          contents: [
            { type: "text" as const, text: "นักเรียน", size: "sm" as const, color: "#64748B", flex: 2 },
            {
              type: "text" as const,
              text: studentId ? `${studentName} (${studentId})` : studentName,
              size: "sm" as const,
              color: "#0F172A",
              weight: "bold" as const,
              align: "end" as const,
              flex: 3,
              wrap: true,
            },
          ],
        },
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          spacing: "md",
          contents: items.map(item => ({
            type: "box" as const,
            layout: "horizontal" as const,
            spacing: "md" as const,
            contents: [
              item.imageUrl
                ? {
                    type: "image" as const,
                    url: item.imageUrl,
                    size: "sm" as const,
                    aspectMode: "cover" as const,
                    aspectRatio: "1:1",
                    flex: 1,
                  }
                : {
                    type: "box" as const,
                    layout: "vertical" as const,
                    flex: 1,
                    justifyContent: "center" as const,
                    alignItems: "center" as const,
                    backgroundColor: "#F1F5F9",
                    cornerRadius: "8px",
                    contents: [{ type: "text" as const, text: "🛍️", size: "xl" as const }],
                  },
              {
                type: "box" as const,
                layout: "vertical" as const,
                flex: 3,
                justifyContent: "center" as const,
                contents: [
                  { type: "text" as const, text: `${item.name} x${item.qty}`, weight: "bold" as const, size: "sm" as const, color: "#0F172A", wrap: true },
                  { type: "text" as const, text: `${item.price.toLocaleString("th-TH")}฿ / ${item.unit}`, size: "xs" as const, color: "#64748B", margin: "sm" as const },
                  { type: "text" as const, text: `${(item.price * item.qty).toLocaleString("th-TH")}฿`, size: "md" as const, weight: "bold" as const, color: "#84D4FA", margin: "sm" as const },
                ],
              },
            ],
          })),
        },
        { type: "separator", margin: "lg" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "md",
          contents: (() => {
            const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
            const stripeFee = Math.ceil(subtotal * 0.02 * 100) / 100;
            const systemFee = Math.ceil(subtotal * 0.01 * 100) / 100;
            const feeRow = (label: string, amount: number) => ({
              type: "box" as const,
              layout: "horizontal" as const,
              contents: [
                { type: "text" as const, text: label, size: "xs" as const, color: "#64748B", flex: 1 },
                { type: "text" as const, text: `${amount.toLocaleString("th-TH")}฿`, size: "xs" as const, color: "#64748B", align: "end" as const },
              ],
            });
            return [
              feeRow("ยอดสินค้า", subtotal),
              feeRow("ค่าธรรมเนียม Stripe (2%)", stripeFee),
              feeRow("ค่าดำเนินการ (1%)", systemFee),
              { type: "separator" as const, margin: "sm" as const },
              {
                type: "box" as const,
                layout: "horizontal" as const,
                alignItems: "center" as const,
                contents: [
                  { type: "text" as const, text: "รวมทั้งหมด", weight: "bold" as const, size: "md" as const, flex: 1 },
                  { type: "text" as const, text: `${total.toLocaleString("th-TH")}฿`, weight: "bold" as const, size: "xl" as const, align: "end" as const, color: "#84D4FA" },
                ],
              },
            ];
          })(),
        },
        {
          type: "box",
          layout: "horizontal",
          backgroundColor: "#F0F9FF",
          cornerRadius: "8px",
          paddingAll: "10px",
          margin: "sm",
          contents: [
            { type: "text", text: deliveryText, size: "xs", color: "#0369A1", wrap: true },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "16px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: isCancelled ? "#EF4444" : isPending ? "#EC4899" : "#84D4FA",
          action: {
            type: "uri",
            label: "ดูออเดอร์",
            uri: `${siteUrl}/admin?tab=shoporders`,
          },
        },
      ],
    },
  };
}

// ─── Feedback Flex Message builder ───────────────────────────────────────────

export function buildFeedbackFlexMessage(params: {
  feedbackId: string;
  type: "comment" | "report";
  name?: string | null;
  studentId?: string | null;
  studentPhotoUrl?: string | null;
  email?: string | null;
  contact?: string | null;
  category?: string | null;
  reportUrl?: string | null;
  message: string;
  imageUrls?: string[] | null;
}) {
  const { type, name, studentId, studentPhotoUrl, email, contact, category, reportUrl, message, imageUrls } = params;
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";
  const typeLabel   = type === "comment" ? "ความคิดเห็น" : "รายงานปัญหา";
  const headerColor = type === "comment" ? "#84D4FA" : "#FF7070";
  const imgs        = (imageUrls ?? []).filter(Boolean);
  const heroUrl     = imgs[0] ?? null;
  const extraImgs   = imgs.slice(1, 3);

  const bubble: Record<string, unknown> = { type: "bubble", size: "giga" };

  // ── Hero (first image) ──────────────────────────────────────────
  if (heroUrl) {
    bubble.hero = {
      type: "image",
      url: heroUrl,
      size: "full",
      aspectMode: "cover",
      aspectRatio: "20:9",
    };
  }

  // ── Header (with optional student photo) ───────────────────────
  bubble.header = buildLineFlexHeader({
    title: "ASIA-BOT Feedback",
    subtitle: "รับเรื่องใหม่จากผู้ใช้งาน",
    backgroundColor: headerColor,
    photoUrl: studentPhotoUrl,
    subtitleColor: "#1E293B",
  });

  // ── Body ────────────────────────────────────────────────────────
  const bodyContents: object[] = [
    { type: "text", text: "สถานะ: รอรับเรื่อง", weight: "bold", size: "xl", color: "#FE4040" },
    { type: "text", text: `ประเภท: ${typeLabel}`, size: "sm", color: "#475569" },
  ];

  // Info rows — shown only when field has a value
  const infoRow = (label: string, value?: string | null) => ({
    type: "box" as const,
    layout: "horizontal" as const,
    contents: [
      { type: "text" as const, text: label, size: "sm" as const, color: "#64748B", flex: 2 },
      { type: "text" as const, text: value ?? "-", size: "sm" as const, color: "#0F172A", weight: "bold" as const, align: "end" as const, flex: 3, wrap: true },
    ],
  });
  const infoRows = [
    name      ? infoRow("ชื่อ",           name)      : null,
    studentId ? infoRow("รหัสนักเรียน",   studentId) : null,
    email     ? infoRow("อีเมล",          email)     : null,
    contact   ? infoRow("ติดต่อ",          contact)   : null,
    category  ? infoRow("หมวดหมู่",        category)  : null,
    reportUrl ? infoRow("URL",            reportUrl) : null,
  ].filter(Boolean) as object[];

  if (infoRows.length > 0) {
    bodyContents.push(
      { type: "separator", margin: "md" },
      { type: "box", layout: "vertical", spacing: "sm", contents: infoRows }
    );
  }

  bodyContents.push({ type: "separator", margin: "md" });

  // Extra images (index 1+) horizontal grid
  if (extraImgs.length > 0) {
    bodyContents.push(
      {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text" as const, text: "รูปภาพเพิ่มเติม", weight: "bold" as const, size: "sm" as const, color: "#0F172A" },
          {
            type: "box" as const,
            layout: "horizontal" as const,
            spacing: "sm" as const,
            contents: extraImgs.map(url => ({
              type: "image" as const,
              url,
              aspectMode: "cover" as const,
              aspectRatio: "1:1" as const,
              size: "sm" as const,
            })),
          },
        ],
      },
      { type: "separator", margin: "md" }
    );
  }

  // Message box
  bodyContents.push({
    type: "box",
    layout: "vertical",
    backgroundColor: "#EAF7FF",
    paddingAll: "14px",
    cornerRadius: "16px",
    spacing: "sm",
    contents: [
      { type: "text" as const, text: "ข้อความ", size: "sm" as const, weight: "bold" as const, color: "#0F172A" },
      { type: "text" as const, text: message, size: "sm" as const, color: "#475569", wrap: true },
    ],
  });

  bubble.body = { type: "box", layout: "vertical", spacing: "md", contents: bodyContents };

  // ── Footer ──────────────────────────────────────────────────────
  bubble.footer = {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    contents: [
      {
        type: "button",
        style: "primary",
        color: headerColor,
        action: { type: "uri", label: "เปิด Feedback", uri: `${siteUrl}/admin?tab=feedbacks` },
      },
    ],
  };

  return bubble;
}

// ─── Booking Flex Message builder ────────────────────────────────────────────

export function buildBookingFlexMessage(params: {
  bookingId?: string | null;
  roomName: string;
  studentName: string;
  studentId: string;
  studentPhotoUrl?: string | null;
  nickname?: string | null;
  program?: string | null;
  department?: string | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  attendees?: number | null;
  phone?: string | null;
  purpose: string;
  status?: "pending" | "approved" | "rejected" | "cancelled";
}) {
  const { bookingId, roomName, studentName, studentId, studentPhotoUrl, nickname, program, department, bookingDate, startTime, endTime, attendees, phone, purpose, status = "pending" } = params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";
  const cfg = {
    pending: { header: "#F59E0B", badge: "#F59E0B", label: "รออนุมัติ", icon: "📅" },
    approved: { header: "#F59E0B", badge: "#22C55E", label: "อนุมัติแล้ว", icon: "✅" },
    rejected: { header: "#F59E0B", badge: "#EF4444", label: "ไม่อนุมัติ", icon: "🚫" },
    cancelled: { header: "#F59E0B", badge: "#64748B", label: "ยกเลิก", icon: "❌" },
  }[status];
  const dateText = new Date(`${bookingDate}T12:00:00`).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const row = (label: string, value?: string | number | null) => value ? ({
    type: "box" as const,
    layout: "horizontal" as const,
    contents: [
      { type: "text" as const, text: label, size: "sm" as const, color: "#64748B", flex: 2 },
      { type: "text" as const, text: String(value), size: "sm" as const, color: "#0F172A", weight: "bold" as const, align: "end" as const, flex: 3, wrap: true },
    ],
  }) : null;
  const rows = [
    row("ผู้จอง", `${studentName}${nickname ? ` (${nickname})` : ""}`),
    row("รหัสนักเรียน", studentId),
    row("ชั้น/สาขา", [program, department].filter(Boolean).join(" · ")),
    row("ห้อง", roomName),
    row("วันที่", dateText),
    row("เวลา", `${startTime.slice(0, 5)}-${endTime.slice(0, 5)}`),
    row("จำนวน", attendees ? `${attendees} คน` : null),
    row("เบอร์", phone),
    row("Booking", bookingId),
  ].filter(Boolean) as object[];

  return {
    type: "bubble",
    size: "giga",
    header: buildLineFlexHeader({
      title: "ASIA-BOT Booking",
      subtitle: "คำขอจองห้องจากนักเรียน",
      backgroundColor: cfg.header,
      photoUrl: studentPhotoUrl,
    }),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: `คำขอจองห้อง ${roomName}`, weight: "bold", size: "xl", color: cfg.badge, wrap: true },
        { type: "separator", margin: "sm" },
        { type: "box", layout: "vertical", spacing: "sm", contents: rows },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F8FAFC",
          cornerRadius: "12px",
          paddingAll: "12px",
          contents: [{ type: "text", text: purpose, size: "sm", color: "#475569", wrap: true }],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [{
        type: "button",
        style: "primary",
        color: cfg.badge,
        action: { type: "uri", label: "เปิดรายการจอง", uri: `${siteUrl}/admin?tab=bookings` },
      }],
    },
  };
}

// ─── Student Data Change Flex Message builder ────────────────────────────────

export function buildStudentDataChangeFlexMessage(params: {
  studentId: string;
  studentName: string;
  studentPhotoUrl?: string | null;
  nickname?: string | null;
  program?: string | null;
  department?: string | null;
  changes: { label: string; oldValue?: string | null; newValue: string }[];
}) {
  const { studentId, studentName, studentPhotoUrl, nickname, program, department, changes } = params;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";
  const changeRows = changes.slice(0, 6).map((change) => ({
    type: "box" as const,
    layout: "vertical" as const,
    spacing: "xs" as const,
    contents: [
      { type: "text" as const, text: change.label, size: "xs" as const, color: "#64748B", weight: "bold" as const },
      {
        type: "text" as const,
        text: `${change.oldValue || "-"} → ${change.newValue}`,
        size: "sm" as const,
        color: "#0F172A",
        wrap: true,
      },
    ],
  }));

  const infoRow = (label: string, value?: string | null) => value ? ({
    type: "box" as const,
    layout: "horizontal" as const,
    contents: [
      { type: "text" as const, text: label, size: "sm" as const, color: "#64748B", flex: 2 },
      { type: "text" as const, text: value, size: "sm" as const, color: "#0F172A", weight: "bold" as const, align: "end" as const, flex: 3, wrap: true },
    ],
  }) : null;
  const infoRows = [
    infoRow("นักเรียน", `${studentName}${nickname ? ` (${nickname})` : ""}`),
    infoRow("รหัส", studentId),
    infoRow("ชั้น/สาขา", [program, department].filter(Boolean).join(" · ")),
  ].filter(Boolean) as object[];

  return {
    type: "bubble",
    size: "giga",
    header: buildLineFlexHeader({
      title: "ASIA-BOT Data Request",
      subtitle: "คำขอแก้ไขข้อมูลนักเรียน",
      backgroundColor: "#6366F1",
      photoUrl: studentPhotoUrl,
    }),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "รอแอดมินตรวจสอบ", weight: "bold", size: "xl", color: "#2563EB" },
        { type: "box", layout: "vertical", spacing: "sm", contents: infoRows },
        { type: "separator", margin: "sm" },
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F8FAFC",
          cornerRadius: "12px",
          paddingAll: "12px",
          spacing: "md",
          contents: [
            { type: "text" as const, text: "รายการที่ขอแก้ไข", size: "sm" as const, weight: "bold" as const, color: "#0F172A" },
            ...changeRows,
            ...(changes.length > 6 ? [{ type: "text" as const, text: `และอีก ${changes.length - 6} รายการ`, size: "xs" as const, color: "#64748B" }] : []),
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [{
        type: "button",
        style: "primary",
        color: "#2563EB",
        action: { type: "uri", label: "เปิดคำขอแก้ไขข้อมูล", uri: `${siteUrl}/admin?tab=data_requests` },
      }],
    },
  };
}

// ─── RFID Attendance Flex Message builder ────────────────────────────────────

export function buildRfidScanFlexMessage(params: {
  action: "checkin" | "checkout";
  studentName: string;
  studentId: string;
  nickname?: string | null;
  program?: string | null;
  department?: string | null;
  studentPhotoUrl?: string | null;
  location: string;
  locationLabel: string;
  uid: string;
  scannedAt: string;
  duration?: string | null;
}) {
  const { action, studentName, studentId, nickname, program, department, studentPhotoUrl, location, locationLabel, uid, scannedAt, duration } = params;
  const isCheckin = action === "checkin";
  const headerColor = "#84D4FA";
  const actionText = `${isCheckin ? "เข้า" : "ออก"}${locationLabel}`;
  const statusColor = isCheckin ? "#22C55E" : "#0EA5E9";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";
  const timeText = new Date(scannedAt).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const infoRow = (label: string, value?: string | null) => ({
    type: "box" as const,
    layout: "horizontal" as const,
    contents: [
      { type: "text" as const, text: label, size: "sm" as const, color: "#64748B", flex: 2 },
      { type: "text" as const, text: value ?? "-", size: "sm" as const, weight: "bold" as const, color: "#0F172A", align: "end" as const, flex: 3, wrap: true },
    ],
  });

  return {
    type: "bubble",
    size: "giga",
    header: buildLineFlexHeader({
      title: isCheckin ? "ASIA-BOT Check-in" : "ASIA-BOT Check-out",
      subtitle: "สแกนบัตรสำเร็จ",
      backgroundColor: headerColor,
      photoUrl: studentPhotoUrl,
      subtitleColor: "#1E293B",
    }),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: actionText, weight: "bold", size: "xl", color: statusColor },
        { type: "text", text: `${studentName} (${studentId})`, size: "sm", color: "#475569", wrap: true },
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            infoRow("สถานที่", locationLabel),
            infoRow("โซน", location),
            ...(nickname ? [infoRow("ชื่อเล่น", nickname)] : []),
            ...(program ? [infoRow("ระดับ", program)] : []),
            ...(department ? [infoRow("สาขา", department)] : []),
            infoRow("เวลา", timeText),
            infoRow("UID", uid),
            ...(duration ? [infoRow("ระยะเวลา", duration)] : []),
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [{
        type: "button",
        style: "primary",
        color: headerColor,
        action: { type: "uri", label: "ดูประวัติการสแกน", uri: `${siteUrl}/student-entry-scanner` },
      }],
    },
  };
}
