import type { UserRole, UserContext } from './types'

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  guest: ['school.info'],
  student: [
    'school.info',
    'attendance.view_own',
    'booking.view_own',
    'booking.create',
    'shop.view_products',
    'shop.view_own_orders',
    'shop.create_order',
    'schedule.view',
    'feedback.create',
    'student.view_own',
  ],
  parent: [
    'school.info',
    'attendance.view_children',
    'student.view_children',
    'schedule.view',
  ],
  teacher: [
    'school.info',
    'attendance.view_all',
    'schedule.view',
    'schedule.manage',
    'student.view_all',
    'booking.view_all',
    'booking.create',
    'booking.approve',
  ],
  librarian: [
    'school.info',
    'student.view_all',
    'library.manage',
  ],
  cooperative_staff: [
    'shop.view_products',
    'shop.manage_products',
    'shop.view_all_orders',
    'shop.manage_orders',
  ],
  school_admin: [
    'school.info',
    'attendance.view_all',
    'student.view_all',
    'booking.view_all',
    'booking.approve',
    'feedback.view_all',
    'feedback.manage',
    'schedule.view',
    'schedule.manage',
    'dashboard.view',
    'notifications.send',
    'shop.view_all_orders',
  ],
  executive: [
    'school.info',
    'dashboard.view',
    'attendance.view_all',
    'student.view_all',
    'feedback.view_all',
    'booking.view_all',
    'schedule.view',
  ],
  it_admin: [
    'school.info',
    'iot.manage',
    'student.view_all',
    'dashboard.view',
    'system.manage',
    'schedule.view',
  ],
  superadmin: ['*'],
}

export function getPermissions(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.guest
}

export function can(ctx: UserContext, permission: string): boolean {
  if (ctx.permissions.includes('*')) return true
  return ctx.permissions.includes(permission)
}
