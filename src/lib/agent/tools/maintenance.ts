import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'
import {
  MAINTENANCE_STATUS_TH,
  MAINTENANCE_URGENCY_TH,
  OPEN_STATUSES,
  generateRequestCode,
  targetError,
} from '@/lib/server/maintenance'
import { buildMaintenanceRequestFlexMessage, sendLineFlexMessage } from '@/lib/line'
import { getLineNotificationTarget } from '@/lib/line-targets'

/**
 * แจ้งซ่อมผ่านแชต (0015)
 *
 * ตรรกะทั้งหมดยืมจาก /api/maintenance เพื่อให้แจ้งผ่านบอทกับแจ้งผ่านหน้าเว็บ
 * ได้ผลเหมือนกัน: รหัสคำขอรูปแบบเดียวกัน ไทม์ไลน์เริ่มที่ reported เหมือนกัน
 * และยิง LINE เข้ากลุ่มฝ่ายอาคารเหมือนกัน — งานซ่อมที่ไม่มีใครเห็นเท่ากับ
 * ไม่ได้แจ้ง และฝ่ายอาคารไม่ควรต้องเปิดสองที่เพื่อดูงานที่มาจากคนละทาง
 *
 * แชตแนบรูปไม่ได้ จึงไม่รับ photo_urls — เคสที่ต้องมีรูปให้ชี้ไป
 * /maintenance-request
 *
 * ตัวที่ต้องอ้าง FK (ครุภัณฑ์รายชิ้น อุปกรณ์ในคลัง) ยังไม่เปิดให้แจ้งผ่านแชต
 * เพราะต้องเลือกจากรายการจริงถึงจะได้ id ที่ถูกตัว — บอทรับได้แค่ห้องกับ
 * "อื่น ๆ" ซึ่งพิมพ์ชื่อได้ตรง ๆ
 */

const CATEGORIES = [
  'ไฟฟ้า', 'ประปา', 'แอร์', 'โครงสร้าง',
  'เฟอร์นิเจอร์', 'อุปกรณ์', 'คอมพิวเตอร์', 'อื่นๆ',
]
const URGENCIES = ['low', 'normal', 'high', 'critical']

export const maintenanceTools = [
  {
    name: 'create_maintenance_request',
    description:
      'Report something broken to the buildings team (แจ้งซ่อม) — a light, an air conditioner, a leaking tap, a broken chair. Ask for what is broken, where, and the symptom before calling. Use submit_feedback instead for opinions or non-repair problems.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_kind: { type: 'string', description: '"room" when a room itself is broken, otherwise "other". Default "other".' },
        room_name: { type: 'string', description: 'Room name when target_kind is "room" (matched against the room list).' },
        target_label: { type: 'string', description: 'What is broken, e.g. "โต๊ะตัวที่สามในห้อง 302". Required when target_kind is "other".' },
        location_note: { type: 'string', description: 'Where it is, e.g. "อาคาร 3 ชั้น 2".' },
        category: { type: 'string', description: `One of: ${CATEGORIES.join(', ')}. Default อื่นๆ.` },
        symptom: { type: 'string', description: 'What is wrong (required).' },
        urgency: { type: 'string', description: `One of: ${URGENCIES.join(', ')}. Default normal. Use "critical" only for danger (สายไฟช็อต น้ำรั่วท่วม).` },
        confirmed: { type: 'boolean', description: 'Must be true. Set only after the user confirms the summary.' },
      },
      required: ['symptom', 'confirmed'],
    },
  },
  {
    name: 'get_my_maintenance_requests',
    description: 'Get the maintenance requests reported by the current user, with status and assigned technician.',
    input_schema: {
      type: 'object' as const,
      properties: {
        open_only: { type: 'boolean', description: 'If true, only jobs that are not finished yet (default false).' },
        limit: { type: 'number', description: 'Number of results (default 5, max 20).' },
      },
      required: [],
    },
  },
  {
    name: 'get_open_maintenance_requests',
    description: 'Get maintenance jobs across the whole school with a per-status summary. Staff / admin only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by one status: reported, received, inspecting, assigned, repairing, waiting_inspection, completed, cancelled.' },
        urgency: { type: 'string', description: `Filter by urgency: ${URGENCIES.join(', ')}.` },
        limit: { type: 'number', description: 'Number of results (default 20, max 100).' },
      },
      required: [],
    },
  },
]

const SELECT_COLUMNS =
  'request_code, target_kind, target_label, location_note, category, symptom, urgency, status, assigned_to, scheduled_on, completed_at, created_at, rooms(name)'

/** เติมคำแปลไทยให้ทุกแถว โมเดลจะได้ตอบเป็นคำที่ผู้ใช้เห็นในหน้าเว็บ ไม่ใช่ค่าดิบ */
function withThaiLabels(rows: any[]) {
  return (rows ?? []).map(r => ({
    ...r,
    status_th: MAINTENANCE_STATUS_TH[r.status as keyof typeof MAINTENANCE_STATUS_TH] ?? r.status,
    urgency_th: MAINTENANCE_URGENCY_TH[r.urgency as keyof typeof MAINTENANCE_URGENCY_TH] ?? r.urgency,
  }))
}

export async function executeMaintenanceTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  const studentId = ctx.studentData?.student_id ?? null
  const adminId = ctx.adminData?.admin_id ?? null

  if (name === 'create_maintenance_request') {
    if (!can(ctx, 'maintenance.create')) {
      return { error: 'Permission denied: ต้องเข้าสู่ระบบก่อนจึงจะแจ้งซ่อมได้' }
    }
    if (input.confirmed !== true) {
      return { error: 'ยังไม่ได้ยืนยัน — สรุปสิ่งที่เสีย สถานที่ อาการ และความเร่งด่วนให้ผู้ใช้ยืนยันก่อน แล้วจึงเรียกใหม่พร้อม confirmed=true' }
    }

    const symptom = (input.symptom as string)?.trim()
    if (!symptom) return { error: 'ต้องระบุอาการเสีย' }

    const category = CATEGORIES.includes(input.category as string) ? (input.category as string) : 'อื่นๆ'
    const urgency = URGENCIES.includes(input.urgency as string) ? (input.urgency as string) : 'normal'
    const targetKind = (input.target_kind as string) === 'room' ? 'room' : 'other'

    // ห้องต้องอ้างด้วย id แต่ผู้ใช้พูดเป็นชื่อ จึงหาให้ก่อน หาไม่เจอก็ตกไปเป็น
    // "อื่น ๆ" พร้อมชื่อที่พิมพ์มา ดีกว่าปฏิเสธคำแจ้งซ่อมทิ้ง
    let roomId: string | null = null
    const roomName = (input.room_name as string)?.trim()
    if (targetKind === 'room' && roomName) {
      const { data: room } = await (supabase as any)
        .from('rooms')
        .select('id, name')
        .ilike('name', `%${roomName}%`)
        .limit(1)
        .maybeSingle()
      roomId = room?.id ?? null
    }

    const resolvedKind = roomId ? 'room' : 'other'
    const targetLabel =
      (input.target_label as string)?.trim() || (resolvedKind === 'other' ? roomName || null : null)

    const problem = targetError({ target_kind: resolvedKind as any, room_id: roomId, target_label: targetLabel })
    if (problem) return { error: problem }

    const reporterName = ctx.studentData
      ? `${ctx.studentData.first_name} ${ctx.studentData.last_name}`.trim()
      : ctx.displayName

    const requestCode = generateRequestCode()
    const { data, error } = await (supabase as any)
      .from('maintenance_requests')
      .insert({
        request_code: requestCode,
        reporter_name: reporterName,
        reporter_student_id: studentId,
        reporter_admin_id: adminId,
        target_kind: resolvedKind,
        room_id: roomId,
        target_label: targetLabel,
        location_note: (input.location_note as string)?.trim() || null,
        category,
        symptom,
        urgency,
        status: 'reported',
      })
      .select('id, request_code')
      .single()

    if (error) return { error: error.message }

    // ไทม์ไลน์เริ่มต้นที่การแจ้ง เหมือนแจ้งผ่านหน้าเว็บ
    await (supabase as any).from('maintenance_status_history').insert({
      request_id: data.id,
      from_status: null,
      to_status: 'reported',
      note: 'แจ้งเข้าระบบผ่าน AI',
      changed_by: studentId ?? adminId,
    })

    // LINE ล่มไม่ควรทำให้ผู้ใช้คิดว่าแจ้งไม่สำเร็จแล้วกดซ้ำจนได้งานซ้ำ
    try {
      const targetName = roomId ? `ห้อง ${roomName}` : targetLabel || 'ไม่ระบุ'
      await sendLineFlexMessage(
        await getLineNotificationTarget(supabase, 'maintenance'),
        `${urgency === 'critical' ? '🚨' : '🔧'} แจ้งซ่อมใหม่: ${targetName} — ${MAINTENANCE_URGENCY_TH[urgency as keyof typeof MAINTENANCE_URGENCY_TH]}`,
        buildMaintenanceRequestFlexMessage({
          requestCode,
          targetName,
          category,
          symptom,
          urgency: urgency as any,
          reporterName,
          reporterPhone: null,
          locationNote: (input.location_note as string)?.trim() || null,
          affectedQuantity: null,
          photoUrl: null,
        })
      )
    } catch (e) {
      console.error('[LINE] maintenance notify failed:', e)
    }

    return {
      success: true,
      request_id: data.id,
      request_code: data.request_code,
      category,
      urgency,
      message: `แจ้งซ่อมสำเร็จ รหัส ${data.request_code} — ติดตามสถานะได้ที่ /maintenance-request`,
    }
  }

  if (name === 'get_my_maintenance_requests') {
    if (!can(ctx, 'maintenance.view_own') && !can(ctx, 'maintenance.view_all')) {
      return { error: 'Permission denied.' }
    }
    if (!studentId && !adminId) return { error: 'ต้องเข้าสู่ระบบก่อนจึงจะดูคำขอแจ้งซ่อมได้' }

    const limit = Math.min((input.limit as number) || 5, 20)
    let q = (supabase as any)
      .from('maintenance_requests')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit)

    q = studentId ? q.eq('reporter_student_id', studentId) : q.eq('reporter_admin_id', adminId)
    if (input.open_only === true) q = q.in('status', OPEN_STATUSES)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { requests: withThaiLabels(data), count: data?.length ?? 0 }
  }

  if (name === 'get_open_maintenance_requests') {
    if (!can(ctx, 'maintenance.view_all')) return { error: 'Permission denied: admin only.' }

    const limit = Math.min((input.limit as number) || 20, 100)
    let q = (supabase as any)
      .from('maintenance_requests')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (input.status) q = q.eq('status', input.status as string)
    else q = q.in('status', OPEN_STATUSES)
    if (input.urgency) q = q.eq('urgency', input.urgency as string)

    const { data, error } = await q
    if (error) return { error: error.message }

    // สรุปยอดต่อสถานะจากแถวที่ดึงมา ผู้บริหารถามว่า "ค้างกี่งาน" มากกว่าจะไล่อ่านทีละงาน
    const byStatus: Record<string, number> = {}
    for (const row of data ?? []) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1

    return { requests: withThaiLabels(data), count: data?.length ?? 0, by_status: byStatus }
  }

  return { error: `Unknown tool: ${name}` }
}
