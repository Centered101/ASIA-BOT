import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'

export const attendanceTools = [
  {
    name: 'get_attendance_status',
    description: 'Get entry/exit records for a student. Can filter by a specific date (YYYY-MM-DD) to look back in time. Shows current status (inside/outside) when no date is given.',
    input_schema: {
      type: 'object' as const,
      properties: {
        student_id: { type: 'string', description: 'Student ID. Leave empty to use current user.' },
        date: { type: 'string', description: 'Specific date YYYY-MM-DD. Leave empty for most recent records.' },
        limit: { type: 'number', description: 'Number of records (default 5, max 20).' },
      },
      required: [],
    },
  },
  {
    name: 'get_attendance_summary',
    description: 'Get attendance summary — sessions count, total hours, recent check-ins. Use days=7 for last week, days=30 for last month.',
    input_schema: {
      type: 'object' as const,
      properties: {
        student_id: { type: 'string', description: 'Student ID. Leave empty for current user.' },
        days: { type: 'number', description: 'Number of past days (default 30).' },
      },
      required: [],
    },
  },
  {
    name: 'get_attendance_by_date_range',
    description: 'Get daily attendance history grouped by date. Use when user wants to browse back in time, see a week/month of records, or asks about attendance on specific days.',
    input_schema: {
      type: 'object' as const,
      properties: {
        student_id: { type: 'string', description: 'Student ID. Leave empty for current user.' },
        from_date: { type: 'string', description: 'Start date YYYY-MM-DD.' },
        to_date: { type: 'string', description: 'End date YYYY-MM-DD (default: today).' },
      },
      required: ['from_date'],
    },
  },
]

export async function executeAttendanceTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  const targetId = (input.student_id as string) || ctx.studentData?.student_id || ctx.userId

  const isSelf = targetId === (ctx.studentData?.student_id ?? ctx.userId)
  if (!isSelf && !can(ctx, 'attendance.view_all')) {
    return { error: 'Permission denied: you can only view your own attendance.' }
  }

  if (name === 'get_attendance_status') {
    const limit = Math.min((input.limit as number) || 5, 20)
    const date  = input.date as string | undefined

    let q = (supabase as any)
      .from('attendance')
      .select('checkin_time, checkout_time, duration, location')
      .eq('student_id', targetId)
      .order('checkin_time', { ascending: false })
      .limit(limit)

    if (date) {
      q = q.gte('checkin_time', `${date}T00:00:00+07:00`).lte('checkin_time', `${date}T23:59:59+07:00`)
    }

    const { data, error } = await q
    if (error) return { error: error.message }
    if (!data?.length) return {
      current_status: date ? 'no_records_on_date' : 'unknown',
      date: date ?? null,
      entries: [],
      message: date ? `ไม่มีบันทึกการเข้าออกในวันที่ ${date}` : 'ยังไม่มีบันทึกการเข้าออก',
    }

    const latest = data[0]
    return {
      current_status: !date
        ? (latest.checkout_time ? 'outside_school' : 'inside_school')
        : 'historical',
      date: date ?? null,
      last_checkin: latest.checkin_time,
      last_checkout: latest.checkout_time ?? null,
      entries: data,
    }
  }

  if (name === 'get_attendance_summary') {
    const days  = (input.days as number) || 30
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await (supabase as any)
      .from('attendance')
      .select('checkin_time, checkout_time, duration, location')
      .eq('student_id', targetId)
      .gte('checkin_time', since.toISOString()) // toISOString() is already UTC — correct for timestamptz
      .order('checkin_time', { ascending: false })

    if (error) return { error: error.message }

    const total = (data ?? []).reduce((s: number, r: { duration?: number | string | null }) => {
      const v = typeof r.duration === 'number' ? r.duration : parseFloat(String(r.duration ?? '0'))
      return s + (isFinite(v) ? v : 0)
    }, 0)

    return {
      period_days: days,
      sessions_count: data?.length ?? 0,
      total_minutes: Math.round(total),
      total_hours: Math.round(total / 60 * 10) / 10,
      recent_sessions: (data ?? []).slice(0, 10),
    }
  }

  if (name === 'get_attendance_by_date_range') {
    const fromDate = input.from_date as string
    const toDate   = (input.to_date as string) || new Date().toISOString().slice(0, 10)

    const { data, error } = await (supabase as any)
      .from('attendance')
      .select('checkin_time, checkout_time, duration, location')
      .eq('student_id', targetId)
      .gte('checkin_time', `${fromDate}T00:00:00+07:00`)
      .lte('checkin_time', `${toDate}T23:59:59+07:00`)
      .order('checkin_time', { ascending: false })
      .limit(200)

    if (error) return { error: error.message }
    if (!data?.length) return {
      entries_by_date: {},
      total_days: 0,
      message: `ไม่มีข้อมูลระหว่าง ${fromDate} ถึง ${toDate}`,
    }

    const byDate: Record<string, { checkin: string; checkout: string | null; duration: string; location: string }[]> = {}
    for (const row of data) {
      const d = (row.checkin_time as string).slice(0, 10)
      ;(byDate[d] ??= []).push({
        checkin:  new Date(row.checkin_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }),
        checkout: row.checkout_time
          ? new Date(row.checkout_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })
          : null,
        duration: row.duration ? `${row.duration} นาที` : 'ยังไม่ออก',
        location: row.location ?? 'school',
      })
    }

    return {
      from_date: fromDate,
      to_date: toDate,
      total_days_with_records: Object.keys(byDate).length,
      entries_by_date: byDate,
    }
  }

  return { error: `Unknown tool: ${name}` }
}
