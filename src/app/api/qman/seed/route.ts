import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { supabaseDemo as supabase } from '@/lib/supabase-demo'
import bcrypt from 'bcryptjs'

const DEMO_EMAIL = 'testbot@asia-bot.xyz'
const DEMO_PASSWORD = 'BOTจัดดด'

// Phase 1: this endpoint had NO authentication — anyone could hit it and reset
// the Qman demo user's password. It now requires the ADMIN_SECRET header, the
// same gate /api/admin/setup and /api/admin/recovery already use.

function secretMatches(provided: string | null): boolean {
  const expected = process.env.ADMIN_SECRET
  if (!expected || !provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// GET /api/qman/seed — upserts the demo user (always keeps password in sync)
export async function GET(req: Request) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json(
      { error: 'ยังไม่ได้ตั้งค่า ADMIN_SECRET — endpoint นี้ถูกปิดใช้งาน' },
      { status: 503 }
    )
  }

  if (!secretMatches(req.headers.get('x-admin-secret'))) {
    return NextResponse.json({ error: 'ADMIN_SECRET ไม่ถูกต้อง' }, { status: 401 })
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10)

  const { data: existing } = await supabase
    .from('qman_users')
    .select('id')
    .ilike('email', DEMO_EMAIL)
    .single()

  if (existing) {
    // Update password hash to ensure it matches current DEMO_PASSWORD
    const { error } = await supabase
      .from('qman_users')
      .update({ password_hash: hash })
      .eq('id', existing.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: 'Demo user password updated' })
  }

  const { error } = await supabase.from('qman_users').insert({
    email: DEMO_EMAIL,
    password_hash: hash,
    wallet_balance: 500,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, message: `Demo user created: ${DEMO_EMAIL}` })
}
