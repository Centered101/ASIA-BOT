import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'

export const dashboardTools = [
  {
    name: 'get_school_stats',
    description: 'Get school-wide statistics: today\'s attendance count, pending bookings, open feedback, active orders. Admin/executive only.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_school_info',
    description: 'Get general information about ASIA Technology and Innovation School.',
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: { type: 'string', description: 'Topic: general, programs, departments, contact (optional).' },
      },
      required: [],
    },
  },
]

export async function executeDashboardTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  if (name === 'get_school_stats') {
    if (!can(ctx, 'dashboard.view')) {
      return { error: 'Permission denied: admin/executive access required.' }
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    const todayStart = `${today}T00:00:00+07:00`
    const todayEnd = `${today}T23:59:59+07:00`

    const [entryRes, bookingRes, feedbackRes, orderRes, studentRes] = await Promise.all([
      (supabase as any)
        .from('entry_logs')
        .select('id', { count: 'exact', head: true })
        .eq('action', 'in')
        .gte('scanned_at', todayStart)
        .lte('scanned_at', todayEnd),
      (supabase as any)
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      (supabase as any)
        .from('feedback')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      (supabase as any)
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'paid']),
      (supabase as any)
        .from('students')
        .select('id', { count: 'exact', head: true }),
    ])

    return {
      date: today,
      today_entries: entryRes.count ?? 0,
      pending_bookings: bookingRes.count ?? 0,
      pending_feedback: feedbackRes.count ?? 0,
      active_orders: orderRes.count ?? 0,
      total_students: studentRes.count ?? 0,
    }
  }

  if (name === 'get_school_info') {
    const topic = (input.topic as string) || 'general'

    const info: Record<string, unknown> = {
      general: {
        name: 'โรงเรียน ASIA เทคโนโลยีและนวัตกรรม',
        name_en: 'ASIA Technology and Innovation School',
        system: 'ASIA-BOT — AI Operating System สำหรับโรงเรียน',
        features: ['ระบบสแกนบัตร RFID', 'จองห้องเรียน', 'สหกรณ์', 'ตารางเรียน', 'ฟีดแบ็ก'],
      },
      programs: {
        programs: ['ปวช (ประกาศนียบัตรวิชาชีพ)', 'ปวส (ประกาศนียบัตรวิชาชีพชั้นสูง)'],
        note: 'ดูรายละเอียดสาขาวิชาได้ที่หน้าเว็บไซต์หลัก',
      },
    }

    return info[topic] ?? info['general']
  }

  return { error: `Unknown tool: ${name}` }
}
