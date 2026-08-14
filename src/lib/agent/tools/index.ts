import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext, UserRole } from '../types'

import { studentTools, executeStudentTool } from './students'
import { attendanceTools, executeAttendanceTool } from './attendance'
import { bookingTools, executeBookingTool } from './booking'
import { shopTools, executeShopTool } from './shop'
import { scheduleTools, executeScheduleTool } from './schedule'
import { feedbackTools, executeFeedbackTool } from './feedback'
import { dashboardTools, executeDashboardTool } from './dashboard'
import { equipmentTools, executeEquipmentTool } from './equipment'

// Full tool registry — every tool the agent can call
export const ALL_TOOLS = [
  ...studentTools,
  ...attendanceTools,
  ...bookingTools,
  ...shopTools,
  ...scheduleTools,
  ...feedbackTools,
  ...equipmentTools,
  ...dashboardTools,
]

// Tools available for each role (least-privilege)
const TOOL_ALLOW: Record<UserRole, string[]> = {
  guest: ['get_school_info'],
  student: [
    'get_student_profile',
    'get_attendance_status',
    'get_attendance_summary',
    'get_attendance_by_date_range',
    'get_my_bookings',
    'get_available_rooms',
    'get_time_slots',
    'create_booking',
    'cancel_booking',
    'get_my_orders',
    'get_products',
    'place_order',
    'cancel_order',
    'get_equipment_items',
    'request_equipment',
    'get_my_equipment_requests',
    'get_schedule_today',
    'get_schedule_week',
    'submit_feedback',
    'get_school_info',
  ],
  parent: [
    'get_student_profile',
    'get_schedule_today',
    'get_school_info',
  ],
  teacher: [
    'get_student_profile',
    'search_students',
    'get_attendance_status',
    'get_attendance_summary',
    'get_attendance_by_date_range',
    'get_my_bookings',
    'get_available_rooms',
    'get_time_slots',
    'create_booking',
    'cancel_booking',
    'get_all_bookings',
    'get_equipment_items',
    'request_equipment',
    'get_my_equipment_requests',
    'get_schedule_today',
    'get_schedule_week',
    'get_school_info',
    'submit_feedback',
  ],
  librarian: [
    'get_student_profile',
    'search_students',
    'get_school_info',
  ],
  cooperative_staff: [
    'get_products',
    'get_all_orders',
    'get_equipment_items',
    'get_school_info',
  ],
  school_admin: [
    'get_student_profile',
    'search_students',
    'get_attendance_status',
    'get_attendance_summary',
    'get_attendance_by_date_range',
    'get_my_bookings',
    'get_available_rooms',
    'get_time_slots',
    'create_booking',
    'cancel_booking',
    'get_all_bookings',
    'get_all_orders',
    'get_products',
    'cancel_order',
    'get_equipment_items',
    'request_equipment',
    'get_my_equipment_requests',
    'get_all_equipment_requests',
    'get_schedule_today',
    'get_schedule_week',
    'submit_feedback',
    'get_pending_feedback',
    'get_school_stats',
    'get_school_info',
  ],
  executive: [
    'get_school_stats',
    'get_attendance_summary',
    'get_attendance_by_date_range',
    'get_schedule_today',
    'get_school_info',
    'get_pending_feedback',
  ],
  it_admin: [
    'get_school_stats',
    'get_student_profile',
    'search_students',
    'get_school_info',
  ],
  superadmin: ALL_TOOLS.map(t => t.name),
}

export function getToolsForRole(role: UserRole) {
  const allowed = new Set(TOOL_ALLOW[role] ?? TOOL_ALLOW.guest)
  return ALL_TOOLS.filter(t => allowed.has(t.name))
}

const TOOL_MODULES: Record<string, string> = {
  get_student_profile: 'students',
  search_students: 'students',
  get_attendance_status: 'attendance',
  get_attendance_summary: 'attendance',
  get_attendance_by_date_range: 'attendance',
  get_time_slots: 'booking',
  create_booking: 'booking',
  cancel_booking: 'booking',
  get_my_bookings: 'booking',
  get_available_rooms: 'booking',
  get_all_bookings: 'booking',
  place_order: 'shop',
  cancel_order: 'shop',
  get_my_orders: 'shop',
  get_products: 'shop',
  get_all_orders: 'shop',
  get_equipment_items: 'equipment',
  request_equipment: 'equipment',
  get_my_equipment_requests: 'equipment',
  get_all_equipment_requests: 'equipment',
  get_schedule_today: 'schedule',
  get_schedule_week: 'schedule',
  submit_feedback: 'feedback',
  get_pending_feedback: 'feedback',
  get_school_stats: 'dashboard',
  get_school_info: 'dashboard',
}

export async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  ctx: UserContext,
  supabase: SupabaseClient
): Promise<unknown> {
  const toolModule = TOOL_MODULES[toolName]

  switch (toolModule) {
    case 'students':   return executeStudentTool(toolName, input, ctx, supabase)
    case 'attendance': return executeAttendanceTool(toolName, input, ctx, supabase)
    case 'booking':    return executeBookingTool(toolName, input, ctx, supabase)
    case 'shop':       return executeShopTool(toolName, input, ctx, supabase)
    case 'equipment':  return executeEquipmentTool(toolName, input, ctx, supabase)
    case 'schedule':   return executeScheduleTool(toolName, input, ctx, supabase)
    case 'feedback':   return executeFeedbackTool(toolName, input, ctx, supabase)
    case 'dashboard':  return executeDashboardTool(toolName, input, ctx, supabase)
    default:           return { error: `Unknown tool: ${toolName}` }
  }
}
