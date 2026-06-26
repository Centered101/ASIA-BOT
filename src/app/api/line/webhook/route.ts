import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLineSignature, replyLineMessage, sendLineMessage } from '@/lib/line'
import { handleAdminGroupMessage } from '@/lib/line-admin-commands'
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

  if (event.message?.type === 'text') {
    const text = event.message.text?.trim() ?? ''
    await handleTextMessage(userId, text, replyToken, groupId)
    return
  }

  if (event.message?.type === 'file') {
    await handleFileMessage(userId, event.message, replyToken)
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
  if (groupId && groupId === process.env.LINE_GROUP_ADMIN) {
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

  // ── Account linking: unlinked user sent their student ID ─────────────────
  const studentId = text.toUpperCase()
  const { data: student } = await (supabase as any)
    .from('students')
    .select('student_id, first_name, last_name')
    .ilike('student_id', studentId)
    .maybeSingle()

  if (student) {
    await (supabase as any)
      .from('students')
      .update({ line_user_id: userId })
      .eq('student_id', student.student_id)

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
      text: '🔗 กรุณาส่งรหัสนักเรียนของคุณก่อน เพื่อเชื่อมต่อบัญชี LINE กับระบบ\nเช่น: 6512345',
    }])
  }
}

// ─── File message handler (PDF upload via LINE) ───────────────────────────────

async function handleFileMessage(
  userId: string,
  message: { id?: string; fileName?: string; fileSize?: number },
  replyToken: string
) {
  const fileName = message.fileName ?? ''
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    await replyLineMessage(replyToken, [{ type: 'text', text: '📄 รองรับเฉพาะไฟล์ PDF ครับ/ค่ะ' }])
    return
  }

  const { data: student } = await (supabase as any)
    .from('students')
    .select('student_id, first_name')
    .eq('line_user_id', userId)
    .maybeSingle()

  if (!student) {
    await replyLineMessage(replyToken, [{ type: 'text', text: '🔗 กรุณาเชื่อมต่อบัญชีก่อนส่งเอกสารครับ/ค่ะ' }])
    return
  }

  const MAX_LINE_PDF = 10 * 1024 * 1024
  if (message.fileSize && message.fileSize > MAX_LINE_PDF) {
    await replyLineMessage(replyToken, [{ type: 'text', text: '📄 ไฟล์ PDF ต้องไม่เกิน 10MB ครับ/ค่ะ' }])
    return
  }

  // Reply immediately — LINE requires reply within 30s
  await replyLineMessage(replyToken, [{
    type: 'text',
    text: `📄 กำลังประมวลผล "${fileName}" กรุณารอสักครู่…`,
  }])

  try {
    const token = process.env.LINE_TOKEN!
    const contentRes = await fetch(
      `https://api-data.line.me/v2/bot/message/${message.id}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!contentRes.ok) throw new Error(`LINE content download failed: ${contentRes.status}`)

    const buffer = Buffer.from(await contentRes.arrayBuffer())

    const { extractTextFromPdf, chunkText } = await import('@/lib/pdf-utils')
    const text = await extractTextFromPdf(buffer)
    if (!text.trim()) {
      await sendLineMessage(userId, '❌ ไม่สามารถอ่านข้อความจาก PDF นี้ได้ครับ/ค่ะ (อาจเป็นไฟล์รูปภาพ)')
      return
    }
    const chunks = chunkText(text)

    const BUCKET = 'pdf-documents'
    const path = `line/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: 'application/pdf', upsert: false })
    if (storageErr) throw storageErr

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

    const docName = fileName.replace(/\.pdf$/i, '')
    const { data: doc, error: docErr } = await (supabase as any)
      .from('pdf_documents')
      .insert({
        name: docName,
        file_url: publicUrl,
        file_size: buffer.length,
        uploaded_by: `line:${userId}`,
        upload_source: 'line',
        is_public: false,
      })
      .select('id')
      .single()
    if (docErr) throw docErr

    const chunkRows = chunks.map((content: string, chunk_index: number) => ({
      document_id: doc.id,
      chunk_index,
      content,
    }))
    await (supabase as any).from('pdf_chunks').insert(chunkRows)

    await sendLineMessage(
      userId,
      `✅ อัปโหลด "${docName}" สำเร็จ! (${chunks.length} ส่วน)\n\nถามเนื้อหาในเอกสารนี้ได้เลยครับ/ค่ะ\nเช่น "สรุปเนื้อหาของ ${docName}"`
    )
  } catch (err) {
    console.error('[PDF Upload LINE]', err)
    await sendLineMessage(userId, '❌ เกิดข้อผิดพลาดในการประมวลผล PDF กรุณาลองใหม่อีกครั้งครับ/ค่ะ')
  }
}
