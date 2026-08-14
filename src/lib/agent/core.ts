import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentRequest, AgentResponse, ConversationMessage } from './types'
import { buildContext, buildSystemPrompt } from './context'
import { getToolsForRole, executeToolCall } from './tools/index'
import { loadMemory, saveMemory } from './memory'
import { logAgentRequest } from './logger'
import { notifyAiRuntimeIssue } from './line-notify'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
const MAX_TOOL_ROUNDS = 5

function choiceCard(title: string, helper: string, inputPrefix: string, options: { label: string; value: string; description?: string }[]): AgentResponse['richData'] {
  return {
    type: 'choice',
    payload: { title, helper, inputPrefix, options: options.slice(0, 12) },
  }
}

// Attendance results render as rich cards in ChatBubble's <AttendanceCard>,
// which reads the tool result verbatim as its payload and keys off the tool
// name. Passing the result straight through is what it expects.
const ATTENDANCE_CARD_TOOLS = new Set([
  'get_attendance_status',
  'get_attendance_summary',
  'get_attendance_by_date_range',
])

function richDataFromToolResult(toolName: string, result: unknown): AgentResponse['richData'] | undefined {
  if (!result || typeof result !== 'object' || 'error' in result) return undefined
  const data = result as Record<string, any>

  if (ATTENDANCE_CARD_TOOLS.has(toolName)) {
    return { type: toolName, payload: data }
  }

  if (toolName === 'get_time_slots' && Array.isArray(data.time_slots)) {
    return choiceCard(
      'เลือกช่วงเวลา',
      'กดช่วงเวลาที่ต้องการ แล้ว AI จะใช้คำตอบนี้ต่อในการจอง',
      'เลือกช่วงเวลา: ',
      data.time_slots.map((slot: any) => ({
        label: String(slot.label ?? `${slot.start_time ?? ''}-${slot.end_time ?? ''}`),
        value: String(slot.label ?? `${slot.start_time ?? ''}-${slot.end_time ?? ''}`),
        description: [slot.start_time, slot.end_time].filter(Boolean).join(' - '),
      })),
    )
  }

  if (toolName === 'get_available_rooms' && Array.isArray(data.rooms)) {
    return choiceCard(
      'เลือกห้อง',
      'กดห้องที่ต้องการเพื่อส่งชื่อ/รหัสห้องกลับให้ AI',
      'เลือกห้อง: ',
      data.rooms.map((room: any) => ({
        label: String(room.name ?? 'ห้อง'),
        value: String(room.name ?? ''),
        description: [room.location, room.capacity ? `จุ ${room.capacity} คน` : null].filter(Boolean).join(' · '),
      })),
    )
  }

  if (toolName === 'get_products' && Array.isArray(data.products)) {
    return choiceCard(
      'เลือกสินค้า',
      'กดสินค้าที่ต้องการ แล้วบอกจำนวนต่อได้เลย',
      'เลือกสินค้า: ',
      data.products.map((product: any) => ({
        label: String(product.name ?? 'สินค้า'),
        value: String(product.name ?? ''),
        description: [`฿${Number(product.price ?? 0).toLocaleString('th-TH')}`, product.stock != null ? `เหลือ ${product.stock}` : null].filter(Boolean).join(' · '),
      })),
    )
  }

  if (toolName === 'get_equipment_items' && Array.isArray(data.equipment_items)) {
    return choiceCard(
      'เลือกคุรุภัณฑ์',
      'กดคุรุภัณฑ์ที่ต้องการ แล้ว AI จะถามจำนวนและช่วงเวลาต่อ',
      'เลือกคุรุภัณฑ์: ',
      data.equipment_items.map((item: any) => ({
        label: String(item.name ?? 'คุรุภัณฑ์'),
        value: String(item.name ?? ''),
        description: [item.category, item.available_quantity != null ? `คงเหลือ ${item.available_quantity} ${item.unit ?? 'ชิ้น'}` : null].filter(Boolean).join(' · '),
      })),
    )
  }

  return undefined
}

function richDataFromAssistantText(text: string): AgentResponse['richData'] | undefined {
  const normalized = text.replace(/\s+/g, ' ')
  const isAskingForMissingInfo = /ยังต้องระบุ|กรุณาระบุ|ช่วยเลือก|เลือก.*ต่อ|บอก.*ได้เลย|ต้องการ/.test(normalized)
  const asksDeliveryMode = isAskingForMissingInfo && /วิธีรับ|รับเอง|pickup|delivery/.test(normalized)
  const asksTimeSlot = isAskingForMissingInfo && /ช่วงเวลา|เวลารับ|ช่วงเวลารับ/.test(normalized)
  const alreadyHasTimeSlot = /ช่วงเวลา(?:รับ)?\s*[:：]\s*\d{1,2}[:.]\d{2}/.test(normalized)

  if (asksDeliveryMode && !/วิธีรับ:/.test(normalized)) {
    return choiceCard(
      'เลือกวิธีรับ',
      'เลือกได้ 1 วิธีรับ แล้ว AI จะใช้คำตอบนี้ต่อ',
      'วิธีรับ: ',
      [
        { label: 'รับเอง', value: 'รับเอง', description: 'รับที่ห้องเก็บ/สหกรณ์' },
        { label: 'ให้ส่ง', value: 'ให้ส่ง', description: 'ส่งตามสถานที่ที่แจ้งไว้' },
      ],
    )
  }

  if (asksTimeSlot && !alreadyHasTimeSlot && !/เลือกช่วงเวลา:/.test(normalized)) {
    return choiceCard(
      'เลือกช่วงเวลา',
      'เลือกได้ 1 ช่วงเวลา แล้ว AI จะใช้คำตอบนี้ต่อ',
      'เลือกช่วงเวลา: ',
      [
        { label: '09:00-12:00', value: '09:00-12:00', description: 'ช่วงเช้า' },
        { label: '13:00-16:00', value: '13:00-16:00', description: 'ช่วงบ่าย' },
      ],
    )
  }

  return undefined
}

export async function runAgent(
  req: AgentRequest,
  supabase: SupabaseClient
): Promise<AgentResponse> {
  const startTime = Date.now()
  const toolsUsed: string[] = []
  let finalText = 'ขอโทษครับ เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'
  let errorMsg: string | undefined
  let richData: AgentResponse['richData']
  const events: NonNullable<AgentResponse['events']> = []

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
        richData = richData ?? richDataFromAssistantText(finalText)
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
        richData = richDataFromToolResult(block.name, result) ?? richData
        if (block.name === 'place_order' && result && typeof result === 'object') {
          const orderResult = result as Record<string, unknown>
          if (orderResult.success && orderResult.payment_required && orderResult.checkout) {
            events.push({ type: 'shop:checkout-required', payload: orderResult.checkout })
          }
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
    const fallbackCtx = {
      channel: req.channel,
      role: req.role,
      userId: req.userId,
      displayName: req.studentData
        ? `${req.studentData.first_name} ${req.studentData.last_name}`.trim()
        : req.adminData
          ? `${req.adminData.first_name ?? ''} ${req.adminData.last_name ?? ''}`.trim() || req.userId
          : req.userId,
    }
    notifyAiRuntimeIssue(supabase, fallbackCtx, errorMsg).catch(() => {})
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

  return { text: finalText, toolsUsed, latencyMs, sessionId: req.sessionId, richData, events }
}
