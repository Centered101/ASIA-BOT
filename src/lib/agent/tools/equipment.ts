import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'
import { notifyAiEquipmentRequestCreated } from '../line-notify'

const MAX_BORROW_QUANTITY = 6

function generateRequestCode() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `EQ-${today}-${suffix}`
}

export const equipmentTools = [
  {
    name: 'get_equipment_items',
    description: 'List equipment items available for borrowing with stock, category, department, and unit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Filter by equipment category (optional).' },
        in_stock: { type: 'boolean', description: 'If true, only show items with available quantity (default true).' },
      },
      required: [],
    },
  },
  {
    name: 'request_equipment',
    description: 'Create an equipment borrow request for the current student. Call get_equipment_items first to confirm equipment_item_id and stock.',
    input_schema: {
      type: 'object' as const,
      properties: {
        equipment_item_id: { type: 'string', description: 'Equipment item UUID from get_equipment_items.' },
        quantity: { type: 'number', description: `Quantity to borrow, max ${MAX_BORROW_QUANTITY}.` },
        purpose: { type: 'string', description: 'Reason for borrowing.' },
        borrow_date: { type: 'string', description: 'Borrow date in YYYY-MM-DD format.' },
        due_date: { type: 'string', description: 'Return date in YYYY-MM-DD format. Defaults to borrow_date.' },
        delivery_mode: { type: 'string', description: '"pickup" or "delivery". Default pickup.' },
        delivery_loc: { type: 'string', description: 'Required if delivery_mode is delivery.' },
        time_slot: { type: 'string', description: 'Pickup/delivery time slot text.' },
      },
      required: ['equipment_item_id', 'quantity', 'purpose', 'borrow_date', 'time_slot'],
    },
  },
  {
    name: 'get_my_equipment_requests',
    description: 'Get recent equipment borrow requests for the current student.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by status: pending, approved, picked_up, rejected, cancelled, returned.' },
        limit: { type: 'number', description: 'Number of results (default 5, max 20).' },
      },
      required: [],
    },
  },
  {
    name: 'get_all_equipment_requests',
    description: 'Get equipment borrow requests across all students, with a per-status summary. Staff / admin only. Use for questions like "how many pending requests are there" or "who borrowed the drill".',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by status: pending, approved, picked_up, rejected, cancelled, returned.' },
        student_id: { type: 'string', description: 'Filter by one student.' },
        overdue: { type: 'boolean', description: 'If true, only requests past due_date that are not returned yet.' },
        limit: { type: 'number', description: 'Number of results (default 20, max 100).' },
      },
      required: [],
    },
  },
]

export async function executeEquipmentTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  if (name === 'get_equipment_items') {
    if (!can(ctx, 'equipment.view_items')) return { error: 'Permission denied.' }

    const inStock = input.in_stock !== false
    let q = (supabase as any)
      .from('equipment_items')
      .select('id, name, category, department, unit, total_quantity, available_quantity, image_url, active')
      .eq('active', true)
      .is('deleted_at', null)
      .order('category')
      .order('name')

    if (inStock) q = q.gt('available_quantity', 0)
    if (input.category) q = q.eq('category', input.category as string)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { equipment_items: data ?? [], count: data?.length ?? 0 }
  }

  if (name === 'request_equipment') {
    if (!can(ctx, 'equipment.create_request')) return { error: 'Permission denied.' }

    const studentId = ctx.studentData?.student_id || ctx.userId
    const studentName = ctx.studentData
      ? `${ctx.studentData.first_name} ${ctx.studentData.last_name}`.trim()
      : ctx.displayName

    const equipmentItemId = String(input.equipment_item_id ?? '').trim()
    const quantity = Number(input.quantity)
    const purpose = String(input.purpose ?? '').trim()
    const borrowDate = String(input.borrow_date ?? '').trim()
    const dueDate = String(input.due_date || input.borrow_date || '').trim()
    const timeSlot = String(input.time_slot ?? '').trim()
    const deliveryMode = input.delivery_mode === 'delivery' ? 'delivery' : 'pickup'
    const deliveryLoc = deliveryMode === 'delivery'
      ? String(input.delivery_loc ?? '').trim()
      : 'คุรุภัณฑ์'

    if (!equipmentItemId || !quantity || !purpose || !borrowDate || !timeSlot) {
      return { error: 'กรุณาระบุคุรุภัณฑ์ จำนวน เหตุผล วันที่ และช่วงเวลาให้ครบ' }
    }
    if (quantity <= 0) return { error: 'จำนวนต้องมากกว่า 0' }
    if (quantity > MAX_BORROW_QUANTITY) return { error: `เบิกได้ไม่เกิน ${MAX_BORROW_QUANTITY} ชิ้นต่อคำขอ` }
    if (deliveryMode === 'delivery' && !deliveryLoc) return { error: 'กรุณาระบุสถานที่รับ-ส่ง' }
    if (!ctx.studentData?.department?.trim()) return { error: 'บัญชีนี้ยังไม่มีข้อมูลสาขาวิชา กรุณาแก้ไขข้อมูลส่วนตัวก่อน' }

    const { data: item } = await (supabase as any)
      .from('equipment_items')
      .select('id, name, unit, active, deleted_at, available_quantity, image_url')
      .eq('id', equipmentItemId)
      .maybeSingle()
    if (!item || !item.active || item.deleted_at) return { error: 'ไม่พบคุรุภัณฑ์ที่เลือก' }
    if (quantity > Number(item.available_quantity ?? 0)) {
      return { error: `คุรุภัณฑ์คงเหลือไม่พอ: ${item.name}` }
    }

    const requestCode = generateRequestCode()
    const requesterPhone = (ctx.studentData as { student_phone?: string | null } | undefined)?.student_phone ?? null
    const { data, error } = await (supabase as any)
      .from('equipment_requests')
      .insert({
        request_code: requestCode,
        equipment_item_id: equipmentItemId,
        student_id: studentId,
        department: ctx.studentData.department.trim(),
        requester_name: studentName,
        requester_phone: requesterPhone,
        quantity,
        purpose,
        borrow_date: borrowDate,
        due_date: dueDate,
        delivery_mode: deliveryMode,
        delivery_loc: deliveryLoc,
        time_slot: timeSlot,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    await notifyAiEquipmentRequestCreated(supabase, ctx, {
      requestCode,
      itemName: item.name,
      itemImageUrl: item.image_url,
      quantity,
      unit: item.unit,
      borrowDate,
      dueDate,
      purpose,
      requesterPhone,
      department: ctx.studentData.department,
    })

    return {
      success: true,
      request_id: data?.id,
      request_code: requestCode,
      item_name: item.name,
      message: `ส่งคำขอเบิก ${item.name} สำเร็จแล้ว รหัสคำขอ ${requestCode} รอผู้ดูแลอนุมัติ`,
    }
  }

  if (name === 'get_my_equipment_requests') {
    if (!can(ctx, 'equipment.view_own_requests')) return { error: 'Permission denied.' }

    const studentId = ctx.studentData?.student_id || ctx.userId
    const limit = Math.min((input.limit as number) || 5, 20)

    let q = (supabase as any)
      .from('equipment_requests')
      .select('id, request_code, quantity, purpose, borrow_date, due_date, delivery_mode, delivery_loc, time_slot, status, admin_note, created_at, equipment_items(name, unit, category)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (input.status) q = q.eq('status', input.status as string)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { equipment_requests: data ?? [], count: data?.length ?? 0 }
  }

  if (name === 'get_all_equipment_requests') {
    if (!can(ctx, 'equipment.view_all_requests')) {
      return { error: 'Permission denied: staff or admin only.' }
    }

    const limit = Math.min((input.limit as number) || 20, 100)

    let q = (supabase as any)
      .from('equipment_requests')
      .select('id, request_code, student_id, requester_name, department, quantity, purpose, borrow_date, due_date, returned_at, delivery_mode, delivery_loc, time_slot, status, admin_note, reviewed_by, created_at, equipment_items(name, unit, category)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (input.status) q = q.eq('status', input.status as string)
    if (input.student_id) q = q.eq('student_id', String(input.student_id).trim())

    // เกินกำหนดคืน = เลยวันครบกำหนดแล้วแต่ยังไม่คืน สถานะที่ยังถือของอยู่จริง
    // มีแค่ approved กับ picked_up ส่วน returned/rejected/cancelled จบไปแล้ว
    if (input.overdue === true) {
      const today = new Date().toISOString().slice(0, 10)
      q = q.lt('due_date', today).is('returned_at', null).in('status', ['approved', 'picked_up'])
    }

    const { data, error } = await q
    if (error) return { error: error.message }

    const rows = data ?? []

    // สรุปยอดตามสถานะ เพราะคำถามที่ถามบ่อยที่สุดคือ "ค้างอนุมัติกี่รายการ"
    // ซึ่งตอบจากยอดรวมได้เลย ไม่ต้องให้โมเดลไปนับรายการเอง
    const by_status: Record<string, number> = {}
    for (const r of rows as { status?: string }[]) {
      const key = r.status ?? 'unknown'
      by_status[key] = (by_status[key] ?? 0) + 1
    }

    return {
      equipment_requests: rows,
      count: rows.length,
      by_status,
      // เตือนว่ายอดถูกตัดที่ limit เพื่อไม่ให้โมเดลรายงานว่า "ทั้งหมด N รายการ"
      // ทั้งที่จริงมีมากกว่านั้น
      truncated: rows.length === limit,
    }
  }

  return { error: `Unknown tool: ${name}` }
}
