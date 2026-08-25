import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'

function bangkokDow(): number {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).getDay()
  return d === 0 ? 7 : d
}

const DAY_NAMES_TH = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']
const DAY_NAMES_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

type ResolvedGroup = { id: string; name: string } | null

/**
 * หาว่าคำถามนี้ควรตอบตารางของห้องไหน
 *
 * ลำดับคือ ชื่อห้องที่ผู้ถามระบุมาเอง → ห้องของตัวผู้ถามเอง (เฉพาะนักเรียน)
 * ถ้าไม่เข้าเงื่อนไขไหนเลยจึงคืน null แล้วปล่อยให้ดึงทั้งโรงเรียนเหมือนเดิม
 * ซึ่งเป็นพฤติกรรมที่ถูกต้องสำหรับครูหรือแอดมินที่ถามภาพรวม
 *
 * ที่ต้องอ่าน class_group_id จากตาราง students ตรงนี้ ไม่ใช่รับผ่าน ctx
 * เพราะ studentData ที่แต่ละช่องทางประกอบมาให้ (web กับ line) ไม่มีข้อมูลห้อง
 * ติดมาด้วย การแก้ที่นี่จึงทำให้ทั้งสองช่องทางได้ผลตรงกันโดยไม่ต้องรื้อ session
 */
async function resolveClassGroup(
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<ResolvedGroup> {
  const requested = typeof input.class_group_name === 'string' ? input.class_group_name.trim() : ''

  if (requested) {
    const { data } = await supabase
      .from('class_groups')
      .select('id, name')
      .ilike('name', requested)
      .maybeSingle()

    if (data) return { id: data.id as string, name: data.name as string }
  }

  if (ctx.userType === 'student' && ctx.studentData?.student_id) {
    const { data } = await supabase
      .from('students')
      .select('class_group_id, class_groups(name)')
      .eq('student_id', ctx.studentData.student_id)
      .maybeSingle()

    const groupId = (data as { class_group_id?: string | null } | null)?.class_group_id
    if (groupId) {
      const joined = (data as { class_groups?: { name?: string } | { name?: string }[] } | null)?.class_groups
      const name = Array.isArray(joined) ? joined[0]?.name : joined?.name
      return { id: groupId, name: name ?? '' }
    }
  }

  return null
}

export const scheduleTools = [
  {
    name: 'get_schedule_today',
    description:
      "Get today's class schedule. For a student this defaults to that student's own class group — do not ask them which class they are in, and never assume a class group yourself. The result states which one was used in `class_group`; `scope: \"whole_school\"` means no class group could be resolved.",
    input_schema: {
      type: 'object' as const,
      properties: {
        class_group_name: {
          type: 'string',
          description:
            'Only set this when asking about a class group other than the caller\'s own, e.g. "ปวช.1/1". Leave empty to use the student\'s own class group.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_schedule_week',
    description:
      "Get the weekly class schedule. For a student this defaults to that student's own class group — do not ask them which class they are in, and never assume a class group yourself. The result states which one was used in `class_group`.",
    input_schema: {
      type: 'object' as const,
      properties: {
        day_of_week: { type: 'number', description: 'Day number 1=Mon to 7=Sun. Leave empty for all days.' },
        class_group_name: {
          type: 'string',
          description:
            "Only set this when asking about a class group other than the caller's own. Leave empty to use the student's own class group.",
        },
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

  const group = await resolveClassGroup(input, ctx, supabase)

  if (name === 'get_schedule_today') {
    const dow = bangkokDow()
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

    // Check overrides first
    let overrideQ = supabase
      .from('class_schedule_overrides')
      .select('start_time, end_time, room_name, subject, teacher, note, class_groups(name, color)')
      .eq('override_date', today)

    if (group) overrideQ = overrideQ.eq('class_group_id', group.id)

    const { data: overrides } = await overrideQ

    let q = supabase
      .from('class_schedules')
      .select('start_time, end_time, room_name, subject, teacher, class_groups(name, color)')
      .eq('day_of_week', dow)
      .order('start_time')

    if (group) q = q.eq('class_group_id', group.id)

    const { data: schedules, error } = await q
    if (error) return { error: error.message }

    const lang = ctx.language
    return {
      day: lang === 'th' ? DAY_NAMES_TH[dow] : DAY_NAMES_EN[dow],
      day_number: dow,
      date: today,
      class_group: group?.name || null,
      scope: group ? 'class_group' : 'whole_school',
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
    if (group) q = q.eq('class_group_id', group.id)

    const { data, error } = await q
    if (error) return { error: error.message }

    // Group by day
    const byDay: Record<number, unknown[]> = {}
    for (const s of data ?? []) {
      if (!byDay[s.day_of_week]) byDay[s.day_of_week] = []
      byDay[s.day_of_week].push(s)
    }

    return {
      class_group: group?.name || null,
      scope: group ? 'class_group' : 'whole_school',
      schedule_by_day: byDay,
      day_names_th: DAY_NAMES_TH,
      day_names_en: DAY_NAMES_EN,
    }
  }

  return { error: `Unknown tool: ${name}` }
}
