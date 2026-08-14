import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'

function bangkokDow(): number {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).getDay()
  return d === 0 ? 7 : d
}

const DAY_NAMES_TH = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const DAY_NAMES_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const scheduleTools = [
  {
    name: 'get_schedule_today',
    description: 'Get today\'s class schedule for all classes or a specific class group.',
    input_schema: {
      type: 'object' as const,
      properties: {
        class_group_name: { type: 'string', description: 'Filter by class group name (optional, e.g. "ปวช.1/1").' },
      },
      required: [],
    },
  },
  {
    name: 'get_schedule_week',
    description: 'Get the full weekly class schedule.',
    input_schema: {
      type: 'object' as const,
      properties: {
        day_of_week: { type: 'number', description: 'Day number 1=Mon to 7=Sun. Leave empty for all days.' },
        class_group_name: { type: 'string', description: 'Filter by class group name (optional).' },
      },
      required: [],
    },
  },
]

export async function executeScheduleTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  if (!can(ctx, 'schedule.view')) {
    return { error: 'Permission denied.' }
  }

  if (name === 'get_schedule_today') {
    const dow = bangkokDow()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

    // Check overrides first
    const overrideQ = supabase
      .from('class_schedule_overrides')
      .select('start_time, end_time, room_name, subject, teacher, note, class_groups(name, color)')
      .eq('override_date', today)

    const { data: overrides } = await overrideQ

    const q = supabase
      .from('class_schedules')
      .select('start_time, end_time, room_name, subject, teacher, class_groups(name, color)')
      .eq('day_of_week', dow)
      .order('start_time')

    const { data: schedules, error } = await q
    if (error) return { error: error.message }

    const lang = ctx.language
    return {
      day: lang === 'th' ? DAY_NAMES_TH[dow] : DAY_NAMES_EN[dow],
      day_number: dow,
      date: today,
      schedules: schedules ?? [],
      overrides: overrides ?? [],
    }
  }

  if (name === 'get_schedule_week') {
    let q = supabase
      .from('class_schedules')
      .select('day_of_week, start_time, end_time, room_name, subject, teacher, class_groups(name, color)')
      .order('day_of_week')
      .order('start_time')

    if (input.day_of_week) q = q.eq('day_of_week', input.day_of_week as number)

    const { data, error } = await q
    if (error) return { error: error.message }

    // Group by day
    const byDay: Record<number, unknown[]> = {}
    for (const s of data ?? []) {
      if (!byDay[s.day_of_week]) byDay[s.day_of_week] = []
      byDay[s.day_of_week].push(s)
    }

    return {
      schedule_by_day: byDay,
      day_names_th: DAY_NAMES_TH,
      day_names_en: DAY_NAMES_EN,
    }
  }

  return { error: `Unknown tool: ${name}` }
}
