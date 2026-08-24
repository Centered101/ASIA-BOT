import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { loadMemory, clearMemory } from "@/lib/agent/memory";
import { parseNavTags } from "@/lib/agent/nav";
import type { Principal } from "@/lib/server/session";

/**
 * ประวัติแชตของผู้ใช้เอง — อ่านกลับและล้างทิ้ง
 *
 * ก่อนหน้านี้ ChatBubble เก็บข้อความไว้ใน state ของ React อย่างเดียว รีเฟรช
 * ทีเดียวหน้าจอว่าง ทั้งที่ agent_conversations ยังจำบทสนทนาไว้ครบ ผู้ใช้จึงเจอ
 * บอทตอบต่อจากเรื่องที่ตัวเองมองไม่เห็นแล้ว และปุ่มล้างแชตก็ล้างแค่หน้าจอ
 * ไม่ได้ล้างความจำ กดล้างแล้วบอทยังจำได้เหมือนเดิม
 *
 * ตัวตนอ่านจาก principal เท่านั้น ไม่รับ session_id จาก client เพราะ session_id
 * เดาได้จากรหัสนักเรียน ถ้ารับมาตรง ๆ ใครก็อ่านบทสนทนาของคนอื่นได้
 *
 * DELETE ล้างเฉพาะ agent_conversations (ความจำที่บอทใช้ต่อบทสนทนา)
 * ส่วน agent_logs เป็นบันทึกการใช้งานของระบบ ไม่ถูกแตะ — ผู้ใช้ลบร่องรอย
 * การใช้งานของตัวเองไม่ได้ เหมือน audit_logs
 */

function sessionIdFor(principal: Principal): string {
  // ต้องตรงกับที่ src/lib/agent/channels/web.ts สร้างไว้ ไม่งั้นจะอ่านคนละแถว
  return principal.subjectType === "admin"
    ? `web:admin:${principal.subjectId}`
    : `web:${principal.subjectId}`;
}

export const GET = withAuth(async (_req, { principal }) => {
  const stored = await loadMemory(sessionIdFor(principal), getServiceClient());

  // ความจำเก็บข้อความดิบที่ยังมี [NAV:...] อยู่ ถ้าส่งกลับตรง ๆ ผู้ใช้จะเห็น tag
  // โผล่ในบับเบิล — ถอดออกให้เหมือนตอนตอบสด แล้วคืนปุ่มมาเป็นข้อมูลแยก
  const messages = stored.map((m) => {
    if (m.role !== "assistant") return { role: m.role, content: m.content };
    const { cleanText, navButtons } = parseNavTags(m.content);
    return { role: m.role, content: cleanText, navButtons };
  });

  return NextResponse.json({ status: "success", data: { messages } });
});

export const DELETE = withAuth(
  async (_req, { principal }) => {
    await clearMemory(sessionIdFor(principal), getServiceClient());
    return NextResponse.json({ status: "success", message: "ล้างประวัติแล้ว" });
  },
  { audit: { action: "agent.clear_memory", entityType: "agent_conversation" } }
);
