import { NextRequest, NextResponse } from 'next/server'
import { supabaseDemo as supabase } from '@/lib/supabase-demo'

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId')
  if (!storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('qq_menu_items')
    .select('*')
    .eq('store_id', parseInt(storeId))
    .order('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { id, is_available } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('qq_menu_items')
    .update({ is_available })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
