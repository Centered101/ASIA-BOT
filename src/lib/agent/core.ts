import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentRequest, AgentResponse, ConversationMessage } from './types'
import { buildContext, buildSystemPrompt } from './context'
import { getToolsForRole, executeToolCall } from './tools/index'
import { loadMemory, saveMemory } from './memory'
import { logAgentRequest } from './logger'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
const MAX_TOOL_ROUNDS = 5

export async function runAgent(
  req: AgentRequest,
  supabase: SupabaseClient
): Promise<AgentResponse> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  let finalText = 'ขอโทษครับ เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'
  let errorMsg: string | undefined
  let richData: AgentResponse['richData']

  const ATTENDANCE_TOOLS = new Set(['get_attendance_status', 'get_attendance_summary', 'get_attendance_by_date_range'])

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

    const client = new Anthropic({ apiKey })
    const ctx = buildContext(req)
    const systemPrompt = buildSystemPrompt(ctx)
    const tools = getToolsForRole(req.role)

    // Load conversation memory
    const history = await loadMemory(req.sessionId, supabase)

    // Build initial messages
    let messages: Anthropic.MessageParam[] = [
      ...history.map(m => ({ role: m.role, content: m.content }) as Anthropic.MessageParam),
      { role: 'user', content: req.message },
    ]

    // Agentic tool-calling loop
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: tools as Anthropic.Tool[],
        messages,
      })

      // Append assistant turn
      messages = [...messages, { role: 'assistant', content: response.content }]

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find(b => b.type === 'text')
        if (textBlock?.type === 'text') finalText = textBlock.text
        break
      }

      // Execute all tool calls in this round
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of toolUseBlocks) {
        toolsUsed.push(block.name)
        const result = await executeToolCall(
          block.name,
          block.input as Record<string, unknown>,
          ctx,
          supabase
        )
        // capture attendance data for rich card rendering
        if (ATTENDANCE_TOOLS.has(block.name) && result && !(result as Record<string,unknown>).error) {
          richData = { type: block.name, payload: result }
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }

      messages = [...messages, { role: 'user', content: toolResults }]
    }

    // Persist conversation (trim to last MAX_MESSAGES pairs)
    const updatedHistory: ConversationMessage[] = [
      ...history,
      { role: 'user', content: req.message },
      { role: 'assistant', content: finalText },
    ]
    await saveMemory(req.sessionId, updatedHistory, supabase)

  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Unknown error'
    finalText = 'ขอโทษครับ ระบบ AI มีปัญหาชั่วคราว กรุณาลองอีกครั้งในภายหลัง'
  }

  const latencyMs = Date.now() - startTime

  // Fire-and-forget logging (non-blocking)
  logAgentRequest({
    sessionId: req.sessionId,
    channel: req.channel,
    userId: req.userId,
    userRole: req.role,
    userMessage: req.message,
    toolsCalled: toolsUsed,
    response: finalText,
    latencyMs,
    error: errorMsg,
  }, supabase).catch(() => { /* logging must never crash the agent */ })

  return { text: finalText, toolsUsed, latencyMs, sessionId: req.sessionId, richData }
}
