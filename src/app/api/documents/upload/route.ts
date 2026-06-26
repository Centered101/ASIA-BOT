import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-auth'
import { extractTextFromPdf, chunkText } from '@/lib/pdf-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const BUCKET = 'pdf-documents'
const MAX_SIZE = 20 * 1024 * 1024

export async function POST(req: NextRequest) {
  const admin = await checkAdminAuth(req)
  if (!admin) return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  const name = (form.get('name') as string)?.trim()
  const description = (form.get('description') as string)?.trim() || null
  const isPublic = form.get('is_public') !== 'false'

  if (!file) return NextResponse.json({ status: 'error', message: 'ไม่พบไฟล์' }, { status: 400 })
  if (!name) return NextResponse.json({ status: 'error', message: 'กรุณาระบุชื่อเอกสาร' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'pdf') return NextResponse.json({ status: 'error', message: 'รองรับเฉพาะไฟล์ PDF' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ status: 'error', message: 'ไฟล์ต้องไม่เกิน 20MB' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  let chunks: string[]
  try {
    const text = await extractTextFromPdf(buffer)
    if (!text.trim()) return NextResponse.json({ status: 'error', message: 'ไม่สามารถอ่านข้อความจาก PDF นี้ได้' }, { status: 422 })
    chunks = chunkText(text)
  } catch {
    return NextResponse.json({ status: 'error', message: 'PDF เสียหายหรืออ่านไม่ได้' }, { status: 422 })
  }

  const path = `admin/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
  const { error: storageErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (storageErr) return NextResponse.json({ status: 'error', message: storageErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { data: doc, error: docErr } = await (supabase as any)
    .from('pdf_documents')
    .insert({ name, description, file_url: publicUrl, file_size: file.size, uploaded_by: `admin:${admin.admin_id}`, upload_source: 'admin', is_public: isPublic })
    .select('id')
    .single()
  if (docErr) return NextResponse.json({ status: 'error', message: docErr.message }, { status: 500 })

  const chunkRows = chunks.map((content, chunk_index) => ({ document_id: doc.id, chunk_index, content }))
  const { error: chunkErr } = await (supabase as any).from('pdf_chunks').insert(chunkRows)
  if (chunkErr) return NextResponse.json({ status: 'error', message: chunkErr.message }, { status: 500 })

  return NextResponse.json({ status: 'success', id: doc.id, chunk_count: chunks.length, url: publicUrl })
}

export async function DELETE(req: NextRequest) {
  const admin = await checkAdminAuth(req)
  if (!admin) return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json() as { id?: string }
  if (!id) return NextResponse.json({ status: 'error', message: 'ไม่พบ id' }, { status: 400 })

  const { data: doc } = await (supabase as any).from('pdf_documents').select('file_url').eq('id', id).single()
  if (doc?.file_url) {
    const marker = `/object/public/${BUCKET}/`
    const idx = doc.file_url.indexOf(marker)
    if (idx !== -1) {
      const storagePath = decodeURIComponent(doc.file_url.slice(idx + marker.length))
      await supabase.storage.from(BUCKET).remove([storagePath])
    }
  }

  const { error } = await (supabase as any).from('pdf_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
  return NextResponse.json({ status: 'success' })
}
