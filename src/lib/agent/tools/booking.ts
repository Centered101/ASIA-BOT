import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '../types'
import { can } from '../permissions'

export const bookingTools = [
  {
    name: 'get_time_slots',
    description: 'List all available time slots (periods) for room booking. Always call this before create_booking so you know valid slot IDs.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'create_booking',
    description: 'Book a room for the current student. Must call get_available_rooms and get_time_slots first to get valid room_id and slot_id.',
    input_schema: {
      type: 'object' as const,
      properties: {
        room_id:      { type: 'string', description: 'UUID of the room to book (from get_available_rooms).' },
        slot_id:      { type: 'number', description: 'Numeric ID of the time slot (from get_time_slots).' },
        booking_date: { type: 'string', description: 'Date to book in YYYY-MM-DD format.' },
        purpose:      { type: 'string', description: 'Reason/purpose for booking.' },
        attendees:    { type: 'number', description: 'Number of attendees (default 1).' },
      },
      required: ['room_id', 'slot_id', 'booking_date', 'purpose'],
    },
  },
  {
    name: 'cancel_booking',
    description: 'Cancel a room booking. Only pending bookings can be cancelled.',
    input_schema: {
      type: 'object' as const,
      properties: {
        booking_id: { type: 'string', description: 'UUID of the booking to cancel (from get_my_bookings).' },
      },
      required: ['booking_id'],
    },
  },
  {
    name: 'get_my_bookings',
    description: 'Get room bookings for the current student — pending, approved, and recent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by status: pending, approved, rejected, cancelled. Leave empty for all.' },
        limit: { type: 'number', description: 'Number of results (default 5).' },
      },
      required: [],
    },
  },
  {
    name: 'get_available_rooms',
    description: 'List rooms available for booking (active rooms with capacity and amenities).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_all_bookings',
    description: 'Get all room booking requests. Admin/teacher only.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: 'Filter by status: pending, approved, rejected, cancelled.' },
        date: { type: 'string', description: 'Filter by date (YYYY-MM-DD).' },
        limit: { type: 'number', description: 'Max results (default 20).' },
      },
      required: [],
    },
  },
]

export async function executeBookingTool(
  name: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  if (name === 'get_time_slots') {
    const { data, error } = await (supabase as any)
      .from('time_slots')
      .select('id, label, start_time, end_time')
      .order('start_time')
    if (error) return { error: error.message }
    return { time_slots: data ?? [] }
  }

  if (name === 'create_booking') {
    if (!can(ctx, 'booking.view_own')) return { error: 'Permission denied.' }

    const studentId   = ctx.studentData?.student_id || ctx.userId
    const studentName = ctx.studentData
      ? `${ctx.studentData.first_name} ${ctx.studentData.last_name}`.trim()
      : ctx.displayName

    const { room_id, slot_id, booking_date, purpose, attendees } = input as {
      room_id: string; slot_id: number; booking_date: string; purpose: string; attendees?: number
    }

    // Validate room exists and is active
    const { data: room } = await (supabase as any)
      .from('rooms').select('id, name, capacity').eq('id', room_id).eq('status', 'active').maybeSingle()
    if (!room) return { error: 'ไม่พบห้องที่เลือก หรือห้องไม่พร้อมใช้งาน' }

    // Check for conflicts (same room + slot + date already booked/approved)
    const { data: conflict } = await (supabase as any)
      .from('bookings')
      .select('id')
      .eq('room_id', room_id)
      .eq('slot_id', slot_id)
      .eq('booking_date', booking_date)
      .in('status', ['pending', 'approved'])
      .maybeSingle()
    if (conflict) return { error: `ห้องนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว กรุณาเลือกช่วงเวลาหรือวันอื่น` }

    const { data, error } = await (supabase as any)
      .from('bookings')
      .insert({
        room_id, slot_id, booking_date, purpose,
        student_id:   studentId,
        student_name: studentName,
        attendees:    attendees ?? 1,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) return { error: error.message }
    return {
      success: true,
      booking_id: data?.id,
      room_name: room.name,
      booking_date,
      message: `จองห้อง ${room.name} วันที่ ${booking_date} สำเร็จแล้ว รอการอนุมัติจากแอดมิน`,
    }
  }

  if (name === 'cancel_booking') {
    if (!can(ctx, 'booking.view_own') && !can(ctx, 'booking.view_all')) {
      return { error: 'Permission denied.' }
    }

    const studentId = ctx.studentData?.student_id || ctx.userId
    const bookingId = input.booking_id as string

    // Verify ownership (unless admin)
    const { data: booking } = await (supabase as any)
      .from('bookings')
      .select('id, status, student_id, rooms(name)')
      .eq('id', bookingId)
      .maybeSingle()

    if (!booking) return { error: 'ไม่พบรายการจองนี้' }
    if (!can(ctx, 'booking.view_all') && booking.student_id !== studentId) {
      return { error: 'ไม่มีสิทธิ์ยกเลิกการจองของคนอื่น' }
    }
    if (booking.status !== 'pending') {
      return { error: `ไม่สามารถยกเลิกได้ สถานะปัจจุบันคือ "${booking.status}"` }
    }

    const { error } = await (supabase as any)
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', bookingId)

    if (error) return { error: error.message }
    return { success: true, message: `ยกเลิกการจองห้อง ${(booking.rooms as any)?.name ?? ''} สำเร็จแล้ว` }
  }

  if (name === 'get_my_bookings') {
    if (!can(ctx, 'booking.view_own') && !can(ctx, 'booking.view_all')) {
      return { error: 'Permission denied.' }
    }

    const studentId = ctx.studentData?.student_id || ctx.userId
    const limit = Math.min((input.limit as number) || 5, 20)

    let q = (supabase as any)
      .from('bookings')
      .select('id, booking_date, purpose, status, admin_note, attendees, rooms(name, location), time_slots(label, start_time, end_time)')
      .eq('student_id', studentId)
      .order('booking_date', { ascending: false })
      .limit(limit)

    if (input.status) q = q.eq('status', input.status as string)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { bookings: data ?? [], count: data?.length ?? 0 }
  }

  if (name === 'get_available_rooms') {
    const { data, error } = await (supabase as any)
      .from('rooms')
      .select('id, name, description, capacity, location, amenities, status')
      .eq('status', 'active')
      .order('name')

    if (error) return { error: error.message }
    return { rooms: data ?? [] }
  }

  if (name === 'get_all_bookings') {
    if (!can(ctx, 'booking.view_all')) {
      return { error: 'Permission denied: this feature is for admins and teachers only.' }
    }

    const limit = Math.min((input.limit as number) || 20, 100)

    let q = (supabase as any)
      .from('bookings')
      .select('id, booking_date, purpose, status, student_name, attendees, admin_note, rooms(name), time_slots(label)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (input.status) q = q.eq('status', input.status as string)
    if (input.date) q = q.eq('booking_date', input.date as string)

    const { data, error } = await q
    if (error) return { error: error.message }
    return { bookings: data ?? [], count: data?.length ?? 0 }
  }

  return { error: `Unknown tool: ${name}` }
}
