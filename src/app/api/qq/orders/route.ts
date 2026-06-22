import { NextRequest, NextResponse } from 'next/server'
import { supabaseDemo as supabase } from '@/lib/supabase-demo'

export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId')

  const { data: orders, error } = await supabase
    .from('qq_orders')
    .select('*, qq_order_items(*), qq_store_order_status(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter to orders that have items from the requested store
  const filtered = storeId
    ? orders.filter((o: { qq_order_items: { store_id: number }[] }) =>
        o.qq_order_items.some((item: { store_id: number }) => item.store_id === parseInt(storeId))
      )
    : orders

  return NextResponse.json(filtered)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { table_num, customer_name, notes, items, total } = body

  if (!table_num || !items?.length) {
    return NextResponse.json({ error: 'table_num and items required' }, { status: 400 })
  }

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('qq_orders')
    .insert({ table_num, customer_name: customer_name || '-', notes: notes || '-', total })
    .select()
    .single()

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  // Insert order items
  const orderItems = items.map((item: {
    storeId: number; name: string; price: number; quantity: number; image?: string
  }) => ({
    order_id: order.id,
    store_id: item.storeId,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity,
    image: item.image || '',
  }))

  const { error: itemsError } = await supabase.from('qq_order_items').insert(orderItems)
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })

  // Create per-store status entries
  const storeIds = [...new Set(items.map((i: { storeId: number }) => i.storeId))]
  const storeStatuses = storeIds.map((storeId) => ({
    order_id: order.id,
    store_id: storeId,
    status: 'pending',
  }))

  const { error: statusError } = await supabase.from('qq_store_order_status').insert(storeStatuses)
  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 })

  return NextResponse.json({ success: true, orderId: order.id })
}
