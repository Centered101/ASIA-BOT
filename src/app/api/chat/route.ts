import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const { messages, isAdmin, userName, userProgram, userDepartment } = body as {
    messages: { role: "user" | "assistant"; content: string }[];
    isAdmin: boolean;
    userName?: string;
    userProgram?: string;
    userDepartment?: string;
  };

  const systemPrompt = isAdmin
    ? [
        "คุณคือ ASIA-BOT ผู้ช่วย AI สำหรับทีม admin ของโรงเรียน ASIA เทคโนโลยีและนวัตกรรม",
        userName ? `Admin ที่คุยด้วย: ${userName}` : "",
        "คุณช่วย admin ได้เรื่อง: การจัดการนักเรียน, อนุมัติการจองห้อง, ดูฟีดแบ็ก, สถิติ, ตั้งค่าระบบ",
        "ตอบกระชับ เป็นมืออาชีพ ใช้ภาษาไทย ไม่เกิน 4-5 ประโยค",
      ].filter(Boolean).join("\n")
    : [
        "คุณคือ ASIA-BOT ผู้ช่วย AI สำหรับนักเรียนโรงเรียน ASIA เทคโนโลยีและนวัตกรรม",
        userName ? `นักเรียนที่คุยด้วย: ${userName}` : "นักเรียน (ยังไม่ได้ login)",
        userProgram ? `หลักสูตร: ${userProgram}${userDepartment ? ` · ${userDepartment}` : ""}` : "",
        "คุณช่วยนักเรียนได้เรื่อง: ขั้นตอนการจองห้อง, การสแกนบัตร, การสั่งอาหาร, การส่งฟีดแบ็ก, วิธีใช้งานระบบ",
        "ตอบเป็นภาษาไทย กระชับ เป็นมิตร ไม่เกิน 4 ประโยค",
      ].filter(Boolean).join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.slice(-12),
    });

    const block = response.content[0];
    const text = block.type === "text" ? block.text : "ขอโทษครับ เกิดข้อผิดพลาด";
    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
