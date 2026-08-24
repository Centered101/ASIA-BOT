import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";

/**
 * ประวัติการคุยกับผู้ช่วย AI สำหรับหลังบ้าน (agent_logs)
 *
 * บอทบันทึกทุกเทิร์นมาตลอดตั้งแต่วันแรก แต่ไม่มีหน้าไหนอ่านได้ เวลามีคนบอกว่า
 * "ถามบอทแล้วตอบผิด" หรือ "กดจองแล้วไม่ขึ้น" จึงตามไม่ได้เลยว่าเกิดอะไรขึ้น
 * ทั้งที่คำตอบอยู่ในตารางนี้ครบ ทั้งข้อความ เครื่องมือที่เรียก เวลาที่ใช้
 * และ error
 *
 * agent_conversations (ความจำ 12 ข้อความล่าสุด) เป็นคนละเรื่อง ตรงนี้ดึงมาให้
 * เฉพาะตอนถามถึง session เดียว เพื่อดูว่าตอนนี้บอท "จำ" อะไรของคนนั้นอยู่
 *
 * สิทธิ์ agent.view_logs ให้เฉพาะ ADMIN กับ SUPER_ADMIN (0024) เพราะเนื้อหา
 * เป็นบทสนทนาส่วนตัวของนักเรียน ไม่ใช่ข้อมูลสรุปแบบแดชบอร์ด
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** ชื่อคนจากรหัสที่ log เก็บไว้ — log เก็บแค่ user_id ซึ่งอ่านเองไม่รู้เรื่อง */
async function resolveNames(
  supabase: ReturnType<typeof getServiceClient>,
  userIds: string[]
): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};

  const [students, admins] = await Promise.all([
    supabase.from("students").select("student_id, first_name, last_name, nickname").in("student_id", ids),
    supabase.from("admins").select("admin_id, first_name, last_name").in("admin_id", ids),
  ]);

  const names: Record<string, string> = {};
  for (const s of students.data ?? []) {
    const full = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
    names[s.student_id] = s.nickname ? `${full} (${s.nickname})` : full || s.student_id;
  }
  for (const a of admins.data ?? []) {
    // แอดมินทับของนักเรียนได้ถ้ารหัสชนกัน ซึ่งไม่ควรเกิด แต่ถ้าเกิดให้ฝั่งแอดมินชนะ
    // เพราะ log ของแอดมินมาจากช่องทางหลังบ้านที่ระบุตัวตนชัดกว่า
    names[a.admin_id] = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.admin_id;
  }
  return names;
}

export const GET = withAuth(
  async (req) => {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id")?.trim();
    const sessionId = url.searchParams.get("session_id")?.trim();
    const channel = url.searchParams.get("channel")?.trim();
    const role = url.searchParams.get("role")?.trim();
    const q = url.searchParams.get("q")?.trim();
    const onlyErrors = url.searchParams.get("only_errors") === "1";
    // เคอร์เซอร์เป็น created_at ของแถวสุดท้ายที่ได้ไป ไม่ใช่ offset เพราะแถวใหม่
    // เข้ามาตลอดเวลา offset จะทำให้ข้อความซ้ำ/ข้ามตอนกดโหลดเพิ่ม
    const before = url.searchParams.get("before")?.trim();
    const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);

    const supabase = getServiceClient();

    let query = supabase
      .from("agent_logs")
      .select("id, session_id, channel, user_id, user_role, user_message, tools_called, response, latency_ms, error, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (userId) query = query.eq("user_id", userId);
    if (sessionId) query = query.eq("session_id", sessionId);
    if (channel) query = query.eq("channel", channel);
    if (role) query = query.eq("user_role", role);
    if (onlyErrors) query = query.not("error", "is", null);
    if (before) query = query.lt("created_at", before);
    if (q) query = query.or(`user_message.ilike.%${q}%,response.ilike.%${q}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const names = await resolveNames(supabase, rows.map((r) => r.user_id ?? ""));

    // สรุป 24 ชม. ล่าสุด — คำถามแรกของคนเปิดหน้านี้คือ "เมื่อวานมีอะไรพังไหม"
    // ไม่ใช่ยอดสะสมตั้งแต่เปิดระบบ
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [recent, failed] = await Promise.all([
      supabase.from("agent_logs").select("latency_ms, channel").gte("created_at", since),
      supabase
        .from("agent_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since)
        .not("error", "is", null),
    ]);

    const recentRows = recent.data ?? [];
    const byChannel: Record<string, number> = {};
    let latencySum = 0;
    for (const r of recentRows) {
      byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1;
      latencySum += r.latency_ms ?? 0;
    }

    // ถามถึง session เดียว = กำลังตามเรื่องของคนคนหนึ่ง ให้เห็นด้วยว่าบอทจำอะไรอยู่
    let memory: { role: string; content: string }[] | null = null;
    if (sessionId) {
      const { data: conv } = await supabase
        .from("agent_conversations")
        .select("messages")
        .eq("session_id", sessionId)
        .maybeSingle();
      memory = Array.isArray(conv?.messages) ? (conv.messages as { role: string; content: string }[]) : [];
    }

    return NextResponse.json({
      status: "success",
      data: rows,
      names,
      memory,
      // แถวสุดท้ายเป็นเคอร์เซอร์ของหน้าถัดไป ไม่มี = หมดแล้ว
      next_before: rows.length === limit ? rows[rows.length - 1]?.created_at ?? null : null,
      summary: {
        turns_24h: recentRows.length,
        errors_24h: failed.count ?? 0,
        avg_latency_ms: recentRows.length ? Math.round(latencySum / recentRows.length) : 0,
        by_channel: byChannel,
      },
    });
  },
  { permission: "agent.view_logs" }
);
