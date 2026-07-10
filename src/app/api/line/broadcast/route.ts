import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";
import { getLineNotificationTarget } from "@/lib/line-targets";

type LineMessage = Record<string, unknown>;
type BroadcastMode = "text" | "image" | "news_flex" | "urgent_flex" | "event_flex" | "notice_flex" | "custom_json";

const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 20_000;
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function pushLineMessage(to: string, messages: LineMessage[]) {
  const token = process.env.LINE_TOKEN;
  if (!token) return { ok: false, status: 500, body: "ยังไม่ได้ตั้งค่า LINE_TOKEN" };
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages }),
  }).catch(err => ({ ok: false, status: 0, text: async () => String(err) } as Response));
  const body = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body };
}

function absoluteUrl(url: string, siteUrl: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

function lineHttpsUrl(url: string, siteUrl: string) {
  const abs = absoluteUrl(url, siteUrl).trim();
  if (!abs) return "";
  try {
    const parsed = new URL(abs);
    if (parsed.protocol !== "https:") return "";
    if (!parsed.hostname.includes(".")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function customMessagesFromPayload(payload: unknown, altText: string): LineMessage[] {
  if (!payload || typeof payload !== "object") throw new Error("ข้อความกำหนดเองต้องเป็น object");
  const obj = payload as Record<string, unknown>;
  if (Array.isArray(obj.messages)) return obj.messages as LineMessage[];
  if (obj.type === "text" || obj.type === "image" || obj.type === "flex") return [obj];
  if (obj.type === "bubble" || obj.type === "carousel") return [{ type: "flex", altText, contents: obj }];
  if (obj.contents && typeof obj.contents === "object") return [{ type: "flex", altText, contents: obj.contents }];
  throw new Error("รูปแบบข้อความกำหนดเองไม่ถูกต้อง");
}

function buildNewsFlex(params: {
  mode: Exclude<BroadcastMode, "text" | "image" | "custom_json">;
  title: string;
  subtitle: string;
  message: string;
  imageUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  adminName: string;
}) {
  const theme = {
    news_flex: { label: "ข่าวสาร", color: "#84D4FA", icon: "📰" },
    urgent_flex: { label: "ประกาศด่วน", color: "#FF7070", icon: "🚨" },
    event_flex: { label: "กิจกรรม", color: "#F59E0B", icon: "📅" },
    notice_flex: { label: "แจ้งเตือน", color: "#6366F1", icon: "🔔" },
  }[params.mode];

  return {
    type: "bubble",
    size: "giga",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: theme.color,
      paddingAll: "20px",
      contents: [
        { type: "text", text: "ASIA-BOT", weight: "bold", size: "lg", color: "#0f172a" },
        { type: "text", text: `${theme.icon} ${theme.label}`, size: "sm", color: "#0f172a", margin: "sm" },
      ],
    },
    hero: params.imageUrl ? {
      type: "image",
      url: params.imageUrl,
      size: "full",
      aspectRatio: "20:9",
      aspectMode: "cover",
    } : undefined,
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: params.title || theme.label, weight: "bold", size: "xl", color: "#0f172a", wrap: true },
        ...(params.subtitle ? [{ type: "text", text: params.subtitle, size: "sm", color: "#64748b", wrap: true }] : []),
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#eaf7ff",
          cornerRadius: "16px",
          paddingAll: "14px",
          contents: [{ type: "text", text: params.message || "-", size: "sm", color: "#0f172a", wrap: true }],
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "ส่งโดย", size: "xs", color: "#94a3b8", flex: 0 },
            { type: "text", text: params.adminName, size: "xs", color: "#0f172a", weight: "bold", align: "end", wrap: true },
          ],
        },
      ],
    },
    footer: params.buttonUrl ? {
      type: "box",
      layout: "vertical",
      contents: [{
        type: "button",
        style: "primary",
        color: theme.color,
        action: { type: "uri", label: params.buttonLabel || "เปิดดูเพิ่มเติม", uri: params.buttonUrl },
      }],
    } : undefined,
  };
}

export async function POST(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });

  const adminName = [admin.first_name, admin.last_name].filter(Boolean).join(" ") || admin.admin_id || "ผู้ดูแล";
  const cooldownKey = `${admin.admin_id}:${req.headers.get("x-forwarded-for") ?? "local"}`;
  const remainingMs = COOLDOWN_MS - (Date.now() - (cooldowns.get(cooldownKey) ?? 0));
  if (remainingMs > 0) {
    return NextResponse.json({
      status: "error",
      message: `กรุณารอ ${Math.ceil(remainingMs / 1000)} วินาทีก่อนส่งข่าวสารอีกครั้ง`,
      cooldown_seconds: Math.ceil(remainingMs / 1000),
      admin: adminName,
    }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";
  const targetId = String(body.to || "").trim() || await getLineNotificationTarget(supabase as any, "broadcast");
  if (!targetId) return NextResponse.json({ status: "error", message: "ยังไม่ได้ตั้งค่าผู้รับ LINE" }, { status: 500 });

  const mode = String(body.mode || "news_flex") as BroadcastMode;
  const title = String(body.title || "").trim();
  const subtitle = String(body.subtitle || "").trim();
  const text = String(body.text || "").trim();
  const rawImageUrl = String(body.imageUrl || "").trim();
  const imageUrl = lineHttpsUrl(rawImageUrl, siteUrl);
  const buttonLabel = String(body.buttonLabel || "เปิดดูเพิ่มเติม").trim();
  const buttonUrl = absoluteUrl(String(body.buttonUrl || "").trim(), siteUrl);
  const altText = String(body.altText || title || "ข่าวสารจาก ASIA-BOT").slice(0, 400);
  const messages: LineMessage[] = [];

  try {
    if (mode === "text") {
      if (!text && !title) throw new Error("กรุณากรอกข้อความ");
      messages.push({ type: "text", text: [title, subtitle, text, `ส่งโดย: ${adminName}`].filter(Boolean).join("\n") });
    } else if (mode === "image") {
      if (!imageUrl) throw new Error("กรุณาใส่ URL รูปภาพแบบ HTTPS เท่านั้น เช่น https://...jpg");
      messages.push({
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      });
    } else if (mode === "custom_json") {
      messages.push(...customMessagesFromPayload(body.payload, altText));
    } else {
      if (rawImageUrl && !imageUrl) throw new Error("URL รูปภาพสำหรับ LINE ต้องเป็น HTTPS เท่านั้น เช่น https://...jpg");
      messages.push({
        type: "flex",
        altText,
        contents: buildNewsFlex({
          mode,
          title,
          subtitle,
          message: text,
          imageUrl,
          buttonLabel,
          buttonUrl,
          adminName,
        }),
      });
    }
  } catch (err) {
    return NextResponse.json({ status: "error", message: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }

  if (messages.length === 0) return NextResponse.json({ status: "error", message: "ไม่มีข้อความสำหรับส่ง" }, { status: 400 });
  if (messages.length > 5) return NextResponse.json({ status: "error", message: "LINE ส่งได้สูงสุด 5 ข้อความต่อครั้ง" }, { status: 400 });

  const result = await pushLineMessage(targetId, messages);
  if (!result.ok) {
    return NextResponse.json({
      status: "error",
      message: "ส่งข่าวสาร LINE ไม่สำเร็จ",
      http_status: result.status,
      body: result.body,
      target_id: targetId,
    }, { status: result.status || 500 });
  }

  cooldowns.set(cooldownKey, Date.now());
  return NextResponse.json({
    status: "success",
    target_id: targetId,
    mode,
    sent_count: messages.length,
    admin: adminName,
    cooldown_seconds: COOLDOWN_MS / 1000,
  });
}
