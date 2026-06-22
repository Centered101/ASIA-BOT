import { NextRequest, NextResponse } from 'next/server'
import { supabaseDemo as supabase } from '@/lib/supabase-demo'

export async function GET(req: NextRequest) {
  const categoryId = req.nextUrl.searchParams.get('categoryId')

  let query = supabase.from('qman_shops').select('*').order('id')
  if (categoryId) query = query.eq('category_id', parseInt(categoryId))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
