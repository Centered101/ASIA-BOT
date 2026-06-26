import type { AgentRequest, StudentData, AdminData, UserRole } from '../types'

interface WebStudentSession {
  student_id: string
  first_name: string
  last_name: string
  nickname?: string
  program: string
  department?: string
  entry_year?: string
  photo_url?: string
}

interface WebAdminSession {
  id: string
  admin_id: string
  role: 'superadmin' | 'admin' | 'staff'
  first_name?: string | null
  last_name?: string | null
}

const ADMIN_ROLE_MAP: Record<string, UserRole> = {
  superadmin: 'superadmin',
  admin: 'school_admin',
  staff: 'school_admin',
}

/**
 * Build a standardized AgentRequest for the web chat interface.
 */
export function buildWebStudentRequest(
  student: WebStudentSession,
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[] = []
): AgentRequest {
  const language: 'th' | 'en' = /[฀-๿]/.test(message) ? 'th' : 'en'
  void history // history managed via memory system using sessionId

  const studentData: StudentData = {
    student_id: student.student_id,
    first_name: student.first_name,
    last_name: student.last_name,
    nickname: student.nickname,
    program: student.program,
    department: student.department,
    entry_year: student.entry_year,
    photo_url: student.photo_url,
  }

  return {
    channel: 'web',
    userId: student.student_id,
    userType: 'student',
    role: 'student',
    message,
    language,
    sessionId: `web:${student.student_id}`,
    studentData,
  }
}

export function buildWebAdminRequest(
  admin: WebAdminSession,
  message: string
): AgentRequest {
  const language: 'th' | 'en' = /[฀-๿]/.test(message) ? 'th' : 'en'
  const role: UserRole = ADMIN_ROLE_MAP[admin.role] ?? 'school_admin'

  const adminData: AdminData = {
    admin_id: admin.admin_id,
    role: admin.role,
    first_name: admin.first_name,
    last_name: admin.last_name,
  }

  return {
    channel: 'web',
    userId: admin.admin_id,
    userType: 'admin',
    role,
    message,
    language,
    sessionId: `web:admin:${admin.admin_id}`,
    adminData,
  }
}

export function buildWebGuestRequest(message: string): AgentRequest {
  return {
    channel: 'web',
    userId: 'guest',
    userType: 'guest',
    role: 'guest',
    message,
    language: /[฀-๿]/.test(message) ? 'th' : 'en',
    sessionId: 'web:guest',
  }
}
