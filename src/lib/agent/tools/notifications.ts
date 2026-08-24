import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'

/**
 * กล่องแจ้งเตือนรายบุคคล (0022) ฝั่งของบอท
 *
 * กล่องผูกกับ account ไม่ใช่ student_id/admin_id เพราะคนคนเดียวอาจมีหลาย
 * profile แต่ควรเห็นกล่องเดียว บอทจึงต้องแปลงรหัสที่ตัวเองรู้จักเป็น account
 * ก่อนทุกครั้ง — ไม่มี account = ยังไม่เคยผูกบัญชี ไม่ใช่ error
 *
 * ไม่ผูกกับ permission ใด ๆ เพราะทุกคนอ่านได้เฉพาะกล่องของตัวเองอยู่แล้ว
 * (กรองด้วย account_id ที่หาจาก ctx ไม่ใช่จาก input) และไม่มี tool ไหน
 * ให้ระบุ account ของคนอื่นได้
 */

async function resolveAccountId(ctx: UserContext, supabase: SupabaseClient): Promise<string | null> {
  if (ctx.studentData?.student_id) {
    const { data } = await (supabase as any)
      .from('students')
      .select('account_id')
      .eq('student_id', ctx.studentData.student_id)
      .maybeSingle()
    if (data?.account_id) return data.account_id
  }
  if (ctx.adminData?.admin_id) {
    const { data } = await (supabase as any)
      .from('admins')
      .select('account_id')
      .eq('admin_id', ctx.adminData.admin_id)
      .maybeSingle()
    if (data?.account_id) return data.account_id
  }
  return null
}

export const notificationTools = [
  {
    name: 'get_my_notifications',
    description:
      'Get the current user\'s in-app notifications (approvals, document status, attendance alerts, announcements). Use for "มีแจ้งเตือนอะไรบ้าง" / "มีอะไรใหม่".',
    input_schema: {
      type: 'object' as const,
      properties: {
        only_unread: { type: 'boolean', description: 'If true, only unread notifications (default true).' },
        category: { type: 'string', description: 'Filter by category key: booking, document, attendance, maintenance, equipment, order, feedback, academic, finance, activity, library, health, admin, broadcast.' },
        limit: { type: 'number', description: 'Number of results (default 10, max 30).' },
      },
      required: [],
    },
  },
  {
    name: 'mark_notifications_read',
    description: 'Mark the current user\'s notifications as read. Ask before marking everything read.',
    input_schema: {
      type: 'object' as const,
      properties: {
        notification_ids: { type: 'array', items: { type: 'string' }, description: 'Notification UUIDs to mark read. Omit together with all=true to mark every unread one.' },
        all: { type: 'boolean', description: 'If true, mark every unread notification read.' },
      },
      required: [],
    },
  },
]

export async function executeNotificationTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  if (ctx.userType === 'guest') {
    return { error: 'ต้องเข้าสู่ระบบก่อนจึงจะดูแจ้งเตือนได้' }
  }

  const accountId = await resolveAccountId(ctx, supabase)
  if (!accountId) {
    return { error: 'บัญชีนี้ยังไม่ได้ผูกกับระบบบัญชีกลาง จึงยังไม่มีกล่องแจ้งเตือน' }
  }

  if (name === 'get_my_notifications') {
    const onlyUnread = input.only_unread !== false
    const limit = Math.min((input.limit as number) || 10, 30)

    let q = (supabase as any)
      .from('notifications')
      .select('id, category_key, title, body, link, priority, read_at, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (onlyUnread) q = q.is('read_at', null)
    if (input.category) q = q.eq('category_key', input.category as string)

    const { data, error } = await q
    if (error) return { error: error.message }

    // นับยังไม่อ่านทั้งกล่องแยกจากรายการที่ตัดมา ผู้ใช้ถามว่า "มีกี่อัน" บ่อยกว่าจะอ่านทีละอัน
    const { count } = await (supabase as any)
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .is('read_at', null)

    return {
      notifications: data ?? [],
      count: data?.length ?? 0,
      unread_total: count ?? 0,
      only_unread: onlyUnread,
    }
  }

  if (name === 'mark_notifications_read') {
    const ids = Array.isArray(input.notification_ids)
      ? (input.notification_ids as unknown[]).map(String).filter(Boolean)
      : []
    if (ids.length === 0 && input.all !== true) {
      return { error: 'ระบุ notification_ids หรือ all=true อย่างใดอย่างหนึ่ง' }
    }

    let q = (supabase as any)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      // กรองด้วย account ของผู้ใช้เสมอ ต่อให้ id ที่ส่งมาเป็นของคนอื่นก็ไม่โดน
      .eq('account_id', accountId)
      .is('read_at', null)

    if (ids.length > 0) q = q.in('id', ids)

    const { data, error } = await q.select('id')
    if (error) return { error: error.message }
    return { success: true, marked: data?.length ?? 0 }
  }

  return { error: `Unknown tool: ${name}` }
}
