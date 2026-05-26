import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { verifyLineSignature, replyLineMessage } from "@/lib/line";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("x-line-signature") ?? "";

  if (!verifyLineSignature(body, sig)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const { events = [] } = JSON.parse(body) as { events: LineEvent[] };

  await Promise.all(events.map(handleEvent));

  return NextResponse.json({ status: "ok" });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LineEvent = {
  type: string;
  replyToken?: string;
  source: { userId?: string };
  message?: { type: string; text?: string };
};

// ─── Event handler ────────────────────────────────────────────────────────────

async function handleEvent(event: LineEvent) {
  const userId = event.source.userId;
  if (!userId) return;

  if (event.type === "message" && event.message?.type === "text") {
    const text = event.message.text?.trim() ?? "";
    const replyToken = event.replyToken ?? "";
    await handleTextMessage(userId, text, replyToken);
  }
}

async function handleTextMessage(userId: string, text: string, replyToken: string) {
  const studentId = text.trim().toUpperCase();

  const { data: student } = await (supabase as any)
    .from("students")
    .select("student_id, first_name, last_name")
    .ilike("student_id", studentId)
    .maybeSingle();

  if (student) {
    await (supabase as any)
      .from("students")
      .update({ line_user_id: userId })
      .eq("student_id", student.student_id);

    await replyLineMessage(replyToken, [{
      type: "flex",
      altText: `เชื่อมต่อบัญชีสำเร็จ! สวัสดี ${student.first_name}`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#0EA5E9",
          paddingAll: "16px",
          contents: [
            { type: "text", text: "✅ เชื่อมต่อบัญชีสำเร็จ!", weight: "bold", size: "lg", color: "#FFFFFF" },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "16px",
          spacing: "md",
          contents: [
            {
              type: "text",
              text: `สวัสดี ${student.first_name} ${student.last_name} 👋`,
              weight: "bold",
              size: "md",
              color: "#1E293B",
              wrap: true,
            },
            {
              type: "text",
              text: "ตอนนี้คุณจะได้รับการแจ้งเตือนผ่าน LINE นี้ทุกครั้งที่คำสั่งซื้อได้รับการยืนยัน",
              size: "sm",
              color: "#64748B",
              wrap: true,
            },
          ],
        },
        styles: { header: { backgroundColor: "#0EA5E9" } },
      },
    }]);
  } else {
    await replyLineMessage(replyToken, [{
      type: "text",
      text: "❌ ไม่พบรหัสนักเรียนนี้\nกรุณาส่งรหัสนักเรียนของคุณ (เช่น 6512345)",
    }]);
  }
}
