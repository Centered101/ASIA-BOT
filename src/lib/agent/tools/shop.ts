import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'
import { notifyAiOrderCreated } from '../line-notify'

export const shopTools = [
  {
    name: 'place_order',
    description: 'Place a food/product order from the cooperative shop on behalf of the student. Call get_products first to confirm product IDs, names, and stock. Order will be created as "pending payment" — student must complete payment at the shop.',
    input_schema: {
      type: 'object' as const,
      properties: {
        items: {
          type: 'array',
          description: 'List of items to order.',
          items: {
            type: 'object',
            properties: {
              id:    { type: 'string', description: 'Product UUID if known.' },
              name:  { type: 'string', description: 'Product name.' },
              price: { type: 'number', description: 'Unit price (baht).' },
              qty:   { type: 'number', description: 'Quantity to order.' },
              unit:  { type: 'string', description: 'Unit label e.g. จาน, ชิ้น.' },
            },
            required: ['name', 'qty'],
          },
        },
        delivery_mode: { type: 'string', description: '"pickup" or "delivery" (default pickup).' },
        confirmed: { type: 'boolean', description: 'Must be true only after the student explicitly confirms the final order summary.' },
      },
      required: ['items'],
    },
  },
  {
    name: 'cancel_order',
    description: 'Cancel a pending order. Only orders with status "pending" can be cancelled.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_id: { type: 'string', description: 'Order ID (e.g. ORD-XXXXXXXX) from get_my_orders.' },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'get_my_orders',
    description: 'Get recent food/product orders from the cooperative shop for the current student.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Number of orders to return (default 3, max 10).' },
        status: { type: 'string', description: 'Filter by status: pending, paid, delivered, cancelled.' },
      },
      required: [],
    },
  },
  {
    name: 'get_products',
    description: 'List products available in the cooperative shop with prices and stock.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Filter by product category (optional).' },
        in_stock: { type: 'boolean', description: 'If true, only show in-stock items (default true).' },
      },
      required: [],
    },
  },
  {
    name: 'get_all_orders',
    description: 'Get all orders across all students. Cooperative staff / admin only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by status.' },
        limit: { type: 'number', description: 'Max results (default 20).' },
        date: { type: 'string', description: 'Filter by date YYYY-MM-DD (optional).' },
      },
      required: [],
    },
  },
]

const PROMPTPAY_PENDING_TTL_MS = 30 * 60 * 1000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function cancelExpiredPromptpayOrders(supabase: SupabaseClient, studentId?: string) {
  const cutoff = new Date(Date.now() - PROMPTPAY_PENDING_TTL_MS).toISOString()
  let q = (supabase as any)
    .from('orders')
    .select('order_id, items_json')
    .eq('status', 'pending')
    .not('pi_id', 'is', null)
    .lt('created_at', cutoff)

  if (studentId) q = q.eq('student_id', studentId)
  const { data: expired } = await q
  const rows = (expired ?? []) as { order_id: string; items_json?: { id: string; qty: number }[] | null }[]
  if (!rows.length) return

  await (supabase as any)
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .in('order_id', rows.map(row => row.order_id))
    .eq('status', 'pending')

  for (const row of rows) {
    const items = Array.isArray(row.items_json) ? row.items_json : []
    for (const item of items) {
      if (!item.id || !item.qty) continue
      const { data: prod } = await (supabase as any).from('products').select('stock').eq('id', item.id).maybeSingle()
      if (prod) await (supabase as any).from('products').update({ stock: Number(prod.stock ?? 0) + Number(item.qty) }).eq('id', item.id)
    }
  }
}

export async function executeShopTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  if (name === 'place_order') {
    if (!can(ctx, 'shop.view_own_orders')) return { error: 'Permission denied.' }
    if (input.confirmed !== true) {
      return {
        error: 'ยังไม่ได้รับการยืนยันจากผู้ใช้ ห้ามสร้างออเดอร์ ให้สรุปรายการ จำนวน ยอดรวม และถามยืนยันก่อน ถ้าผู้ใช้ตอบยืนยันแล้วค่อยเรียก place_order อีกครั้งพร้อม confirmed=true',
      }
    }

    const studentId   = ctx.studentData?.student_id || ctx.userId
    const studentName = ctx.studentData
      ? `${ctx.studentData.first_name} ${ctx.studentData.last_name}`.trim()
      : ctx.displayName

    type RequestedOrderItem = { id?: string; name?: string; price?: number; qty: number; unit?: string }
    type OrderItem = { id: string; name: string; price: number; qty: number; unit: string; imageUrl?: string | null }
    const requestedItems = input.items as RequestedOrderItem[]
    if (!requestedItems?.length) return { error: 'ไม่มีสินค้าในออเดอร์' }

    const items: OrderItem[] = []
    for (const item of requestedItems) {
      let itemName = String(item.name ?? '').trim()
      let itemId = String(item.id ?? '').trim()
      if (itemId && !UUID_RE.test(itemId)) {
        if (!itemName) itemName = itemId
        itemId = ''
      }
      if (!itemName && !itemId) return { error: 'กรุณาระบุชื่อสินค้า' }
      if (!Number(item.qty) || Number(item.qty) <= 0) return { error: `จำนวนสินค้า "${itemName || itemId}" ไม่ถูกต้อง` }

      let query = (supabase as any)
        .from('products')
        .select('id, stock, name, price, unit, images')
        .eq('active', true)
        .is('deleted_at', null)
        .limit(1)

      query = itemId ? query.eq('id', itemId) : query.ilike('name', itemName)

      const { data: rows, error: productError } = await query
      const prod = Array.isArray(rows) ? rows[0] : null
      if (productError) return { error: productError.message }
      if (!prod) return { error: `ไม่พบสินค้า "${itemName || itemId}"` }
      if ((prod.stock ?? 0) < item.qty) {
        return { error: `สินค้า "${prod.name}" มีเหลือ ${prod.stock} ชิ้น ไม่พอสำหรับ ${item.qty} ชิ้นที่สั่ง` }
      }
      items.push({
        id: prod.id,
        name: prod.name,
        price: Number(prod.price ?? item.price ?? 0),
        qty: Number(item.qty),
        unit: prod.unit ?? item.unit ?? 'ชิ้น',
        imageUrl: Array.isArray(prod.images) ? prod.images[0] ?? null : null,
      })
    }

    const total = items.reduce((s, i) => s + i.price * i.qty, 0)
    const deliveryMode = (input.delivery_mode as string) || 'pickup'

    return {
      success: true,
      payment_required: true,
      checkout: {
        items,
        delivery_mode: deliveryMode,
        delivery_loc: (input.delivery_loc as string) || 'สหกรณ์',
        delivery_slot: (input.delivery_slot as string) || 'รับเองที่สหกรณ์',
      },
      total,
      items_count: items.length,
      message: `ยืนยันรายการแล้ว ยอดสินค้า ฿${total} กำลังเปิดหน้าชำระเงิน PromptPay`,
    }
  }

  if (name === 'cancel_order') {
    if (!can(ctx, 'shop.view_own_orders') && !can(ctx, 'shop.view_all_orders')) {
      return { error: 'Permission denied.' }
    }

    const studentId = ctx.studentData?.student_id || ctx.userId
    const orderId   = input.order_id as string

    const { data: order } = await (supabase as any)
      .from('orders')
      .select('order_id, status, student_id, total')
      .eq('order_id', orderId)
      .maybeSingle()

    if (!order) return { error: 'ไม่พบออเดอร์นี้' }
    if (!can(ctx, 'shop.view_all_orders') && order.student_id !== studentId) {
      return { error: 'ไม่มีสิทธิ์ยกเลิกออเดอร์ของคนอื่น' }
    }
    if (order.status !== 'pending') {
      return { error: `ยกเลิกไม่ได้ ออเดอร์นี้มีสถานะ "${order.status}" แล้ว` }
    }

    const { error } = await (supabase as any)
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('order_id', orderId)

    if (error) return { error: error.message }
    return { success: true, message: `ยกเลิกออเดอร์ ${orderId} สำเร็จแล้ว` }
  }

  if (name === 'get_my_orders') {
    if (!can(ctx, 'shop.view_own_orders') && !can(ctx, 'shop.view_all_orders')) {
      return { error: 'Permission denied.' }
    }

    const studentId = ctx.studentData?.student_id || ctx.userId
    const limit = Math.min((input.limit as number) || 3, 10)
    await cancelExpiredPromptpayOrders(supabase, studentId)

    let q = (supabase as any)
      .from('orders')
      .select('order_id, items_json, total, status, delivery_mode, delivery_slot, created_at, updated_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (input.status) q = q.eq('status', input.status as string)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { orders: data ?? [], count: data?.length ?? 0 }
  }

  if (name === 'get_products') {
    if (!can(ctx, 'shop.view_products')) {
      return { error: 'Permission denied.' }
    }

    const inStock = input.in_stock !== false

    let q = (supabase as any)
      .from('products')
      .select('id, name, price, stock, unit, category, tag, images, active')
      .eq('active', true)
      .is('deleted_at', null)
      .order('name')

    if (inStock) q = q.gt('stock', 0)
    if (input.category) q = q.eq('category', input.category as string)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { products: data ?? [], count: data?.length ?? 0 }
  }

  if (name === 'get_all_orders') {
    if (!can(ctx, 'shop.view_all_orders')) {
      return { error: 'Permission denied: cooperative staff or admin only.' }
    }

    const limit = Math.min((input.limit as number) || 20, 100)
    await cancelExpiredPromptpayOrders(supabase)

    let q = (supabase as any)
      .from('orders')
      .select('order_id, student_name, items_json, total, status, delivery_mode, delivery_slot, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (input.status) q = q.eq('status', input.status as string)
    if (input.date) q = q.gte('created_at', `${input.date}T00:00:00`).lte('created_at', `${input.date}T23:59:59`)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { orders: data ?? [], count: data?.length ?? 0 }
  }

  return { error: `Unknown tool: ${name}` }
}
