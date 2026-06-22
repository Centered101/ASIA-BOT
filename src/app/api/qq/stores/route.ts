import { NextResponse } from 'next/server'
import { supabaseDemo as supabase } from '@/lib/supabase-demo'

export async function GET() {
  const { data, error } = await supabase
    .from('qq_stores')
    .select('*')
    .order('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
