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
  status?: "pending" | "paid";
}) {
  const { orderId, studentName, studentId, studentPhotoUrl, items, total, deliveryMode, deliveryLoc, deliverySlot, status = "paid" } = params;
  const isPending = status === "pending";
  const isDelivery = deliveryMode === "delivery";
  const deliveryText = isDelivery
    ? `🚚 จัดส่ง: ${deliveryLoc ?? ""} ช่วง ${deliverySlot ?? ""}`
    : "🏪 รับเองที่สหกรณ์";
  const now = new Date().toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-lb.web.app/shop";

  return {
    type: "bubble",
    size: "giga",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: isPending ? "#FEF3C7" : "#84D4FA",
      paddingAll: "20px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          alignItems: "center",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                { type: "text", text: "สหกรณ์โรงเรียน ASIA-BOT", color: "#000000", weight: "bold", size: "lg" },
                { type: "text", text: now, color: "#1E293B", size: "sm", margin: "sm" },
                {
                  type: "box" as const,
                  layout: "horizontal" as const,
                  width: isPending ? "120px" : "90px",
                  backgroundColor: isPending ? "#F59E0B" : "#22C55E",
                  cornerRadius: "20px",
                  paddingAll: "4px",
                  margin: "sm" as const,
                  contents: [{
                    type: "text" as const,
                    text: isPending ? "⏳ รอชำระเงิน" : "✅ ชำระแล้ว",
                    color: "#FFFFFF",
                    size: "xs" as const,
                    align: "center" as const,
                    weight: "bold" as const,
                  }],
                },
              ],
            },
            ...(studentPhotoUrl ? [{
              type: "box" as const,
              layout: "vertical" as const,
              width: "56px",
              height: "56px",
              cornerRadius: "8px",
              contents: [{
                type: "image" as const,
                url: studentPhotoUrl,
                size: "full",
                aspectRatio: "1:1",
                aspectMode: "cover" as const,
              }],
            }] : []),
          ],
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "20px",
      contents: [
        { type: "text", text: orderId, weight: "bold", size: "xl", color: "#0F172A" },
        {
          type: "text",
          text: studentId ? `นักเรียน: ${studentName} (${studentId})` : `นักเรียน: ${studentName}`,
          size: "sm",
          color: "#475569",
          wrap: true,
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
          color: isPending ? "#FEF3C7" : "#84D4FA",
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
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-lb.web.app";
  const typeLabel   = type === "comment" ? "ความคิดเห็น" : "รายงานปัญหา";
  const headerColor = type === "comment" ? "#84D4FA" : "#FDE68A";
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
  bubble.header = {
    type: "box",
    layout: "horizontal",
    backgroundColor: headerColor,
    paddingAll: "20px",
    alignItems: "center",
    contents: [
      {
        type: "box" as const,
        layout: "vertical" as const,
        flex: 1,
        contents: [
          { type: "text" as const, text: "ASIA-BOT Feedback", color: "#000000", weight: "bold" as const, size: "lg" as const },
          { type: "text" as const, text: "รับเรื่องใหม่จากผู้ใช้งาน", color: "#1E293B", size: "sm" as const, margin: "sm" as const },
        ],
      },
      ...(studentPhotoUrl ? [{
        type: "box" as const,
        layout: "vertical" as const,
        width: "56px",
        height: "56px",
        cornerRadius: "8px",
        contents: [{
          type: "image" as const,
          url: studentPhotoUrl,
          size: "full" as const,
          aspectRatio: "1:1",
          aspectMode: "cover" as const,
        }],
      }] : []),
    ],
  };

  // ── Body ────────────────────────────────────────────────────────
  const bodyContents: object[] = [
    { type: "text", text: "สถานะ: รอรับเรื่อง", weight: "bold", size: "xl", color: "#FE4040" },
    { type: "text", text: `ประเภท: ${typeLabel}`, size: "sm", color: "#475569" },
  ];

  // Info rows — shown only when field has a value
  const infoRow = (label: string, value: string) => ({
    type: "box" as const,
    layout: "horizontal" as const,
    contents: [
      { type: "text" as const, text: label, size: "sm" as const, color: "#64748B", flex: 2 },
      { type: "text" as const, text: value, size: "sm" as const, color: "#0F172A", weight: "bold" as const, align: "end" as const, flex: 3, wrap: true },
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
