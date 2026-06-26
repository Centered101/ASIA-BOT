import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConversationMessage } from './types'

const MAX_MESSAGES = 12

export async function loadMemory(
  sessionId: string,
  supabase: SupabaseClient
): Promise<ConversationMessage[]> {
  const { data } = await (supabase as any)
    .from('agent_conversations')
    .select('messages')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!data?.messages) return []

  const messages = Array.isArray(data.messages) ? data.messages : []
  return messages.slice(-MAX_MESSAGES) as ConversationMessage[]
}

export async function saveMemory(
  sessionId: string,
  messages: ConversationMessage[],
  supabase: SupabaseClient
): Promise<void> {
  const trimmed = messages.slice(-MAX_MESSAGES)

  await (supabase as any)
    .from('agent_conversations')
    .upsert(
      { session_id: sessionId, messages: trimmed, updated_at: new Date().toISOString() },
      { onConflict: 'session_id' }
    )
}

export async function clearMemory(sessionId: string, supabase: SupabaseClient): Promise<void> {
  await (supabase as any)
    .from('agent_conversations')
    .delete()
    .eq('session_id', sessionId)
}
