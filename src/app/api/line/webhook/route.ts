import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLineSignature, replyLineMessage, sendLineMessage } from '@/lib/line'
import { handleAdminGroupMessage } from '@/lib/line-admin-commands'
import { isLineNotificationGroup, recordLineGroupSeen } from '@/lib/line-targets'
import { runAgent } from '@/lib/agent/core'
import { buildLineRequest } from '@/lib/agent/channels/line'
import { parseNavTags, toAbsoluteUrl } from '@/lib/agent/nav'
import { attemptLink, type LinkOutcome } from '@/lib/line-linking'

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

  // ── Account linking ──────────────────────────────────────────────────────
  // ตรรกะทั้งหมดอยู่ใน src/lib/line-linking.ts ที่นี่ทำแค่แปลงผลลัพธ์เป็นข้อความ
  const outcome = await attemptLink(supabase as any, userId, text)
  await replyLineMessage(replyToken, [buildLinkReply(outcome)])
}

/** แปลงผลการเชื่อมบัญชีเป็นข้อความตอบกลับ แยกออกมาเพื่อให้ตัว router อ่านง่าย */
function buildLinkReply(outcome: LinkOutcome): Record<string, unknown> {
  switch (outcome.kind) {
    case 'linked':
      return {
        type: 'flex',
        altText: `เชื่อมต่อบัญชีสำเร็จ! สวัสดี ${outcome.firstName}`,
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
              { type: 'text', text: `สวัสดี ${outcome.firstName} ${outcome.lastName} 👋`, weight: 'bold', size: 'md', color: '#1E293B', wrap: true },
              { type: 'text', text: 'ต่อไปนี้เรื่องของคุณจะแจ้งเตือนมาที่แชทนี้ เช่น ผลอนุมัติคำขอ สถานะงานซ่อม และเอกสาร', size: 'sm', color: '#64748B', wrap: true },
              { type: 'text', text: 'ลองพิมพ์ถามได้เลย เช่น "พรุ่งนี้เรียนอะไร" หรือ "ขอดูข้อมูลของฉัน" 🤖', size: 'sm', color: '#64748B', wrap: true },
            ],
          },
        },
      }

    case 'ask_phone':
      return {
        type: 'text',
        text:
          `📋 พบรหัสนักเรียน ${outcome.studentId} แล้ว\n\n` +
          'เหลืออีกขั้นเดียว — ยืนยันว่าเป็นเจ้าของจริง\n' +
          'พิมพ์เบอร์โทรที่แจ้งไว้กับโรงเรียน ส่งมาในแชทนี้ได้เลย\n' +
          `(ใบ้ให้: ${outcome.phoneHint})\n\n` +
          'ที่ต้องถามเพิ่มเพราะรหัสนักเรียนอยู่บนบัตร ใครเห็นก็จำได้ ถ้าไม่ยืนยันอะไรเลย คนอื่นจะเอารหัสของคุณไปเชื่อมแทนได้',
      }

    case 'wrong_phone':
      return {
        type: 'text',
        text:
          `❌ เบอร์ไม่ตรงกับที่โรงเรียนมีอยู่ (ลองได้อีก ${outcome.remaining} ครั้ง)\n\n` +
          'พิมพ์เฉพาะตัวเลขก็พอ เช่น 0812345678\n' +
          'ถ้าเปลี่ยนเบอร์แล้วยังไม่ได้แจ้งโรงเรียน ให้ใช้วิธีขอรหัส 6 หลักจากเว็บแทน',
      }

    case 'blocked':
      return {
        type: 'text',
        text:
          `🔒 กรอกเบอร์ผิดหลายครั้งเกินไป กรุณารออีก ${outcome.minutes} นาที\n\n` +
          'ถ้าจำเบอร์ที่แจ้งไว้ไม่ได้ ใช้วิธีขอรหัส 6 หลักจากเว็บแทนได้เลย ไม่ต้องรอ',
      }

    case 'already_linked_elsewhere':
      return {
        type: 'text',
        text:
          '⛔ รหัสนักเรียนนี้เชื่อมกับบัญชี LINE อื่นอยู่แล้ว\n\n' +
          'ถ้าเป็นของคุณเองแต่เปลี่ยนบัญชี LINE ใหม่ ให้เข้าเว็บด้วยบัญชีของคุณ กด "ยกเลิกการเชื่อม LINE" ก่อน แล้วค่อยกลับมาเชื่อมใหม่ที่นี่\n' +
          'ถ้าไม่ได้เป็นคนเชื่อมเอง แจ้งครูหรือผู้ดูแลระบบทันที',
      }

    case 'no_phone_on_file':
      return {
        type: 'text',
        text:
          `⚠️ รหัส ${outcome.studentId} ยังไม่มีเบอร์โทรในระบบ จึงยืนยันทางแชทไม่ได้\n\n` +
          'ให้เข้าเว็บ ล็อกอิน แล้วกด "ขอรหัสเชื่อมบัญชี" ที่การ์ดแจ้งเตือนทาง LINE จากนั้นเอารหัส 6 หลักมาพิมพ์ที่นี่',
      }

    case 'unknown_student':
      return {
        type: 'text',
        text:
          '🔍 ไม่พบรหัสนักเรียนนี้ในระบบ\n\n' +
          'ลองตรวจตัวเลขอีกครั้ง ถ้าเพิ่งเข้าใหม่แล้วยังไม่มีข้อมูล ให้แจ้งครูที่ปรึกษาก่อน',
      }

    case 'not_ready':
      return {
        type: 'text',
        text: '⚠️ ระบบเชื่อมบัญชียังไม่พร้อมใช้งาน กรุณาแจ้งผู้ดูแลระบบ',
      }

    default:
      return {
        type: 'text',
        text:
          '👋 สวัสดีครับ บัญชี LINE นี้ยังไม่ได้เชื่อมกับข้อมูลนักเรียน\n\n' +
          'เชื่อมแล้วจะได้รับแจ้งเตือนเรื่องของตัวเอง เช่น ผลอนุมัติคำขอและสถานะเอกสาร และถามข้อมูลของตัวเองกับบอทได้\n\n' +
          '━━━ วิธีเชื่อม เลือกอย่างใดอย่างหนึ่ง ━━━\n\n' +
          '① พิมพ์รหัสนักเรียนของคุณส่งมาในแชทนี้\n' +
          '   จากนั้นบอทจะถามเบอร์โทรที่แจ้งไว้กับโรงเรียน เพื่อยืนยันว่าเป็นเจ้าของจริง\n\n' +
          '② ถ้าจำเบอร์ที่แจ้งไว้ไม่ได้\n' +
          '   เข้าเว็บ ล็อกอิน แล้วไปที่การ์ด "แจ้งเตือนทาง LINE" กดขอรหัสเชื่อมบัญชี\n' +
          '   แล้วพิมพ์รหัส 6 หลักที่ได้ ส่งมาที่นี่ภายใน 10 นาที',
      }
  }
}
