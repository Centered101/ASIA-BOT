import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'

/**
 * ศูนย์เอกสาร (0023) ฝั่งของบอท
 *
 * ที่นี่มีสองเรื่องหน้าตาคล้ายกันแต่คนละ workflow เหมือนที่อธิบายไว้ใน
 * src/lib/server/documents.ts:
 *   student_documents = ไฟล์ที่นักเรียนส่งเข้าแฟ้ม → ฝ่ายทะเบียนตรวจ
 *   document_requests = คำขอให้โรงเรียนออกเอกสารให้ → จบเมื่อนักเรียนรับของ
 *
 * บอททำได้เฉพาะขา "ขอให้ออกเอกสาร" กับการดูสถานะ เพราะขาอัปโหลดต้องมีไฟล์จริง
 * ซึ่งแชตทำไม่ได้ — ถามถึงเมื่อไหร่ให้ชี้ไป /my-documents
 *
 * กติกาเรื่องค่าธรรมเนียมและสิทธิ์คัดลอกมาจาก /api/student/document-requests
 * ทุกข้อ ไม่งั้นขอผ่านแชตจะได้เงื่อนไขคนละชุดกับขอผ่านหน้าเว็บ
 */

const MAX_COPIES = 20

function generateRequestCode() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `DOC-${today}-${suffix}`
}

export const documentTools = [
  {
    name: 'get_document_types',
    description:
      'List document types the school handles. kind="issue" are documents the school issues on request (certificates, transcripts) with their fee; kind="upload" are documents the student must submit to the school. Call this before request_document to get the exact document_type key.',
    input_schema: {
      type: 'object' as const,
      properties: {
        kind: { type: 'string', description: '"issue" (school issues it) or "upload" (student submits it). Default "issue".' },
      },
      required: [],
    },
  },
  {
    name: 'request_document',
    description:
      'Ask the registrar to issue a document for the current student (certificate, transcript, etc). Call get_document_types first to get document_type. Always confirm document, copies, fee and delivery mode with the user before calling.',
    input_schema: {
      type: 'object' as const,
      properties: {
        document_type: { type: 'string', description: 'document_type key from get_document_types (kind="issue").' },
        copies: { type: 'number', description: `Number of copies, 1-${MAX_COPIES}. Default 1.` },
        purpose: { type: 'string', description: 'What the document is for (e.g. สมัครงาน, ศึกษาต่อ).' },
        delivery_mode: { type: 'string', description: '"pickup" (รับเองที่ห้องทะเบียน) or "delivery" (ให้ส่ง). Default pickup.' },
        delivery_note: { type: 'string', description: 'Delivery address / note. Required when delivery_mode is "delivery".' },
        confirmed: { type: 'boolean', description: 'Must be true. Set only after the user has confirmed the summary and the fee.' },
      },
      required: ['document_type', 'confirmed'],
    },
  },
  {
    name: 'get_my_document_requests',
    description: 'Get the current student\'s requests for documents the school issues, with status, fee and pickup readiness.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter: pending, reviewing, approved, processing, ready, completed, rejected.' },
        limit: { type: 'number', description: 'Number of results (default 5, max 20).' },
      },
      required: [],
    },
  },
  {
    name: 'get_my_documents',
    description:
      'Get the documents the current student has submitted to the school and which required documents are still missing. Use for "ส่งเอกสารครบยัง" / "ขาดเอกสารอะไรบ้าง".',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_pending_document_requests',
    description: 'Get document requests across all students, for registrar staff. Admin only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter: pending, reviewing, approved, processing, ready, completed, rejected. Default pending.' },
        student_id: { type: 'string', description: 'Filter by one student.' },
        limit: { type: 'number', description: 'Number of results (default 20, max 100).' },
      },
      required: [],
    },
  },
]

/** สถานะที่ถือว่า "ส่งแล้ว" ตอนคิดว่ายังขาดเอกสารอะไร — ที่ไม่ผ่านยังนับว่าขาด */
const SUBMITTED = ['pending', 'reviewing', 'approved']

export async function executeDocumentTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  const studentId = ctx.studentData?.student_id

  if (name === 'get_document_types') {
    if (!can(ctx, 'document.view_own') && !can(ctx, 'document.view_all')) {
      return { error: 'Permission denied.' }
    }

    const kind = (input.kind as string) === 'upload' ? 'upload' : 'issue'
    const { data, error } = await (supabase as any)
      .from('document_types')
      .select('key, label, description, kind, fee, is_required, student_can_request, sort_order')
      .eq('kind', kind)
      .eq('active', true)
      .order('sort_order')

    if (error) return { error: error.message }
    return { kind, document_types: data ?? [], count: data?.length ?? 0 }
  }

  if (name === 'request_document') {
    if (!can(ctx, 'document.request')) {
      return { error: 'Permission denied: only students can request documents.' }
    }
    if (!studentId) {
      return { error: 'บัญชีนี้ไม่ได้ผูกกับนักเรียน จึงขอเอกสารไม่ได้' }
    }
    if (input.confirmed !== true) {
      return { error: 'ยังไม่ได้ยืนยัน — สรุปประเภทเอกสาร จำนวนชุด ค่าธรรมเนียม และวิธีรับให้ผู้ใช้ยืนยันก่อน แล้วจึงเรียกใหม่พร้อม confirmed=true' }
    }

    const copies = Math.min(Math.max(Math.round((input.copies as number) || 1), 1), MAX_COPIES)
    const deliveryMode = (input.delivery_mode as string) === 'delivery' ? 'delivery' : 'pickup'
    const deliveryNote = (input.delivery_note as string)?.trim() || null
    if (deliveryMode === 'delivery' && !deliveryNote) {
      return { error: 'เลือกให้ส่งต้องระบุที่อยู่หรือวิธีส่งใน delivery_note' }
    }

    const { data: type } = await (supabase as any)
      .from('document_types')
      .select('key, label, kind, active, fee, student_can_request')
      .eq('key', input.document_type as string)
      .maybeSingle()

    if (!type || !type.active || type.kind !== 'issue') {
      return { error: 'ประเภทเอกสารนี้ขอไม่ได้ ลองเรียก get_document_types เพื่อดูรายการที่ขอได้' }
    }
    // บางอย่างนักเรียนขอเองไม่ได้ เช่นใบจบการศึกษา ต้องให้ฝ่ายทะเบียนออกให้
    if (!type.student_can_request) {
      return { error: `${type.label} ต้องให้ฝ่ายทะเบียนเป็นผู้ออกให้ ติดต่อที่ห้องทะเบียน` }
    }

    // ค่าธรรมเนียมคิดจากตารางประเภทเสมอ ไม่ใช่จากค่าที่ผู้ใช้บอกในแชต
    const fee = Number(type.fee ?? 0) * copies

    const { data, error } = await (supabase as any)
      .from('document_requests')
      .insert({
        request_code: generateRequestCode(),
        student_id: studentId,
        document_type: type.key,
        copies,
        purpose: (input.purpose as string)?.trim() || null,
        delivery_mode: deliveryMode,
        delivery_note: deliveryNote,
        status: 'pending',
        fee,
      })
      .select('id, request_code')
      .single()

    if (error) return { error: error.message }

    // ไทม์ไลน์เริ่มที่การยื่นคำขอ ให้ประวัติครบตั้งแต่ก้าวแรกเหมือนขอผ่านหน้าเว็บ
    await (supabase as any).from('document_request_history').insert({
      request_id: data.id,
      from_status: null,
      to_status: 'pending',
      note: 'ยื่นคำขอผ่าน AI',
      changed_by: studentId,
    })

    return {
      success: true,
      request_id: data.id,
      request_code: data.request_code,
      document: type.label,
      copies,
      fee,
      delivery_mode: deliveryMode,
      message: `ส่งคำขอแล้ว รหัส ${data.request_code} — ติดตามสถานะได้ที่ /my-documents`,
    }
  }

  if (name === 'get_my_document_requests') {
    if (!can(ctx, 'document.view_own')) return { error: 'Permission denied.' }
    if (!studentId) return { error: 'บัญชีนี้ไม่ได้ผูกกับนักเรียน จึงไม่มีคำขอเอกสาร' }

    const limit = Math.min((input.limit as number) || 5, 20)
    let q = (supabase as any)
      .from('document_requests')
      .select('request_code, document_type, copies, purpose, delivery_mode, status, fee, paid_at, issued_file_url, admin_note, completed_at, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (input.status) q = q.eq('status', input.status as string)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { requests: data ?? [], count: data?.length ?? 0 }
  }

  if (name === 'get_my_documents') {
    if (!can(ctx, 'document.view_own')) return { error: 'Permission denied.' }
    if (!studentId) return { error: 'บัญชีนี้ไม่ได้ผูกกับนักเรียน จึงไม่มีแฟ้มเอกสาร' }

    const [types, docs] = await Promise.all([
      (supabase as any)
        .from('document_types')
        .select('key, label, is_required, sort_order')
        .eq('kind', 'upload')
        .eq('active', true)
        .order('sort_order'),
      (supabase as any)
        .from('student_documents')
        .select('document_type, file_name, status, review_note, reviewed_at, source, created_at')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
    ])

    if (types.error || docs.error) return { error: types.error?.message ?? docs.error?.message }

    const submitted = new Set(
      (docs.data ?? [])
        .filter((d: any) => SUBMITTED.includes(d.status))
        .map((d: any) => d.document_type)
    )
    const missing = (types.data ?? [])
      .filter((t: any) => t.is_required && !submitted.has(t.key))
      .map((t: any) => t.label)

    return {
      documents: docs.data ?? [],
      missing_required: missing,
      // อัปโหลดผ่านแชตไม่ได้ ต้องไปหน้าแฟ้มเอกสาร
      upload_page: '/my-documents',
    }
  }

  if (name === 'get_pending_document_requests') {
    if (!can(ctx, 'document.view_all')) return { error: 'Permission denied: admin only.' }

    const status = (input.status as string) || 'pending'
    const limit = Math.min((input.limit as number) || 20, 100)

    let q = (supabase as any)
      .from('document_requests')
      .select('request_code, student_id, document_type, copies, delivery_mode, status, fee, paid_at, created_at')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (input.student_id) q = q.eq('student_id', input.student_id as string)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { requests: data ?? [], count: data?.length ?? 0, status }
  }

  return { error: `Unknown tool: ${name}` }
}
