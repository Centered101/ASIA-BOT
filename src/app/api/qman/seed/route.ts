import { NextResponse } from 'next/server'
import { supabaseDemo as supabase } from '@/lib/supabase-demo'
import bcrypt from 'bcryptjs'

const DEMO_EMAIL = 'testbot@asia-bot.xyz'
const DEMO_PASSWORD = 'BOTจัดดด'

// GET /api/qman/seed — upserts the demo user (always keeps password in sync)
export async function GET() {
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
