import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const admin = await checkAdminAuth(req)
  if (!admin) return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 })

  const { data, error } = await (supabase as any)
    .from('pdf_documents')
    .select('id, name, description, file_url, file_size, uploaded_by, upload_source, is_public, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ status: 'error', message: error.message }, { status: 500 })
  return NextResponse.json({ status: 'success', data: data ?? [] })
}
