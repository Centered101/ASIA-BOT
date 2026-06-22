import { NextRequest, NextResponse } from 'next/server'
import { supabaseDemo as supabase } from '@/lib/supabase-demo'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 })
  }

  const { data: user, error } = await supabase
    .from('qman_users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email, wallet_balance: user.wallet_balance },
  })
}
