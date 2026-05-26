import { NextResponse } from "next/server";
import { sendLineFlexMessage, sendLineMessage, buildOrderFlexMessage } from "@/lib/line";

export async function GET() {
  const token = process.env.LINE_TOKEN;
  const groupId = process.env.LINE_GROUP_ADMIN;

  if (!token) return NextResponse.json({ error: "LINE_TOKEN not set" }, { status: 500 });
  if (!groupId) return NextResponse.json({ error: "LINE_GROUP_ADMIN not set" }, { status: 500 });

  // ── Step 1: ทดสอบ text message ────────────────────────────────────
  const textRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: groupId, messages: [{ type: "text", text: "🔔 LINE test — text OK" }] }),
  }).catch(err => ({ ok: false, status: 0, text: async () => String(err) } as Response));

  const textBody = await textRes.text().catch(() => "");
  if (!textRes.ok) {
    return NextResponse.json({
      step: "text_failed",
      status: textRes.status,
      body: textBody,
      token_preview: `${token.slice(0, 8)}...`,
      group_id: groupId,
    });
  }

  // ── Step 2: ทดสอบ flex message ────────────────────────────────────
  const flexContents = buildOrderFlexMessage({
    orderId: "test-order-id-12345678",
    studentName: "ทดสอบ ระบบ",
    studentId: "9999",
    items: [{ name: "ขนมปัง", qty: 2, price: 15, unit: "ชิ้น", imageUrl: null }],
    total: 30,
    deliveryMode: "pickup",
    status: "pending",
  });

  const flexRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to: groupId,
      messages: [{ type: "flex", altText: "🔔 LINE test — flex", contents: flexContents }],
    }),
  }).catch(err => ({ ok: false, status: 0, text: async () => String(err) } as Response));

  const flexBody = await flexRes.text().catch(() => "");
  if (!flexRes.ok) {
    return NextResponse.json({
      step: "flex_failed",
      text_ok: true,
      status: flexRes.status,
      body: flexBody,
    });
  }

  return NextResponse.json({ ok: true, text_ok: true, flex_ok: true });
}
