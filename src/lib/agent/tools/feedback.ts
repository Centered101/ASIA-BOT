import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'

export const feedbackTools = [
  {
    name: 'submit_feedback',
    description: 'Submit feedback or report a problem to school staff.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'The feedback or problem description (minimum 5 characters).' },
        type: { type: 'string', description: 'Type of feedback: "comment" for suggestions, "report" for problems.' },
        category: { type: 'string', description: 'Category: facility, academic, safety, other (optional).' },
      },
      required: ['message'],
    },
  },
  {
    name: 'get_pending_feedback',
    description: 'Get pending feedback and reports. Admin only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter: pending, in_progress, resolved. Default: pending.' },
        limit: { type: 'number', description: 'Max results (default 10).' },
      },
      required: [],
    },
  },
]

export async function executeFeedbackTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  if (name === 'submit_feedback') {
    if (!can(ctx, 'feedback.create')) {
      return { error: 'Permission denied: only students can submit feedback.' }
    }

    const message = (input.message as string)?.trim()
    if (!message || message.length < 5) {
      return { error: 'Feedback message is too short (minimum 5 characters).' }
    }

    const studentName = ctx.studentData
      ? `${ctx.studentData.first_name} ${ctx.studentData.last_name}`
      : ctx.displayName

    const { data, error } = await (supabase as any)
      .from('feedback')
      .insert({
        student_id: ctx.studentData?.student_id || ctx.userId,
        name: studentName,
        type: (input.type as string) || 'comment',
        category: (input.category as string) || null,
        message,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    return { success: true, feedback_id: data?.id, message: 'Feedback submitted successfully.' }
  }

  if (name === 'get_pending_feedback') {
    if (!can(ctx, 'feedback.view_all')) {
      return { error: 'Permission denied: admin only.' }
    }

    const status = (input.status as string) || 'pending'
    const limit = Math.min((input.limit as number) || 10, 50)

    const { data, error } = await (supabase as any)
      .from('feedback')
      .select('id, type, name, category, message, status, admin_note, created_at')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return { error: error.message }
    return { feedbacks: data ?? [], count: data?.length ?? 0, status }
  }

  return { error: `Unknown tool: ${name}` }
}
