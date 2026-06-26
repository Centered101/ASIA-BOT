import type { SupabaseClient } from '@supabase/supabase-js'
import type { Channel, UserRole } from './types'

interface LogEntry {
  sessionId: string
  channel: Channel
  userId: string
  userRole: UserRole
  userMessage: string
  toolsCalled: string[]
  response: string
  latencyMs: number
  error?: string
}

export async function logAgentRequest(entry: LogEntry, supabase: SupabaseClient): Promise<void> {
  await (supabase as any)
    .from('agent_logs')
    .insert({
      session_id: entry.sessionId,
      channel: entry.channel,
      user_id: entry.userId,
      user_role: entry.userRole,
      user_message: entry.userMessage.slice(0, 1000),
      tools_called: entry.toolsCalled,
      response: entry.response.slice(0, 2000),
      latency_ms: entry.latencyMs,
      error: entry.error ?? null,
    })
}
