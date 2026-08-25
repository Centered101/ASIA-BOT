import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLineSignature, replyLineMessage, sendLineMessage } from '@/lib/line'
import { handleAdminGroupMessage } from '@/lib/line-admin-commands'
import { isLineNotificationGroup, recordLineGroupSeen } from '@/lib/line-targets'
import { runAgent } from '@/lib/agent/core'
import { buildLineRequest } from '@/lib/agent/channels/line'
import { parseNavTags, toAbsoluteUrl } from '@/lib/agent/nav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('x-line-signature') ?? ''

  if (!verifyLineSignature(body, sig)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const { events = [] } = JSON.parse(body) as { events: LineEvent[] }
  await Promise.all(events.map(handleEvent))
  return NextResponse.json({ status: 'ok' })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LineEvent = {
  type: string
  replyToken?: string
  source: { userId?: string; groupId?: string; type?: string }
  message?: {
    type: string
    text?: string
    id?: string
    fileName?: string
    fileSize?: number
  }
}

// ─── Event router ─────────────────────────────────────────────────────────────

async function handleEvent(event: LineEvent) {
  const userId = event.source.userId
  if (!userId) return
  if (event.type !== 'message') return

  const replyToken = event.replyToken ?? ''
  const groupId = event.source.groupId
  if (groupId) await recordLineGroupSeen(supabase as any, groupId)

  if (event.message?.type === 'text') {
    const text = event.message.text?.trim() ?? ''
    await handleTextMessage(userId, text, replyToken, groupId)
    return
  }
}

async function handleTextMessage(
  userId: string,
  text: string,
  replyToken: string,
  groupId?: string
) {
  // ── "รับเรื่อง Feedback #<id>" — quick action from notification ───────────
  const fbMatch = text.match(/รับเรื่อง\s+Feedback\s+#([a-zA-Z0-9-]+)/i)
  if (fbMatch) {
    const feedbackId = fbMatch[1]
    const { data: updated } = await (supabase as any)
      .from('feedback')
      .update({ status: 'in_progress' })
      .eq('id', feedbackId)
      .eq('status', 'pending')
      .select('id')

    await replyLineMessage(replyToken, [{
      type: 'text',
      text: updated?.length
        ? `✅ รับเรื่อง Feedback #${feedbackId.slice(0, 8).toUpperCase()} แล้ว\nสถานะเปลี่ยนเป็น "กำลังดำเนินการ"`
        : `ℹ️ Feedback #${feedbackId.slice(0, 8).toUpperCase()} อาจถูกดำเนินการแล้ว`,
    }])
    return
  }

  // ── Admin group → preserve legacy admin commands ──────────────────────────
  if (groupId && await isLineNotificationGroup(supabase as any, groupId)) {
    await handleAdminGroupMessage(supabase as any, text, replyToken)
    return
  }

  // ── Look up linked student ────────────────────────────────────────────────
  const agentReq = await buildLineRequest(userId, text, supabase)

  if (agentReq) {
    // Student is linked — run through AI Agent Core
    const result = await runAgent(agentReq, supabase)
    const { cleanText, navButtons } = parseNavTags(result.text)

    // Convert agent nav buttons into LINE quick-reply uri actions (max 13)
    const quickReply = navButtons.length
      ? {
          items: navButtons.slice(0, 13).map(b => ({
            type: 'action' as const,
            action: { type: 'uri' as const, label: b.label.slice(0, 20), uri: toAbsoluteUrl(b.path) },
          })),
        }
      : undefined

    await replyLineMessage(replyToken, [{ type: 'text', text: cleanText, ...(quickReply ? { quickReply } : {}) }])
    return
  }

  // ── Account linking: unlinked user sent a one-time link code ─────────────
  //
  // เดิมตรงนี้รับ "รหัสนักเรียน" แล้วผูกให้เลย ซึ่งไม่ได้ยืนยันอะไรเลย —
  // รหัสนักเรียนพิมพ์อยู่บนบัตรและใช้เป็น username ตอนล็อกอิน ใครรู้รหัสของคนอื่น
  // ก็ผูก LINE ตัวเองเข้ากับนักเรียนคนนั้น รับแจ้งเตือนส่วนตัวและถาม AI แทนเขาได้
  // (เกิดขึ้นจริงระหว่างทดสอบ: บัญชีเดียวย้ายจากนักเรียนคนหนึ่งไปอีกคนได้ในคลิกเดียว)
  //
  // ตอนนี้รับเฉพาะรหัส 6 หลักที่ /api/student/line-link/code ออกให้หลังล็อกอินเว็บ
  // สำเร็จแล้วเท่านั้น ใช้ได้ครั้งเดียวและหมดอายุใน 10 นาที
  const code = text.trim()
  const nowIso = new Date().toISOString()

  // limit(1) แทน maybeSingle() เพราะถ้ามีรหัสซ้ำกันสองใบที่ยังไม่หมดอายุ
  // (โอกาสน้อยมากแต่เป็นไปได้ รหัสมี 6 หลัก) maybeSingle จะโยน error ออกมา
  // แล้วไปโผล่เป็นข้อความ "ระบบไม่พร้อม" ซึ่งชี้ต้นเหตุผิด
  const { data: codeRows, error: codeError } = await (supabase as any)
    .from('line_link_codes')
    .select('id, student_id')
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)

  const linkCode = codeRows?.[0] ?? null

  // ตารางยังไม่ถูก migrate — ต้อง fail closed ห้ามตกกลับไปผูกด้วยรหัสนักเรียน
  // เพราะนั่นคือช่องโหว่ที่กำลังปิดอยู่พอดี
  if (codeError) {
    await replyLineMessage(replyToken, [{
      type: 'text',
      text: '⚠️ ระบบเชื่อมบัญชียังไม่พร้อมใช้งาน กรุณาแจ้งผู้ดูแลระบบ',
    }])
    return
  }

  const student = linkCode
    ? (await (supabase as any)
        .from('students')
        .select('student_id, first_name, last_name, line_user_id')
        .eq('student_id', linkCode.student_id)
        .maybeSingle()).data
    : null

  // กันแย่งบัญชีที่ผูกไปแล้ว เจ้าตัวต้องกดยกเลิกจากหน้าเว็บก่อนเท่านั้น
  if (student?.line_user_id && student.line_user_id !== userId) {
    await replyLineMessage(replyToken, [{
      type: 'text',
      text: '⛔ รหัสนักเรียนนี้เชื่อมกับบัญชี LINE อื่นอยู่แล้ว\nถ้าเป็นบัญชีของคุณเอง ให้เข้าเว็บแล้วกด "ยกเลิกการเชื่อม LINE" ก่อน แล้วขอรหัสใหม่',
    }])
    return
  }

  if (student) {
    await (supabase as any)
      .from('students')
      .update({ line_user_id: userId })
      .eq('student_id', student.student_id)

    // ปิดรหัสทันทีหลังใช้ เพื่อไม่ให้ใช้ซ้ำได้แม้ยังไม่หมดอายุ
    await (supabase as any)
      .from('line_link_codes')
      .update({ used_at: nowIso, used_by_line_user_id: userId })
      .eq('id', linkCode.id)

    await replyLineMessage(replyToken, [{
      type: 'flex',
      altText: `เชื่อมต่อบัญชีสำเร็จ! สวัสดี ${student.first_name}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical',
          backgroundColor: '#0EA5E9', paddingAll: '16px',
          contents: [{ type: 'text', text: '✅ เชื่อมต่อบัญชีสำเร็จ!', weight: 'bold', size: 'lg', color: '#FFFFFF' }],
        },
        body: {
          type: 'box', layout: 'vertical', paddingAll: '16px', spacing: 'md',
          contents: [
            { type: 'text', text: `สวัสดี ${student.first_name} ${student.last_name} 👋`, weight: 'bold', size: 'md', color: '#1E293B', wrap: true },
            { type: 'text', text: 'บัญชี LINE นี้เชื่อมกับรหัสนักเรียนของคุณแล้ว\nพิมพ์อะไรก็ได้เลย ASIA-BOT พร้อมช่วยคุณ 🤖', size: 'sm', color: '#64748B', wrap: true },
          ],
        },
      },
    }])
  } else {
    await replyLineMessage(replyToken, [{
      type: 'text',
      text:
        '🔗 ยังไม่ได้เชื่อมบัญชี\n\n' +
        'วิธีเชื่อม:\n' +
        '1. เข้าเว็บแล้วล็อกอินด้วยบัญชีของตัวเอง\n' +
        '2. ที่การ์ด "แจ้งเตือนทาง LINE" กดขอรหัสเชื่อมบัญชี\n' +
        '3. พิมพ์รหัส 6 หลักที่ได้ ส่งมาในแชทนี้ภายใน 10 นาที\n\n' +
        'หมายเหตุ: ใช้รหัสนักเรียนเชื่อมไม่ได้แล้ว เพื่อไม่ให้คนอื่นเอารหัสของคุณไปเชื่อมแทน',
    }])
  }
}
