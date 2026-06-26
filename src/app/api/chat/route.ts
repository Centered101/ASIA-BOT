import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAgent } from '@/lib/agent/core'
import { buildWebStudentRequest, buildWebAdminRequest, buildWebGuestRequest } from '@/lib/agent/channels/web'
import { parseNavTags } from '@/lib/agent/nav'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.messages?.length) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  const {
    messages,
    isAdmin,
    studentId,
    adminId,
    adminRole,
  } = body as {
    messages: { role: 'user' | 'assistant'; content: string }[]
    isAdmin: boolean
    studentId?: string
    adminId?: string
    adminRole?: 'superadmin' | 'admin' | 'staff'
  }

  const lastUserMessage = messages.filter(m => m.role === 'user').at(-1)?.content ?? ''

  let agentReq

  if (isAdmin && adminId) {
    // Verify admin against DB
    const { data: admin } = await (supabase as any)
      .from('admins')
      .select('admin_id, role, first_name, last_name')
      .eq('admin_id', adminId)
      .maybeSingle()

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    agentReq = buildWebAdminRequest(
      { id: admin.admin_id, admin_id: admin.admin_id, role: admin.role ?? adminRole ?? 'admin', first_name: admin.first_name ?? null, last_name: admin.last_name ?? null },
      lastUserMessage
    )

  } else if (!isAdmin && studentId) {
    // Verify student against DB — never trust client-provided name/program
    const { data: student } = await (supabase as any)
      .from('students')
      .select('student_id, first_name, last_name, nickname, program, department, entry_year, photo_url')
      .eq('student_id', studentId)
      .maybeSingle()

    if (!student) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    agentReq = buildWebStudentRequest(student, lastUserMessage, messages)

  } else {
    agentReq = buildWebGuestRequest(lastUserMessage)
  }

  const result = await runAgent(agentReq, supabase)
  const { cleanText, navButtons } = parseNavTags(result.text)
  return NextResponse.json({ text: cleanText, navButtons, card: result.richData ?? null })
}
