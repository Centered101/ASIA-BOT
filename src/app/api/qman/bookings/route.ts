import { NextRequest, NextResponse } from 'next/server'
import { supabaseDemo as supabase } from '@/lib/supabase-demo'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { data, error } = await supabase
    .from('qman_bookings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    userId, shopId, shopName, shopBranch, shopLogo, shopMap,
    customerName, customerPhone, bookingDate, bookingTime, notes, price,
  } = body

  if (!customerName || !customerPhone || !bookingDate || !bookingTime) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check wallet balance
  if (userId && price > 0) {
    const { data: user } = await supabase
      .from('qman_users')
      .select('wallet_balance')
      .eq('id', userId)
      .single()

    if (!user || user.wallet_balance < price) {
      return NextResponse.json({ error: 'ยอดเงินในกระเป๋าไม่เพียงพอ' }, { status: 400 })
    }

    // Deduct wallet
    const { error: walletError } = await supabase
      .from('qman_users')
      .update({ wallet_balance: user.wallet_balance - price })
      .eq('id', userId)

    if (walletError) return NextResponse.json({ error: walletError.message }, { status: 500 })
  }

  // Generate queue number: count bookings today + 1
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('qman_bookings')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)

  const queueNum = 'Q' + String((count ?? 0) + 1).padStart(3, '0')

  const { data: booking, error } = await supabase
    .from('qman_bookings')
    .insert({
      queue_number: queueNum,
      user_id: userId || null,
      shop_id: shopId || null,
      shop_name: shopName,
      shop_branch: shopBranch,
      shop_logo: shopLogo || '',
      shop_map: shopMap || '',
      customer_name: customerName,
      customer_phone: customerPhone,
      booking_date: bookingDate,
      booking_time: bookingTime,
      notes: notes || '',
      price,
      status: 'รอรับบริการ',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return updated wallet balance
  let newWalletBalance: number | null = null
  if (userId) {
    const { data: user } = await supabase
      .from('qman_users')
      .select('wallet_balance')
      .eq('id', userId)
      .single()
    newWalletBalance = user?.wallet_balance ?? null
  }

  return NextResponse.json({
    success: true,
    queueNumber: queueNum,
    booking,
    newWalletBalance,
  })
}
