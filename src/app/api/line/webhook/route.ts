import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { verifyLineSignature, replyLineMessage } from "@/lib/line";
import { handleStudentMessage } from "@/lib/line-commands";
import { handleAdminGroupMessage } from "@/lib/line-admin-commands";

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
  source: { userId?: string; groupId?: string; type?: string };
  message?: { type: string; text?: string };
};

// ─── Event handler ────────────────────────────────────────────────────────────

async function handleEvent(event: LineEvent) {
  const userId = event.source.userId;
  if (!userId) return;
  if (event.type !== "message" || event.message?.type !== "text") return;

  const text = event.message.text?.trim() ?? "";
  const replyToken = event.replyToken ?? "";
  const groupId = event.source.groupId;

  await handleTextMessage(userId, text, replyToken, groupId);
}

async function handleTextMessage(userId: string, text: string, replyToken: string, groupId?: string) {
  // ── "รับเรื่อง Feedback #<id>" — any source ───────────────────────────────
  const fbMatch = text.match(/รับเรื่อง\s+Feedback\s+#([a-zA-Z0-9-]+)/i);
  if (fbMatch) {
    const feedbackId = fbMatch[1];
    const { data: updated } = await supabase
      .from("feedback")
      .update({ status: "in_progress" })
      .eq("id", feedbackId)
      .eq("status", "pending")
      .select("id");

    if (updated?.length) {
      await replyLineMessage(replyToken, [{
        type: "text",
        text: `✅ รับเรื่อง Feedback #${feedbackId.slice(0, 8).toUpperCase()} แล้ว\nสถานะเปลี่ยนเป็น "กำลังดำเนินการ"`,
      }]);
    } else {
      await replyLineMessage(replyToken, [{
        type: "text",
        text: `ℹ️ Feedback #${feedbackId.slice(0, 8).toUpperCase()} อาจถูกดำเนินการแล้ว`,
      }]);
    }
    return;
  }

  // ── Admin group commands ──────────────────────────────────────────────────
  if (groupId && groupId === process.env.LINE_GROUP_ADMIN) {
    await handleAdminGroupMessage(supabase as any, text, replyToken);
    return;
  }

  // ── Look up linked student by LINE userId ─────────────────────────────────
  const { data: linkedStudent } = await (supabase as any)
    .from("students")
    .select("student_id, first_name, last_name, nickname, program, department, photo_url")
    .eq("line_user_id", userId)
    .maybeSingle();

  if (linkedStudent) {
    await handleStudentMessage(supabase as any, linkedStudent, text, replyToken);
    return;
  }

  // ── Student ID linking (not yet linked) ───────────────────────────────────
  const studentId = text.toUpperCase();

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
              text: "บัญชี LINE นี้เชื่อมกับรหัสนักเรียนของคุณแล้ว\nพิมพ์ 'ช่วยเหลือ' เพื่อดูสิ่งที่ฉันทำได้ 🤖",
              size: "sm",
              color: "#64748B",
              wrap: true,
            },
          ],
        },
      },
    }]);
  } else {
    // Could be a random message to an unlinked user — prompt them
    await replyLineMessage(replyToken, [{
      type: "text",
      text: "🔗 กรุณาส่งรหัสนักเรียนของคุณก่อน เพื่อเชื่อมต่อบัญชี LINE กับระบบ\nเช่น: 6512345",
    }]);
  }
}
