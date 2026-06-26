import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/agent/core'
import type { AgentRequest } from '@/lib/agent/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Unified AI Agent endpoint.
 *
 * Any channel (web, LINE, mobile, API) can POST a standardized AgentRequest here.
 * The response is always { text: string, toolsUsed: string[], latencyMs: number }.
 *
 * Channel adapters in src/lib/agent/channels/ build the AgentRequest from
 * channel-specific payloads, then call this endpoint (or runAgent directly).
 */
export async function POST(req: NextRequest) {
  let body: Partial<AgentRequest> | null = null

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body?.message || !body?.channel || !body?.sessionId) {
    return NextResponse.json(
      { error: 'Required fields: message, channel, sessionId' },
      { status: 400 }
    )
  }

  const agentReq: AgentRequest = {
    channel: body.channel,
    userId: body.userId ?? 'unknown',
    userType: body.userType ?? 'guest',
    role: body.role ?? 'guest',
    message: body.message,
    language: body.language ?? 'th',
    sessionId: body.sessionId,
    studentData: body.studentData,
    adminData: body.adminData,
    metadata: body.metadata,
  }

  const result = await runAgent(agentReq, supabase)
  return NextResponse.json(result)
}
