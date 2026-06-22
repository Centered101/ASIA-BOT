import { NextRequest, NextResponse } from 'next/server'
import { supabaseDemo as supabase } from '@/lib/supabase-demo'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { storeId, status } = await req.json()

  if (!storeId || !status) {
    return NextResponse.json({ error: 'storeId and status required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('qq_store_order_status')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('order_id', id)
    .eq('store_id', storeId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
