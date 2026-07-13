import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'

export const studentTools = [
  {
    name: 'get_student_profile',
    description: 'Get a student\'s profile information (name, program, department, and account details).',
    input_schema: {
      type: 'object' as const,
      properties: {
        student_id: { type: 'string', description: 'Student ID. Leave empty for current user.' },
      },
      required: [],
    },
  },
  {
    name: 'search_students',
    description: 'Search students by name, student ID, or department. Admin/teacher only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Name or student ID to search for.' },
        department: { type: 'string', description: 'Filter by department name (optional).' },
        program: { type: 'string', description: 'Filter by program: ปวช or ปวส (optional).' },
        limit: { type: 'number', description: 'Max results (default 10, max 50).' },
      },
      required: ['query'],
    },
  },
]

export async function executeStudentTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  if (name === 'get_student_profile') {
    const targetId = (input.student_id as string) || ctx.studentData?.student_id || ctx.userId
    const isSelf = targetId === (ctx.studentData?.student_id ?? ctx.userId)

    if (!isSelf && !can(ctx, 'student.view_all')) {
      return { error: 'Permission denied: you can only view your own profile.' }
    }

    const { data, error } = await (supabase as any)
      .from('students')
      .select('student_id, first_name, last_name, nickname, program, department, entry_year, photo_url, card_status')
      .eq('student_id', targetId)
      .maybeSingle()

    if (error) return { error: error.message }
    if (!data) return { error: 'Student not found.' }
    return data
  }

  if (name === 'search_students') {
    if (!can(ctx, 'student.view_all')) {
      return { error: 'Permission denied: this feature is for teachers and admins only.' }
    }

    const query = input.query as string
    const limit = Math.min((input.limit as number) || 10, 50)

    let q = (supabase as any)
      .from('students')
      .select('student_id, first_name, last_name, nickname, program, department, entry_year, card_status')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,student_id.ilike.%${query}%`)
      .limit(limit)

    if (input.department) q = q.ilike('department', `%${input.department}%`)
    if (input.program) q = q.eq('program', input.program as string)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { students: data ?? [], count: data?.length ?? 0 }
  }

  return { error: `Unknown tool: ${name}` }
}
