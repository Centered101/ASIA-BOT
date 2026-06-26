import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'

export const documentTools = [
  {
    name: 'list_documents',
    description: 'แสดงรายชื่อเอกสาร PDF ที่มีอยู่ในระบบ เรียกใช้ก่อนเมื่อผู้ใช้ถามว่ามีเอกสารอะไรบ้าง',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'จำนวนสูงสุดที่จะแสดง (ค่าเริ่มต้น 10)' },
      },
      required: [],
    },
  },
  {
    name: 'search_documents',
    description: 'ค้นหาข้อมูลในเอกสาร PDF โดยใช้คำค้นหา และส่งคืนเนื้อหาที่เกี่ยวข้องสำหรับสรุปตอบคำถาม',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'คำค้นหาหรือคำถามที่ต้องการค้นหาในเอกสาร' },
        document_id: { type: 'string', description: 'จำกัดการค้นหาเฉพาะเอกสารนี้ (UUID, ไม่บังคับ)' },
        limit: { type: 'number', description: 'จำนวน chunk สูงสุด (ค่าเริ่มต้น 6, สูงสุด 10)' },
      },
      required: ['query'],
    },
  },
]

export async function executeDocumentTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  if (ctx.role === 'guest') {
    return { error: 'กรุณาเชื่อมต่อบัญชีก่อนใช้งานเอกสารครับ/ค่ะ' }
  }

  if (name === 'list_documents') {
    const limit = Math.min((input.limit as number) || 10, 30)

    const { data, error } = await (supabase as any)
      .from('pdf_documents')
      .select('id, name, description, upload_source, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return { error: error.message }
    return {
      count: data?.length ?? 0,
      documents: (data ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        description: d.description ?? '',
        uploaded_at: d.created_at,
      })),
    }
  }

  if (name === 'search_documents') {
    const query = (input.query as string)?.trim()
    if (!query) return { error: 'กรุณาระบุคำค้นหา' }

    const limit = Math.min((input.limit as number) || 6, 10)
    const documentId = input.document_id as string | undefined

    const words = query
      .split(/\s+/)
      .filter((w: string) => w.length > 1)
      .slice(0, 5)

    const buildQuery = (isPublic: boolean, ownerId?: string) => {
      let q = (supabase as any)
        .from('pdf_chunks')
        .select('content, chunk_index, document_id, pdf_documents!inner(id, name, is_public, uploaded_by)')
        .limit(limit)

      if (documentId) q = q.eq('document_id', documentId)

      if (isPublic) {
        q = q.eq('pdf_documents.is_public', true)
      } else if (ownerId) {
        q = q.eq('pdf_documents.uploaded_by', ownerId)
      }

      if (words.length > 0) {
        q = q.or(words.map((w: string) => `content.ilike.%${w}%`).join(','))
      } else {
        q = q.ilike('content', `%${query}%`)
      }

      return q
    }

    const [publicResult, privateResult] = await Promise.all([
      buildQuery(true),
      ctx.channel === 'line'
        ? buildQuery(false, `line:${ctx.userId}`)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (publicResult.error) return { error: publicResult.error.message }

    const publicChunks = publicResult.data ?? []
    const privateChunks = privateResult.data ?? []

    // Merge and deduplicate by chunk id
    const seen = new Set<string>()
    const merged = [...publicChunks, ...privateChunks].filter((c: any) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    if (!merged.length) {
      return {
        found: false,
        message: `ไม่พบข้อมูลที่เกี่ยวกับ "${query}" ในเอกสาร`,
        chunks: [],
      }
    }

    return {
      found: true,
      query,
      chunk_count: merged.length,
      chunks: merged.map((c: any) => ({
        document_name: c.pdf_documents?.name ?? 'Unknown',
        document_id: c.document_id,
        content: c.content,
      })),
    }
  }

  return { error: `Unknown tool: ${name}` }
}
