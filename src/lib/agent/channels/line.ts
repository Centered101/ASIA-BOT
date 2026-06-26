import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentRequest } from '../types'

/**
 * Build a standardized AgentRequest from a LINE message event.
 * Looks up the student linked to the LINE userId; returns null for unlinked users.
 */
export async function buildLineRequest(
  lineUserId: string,
  text: string,
  supabase: SupabaseClient
): Promise<AgentRequest | null> {
  const { data: student } = await (supabase as any)
    .from('students')
    .select('student_id, first_name, last_name, nickname, program, department, photo_url')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  if (!student) return null

  // Detect language from message
  const language = /[฀-๿]/.test(text) ? 'th' : 'en'

  return {
    channel: 'line',
    userId: lineUserId,
    userType: 'student',
    role: 'student',
    message: text,
    language,
    sessionId: `line:${lineUserId}`,
    studentData: {
      student_id: student.student_id,
      first_name: student.first_name,
      last_name: student.last_name,
      nickname: student.nickname,
      program: student.program,
      department: student.department,
      photo_url: student.photo_url,
    },
  }
}
