export type Channel = 'line' | 'web' | 'mobile' | 'discord' | 'telegram' | 'api'

export type UserRole =
  | 'guest'
  | 'student'
  | 'parent'
  | 'teacher'
  | 'librarian'
  | 'cooperative_staff'
  | 'school_admin'
  | 'executive'
  | 'it_admin'
  | 'superadmin'

export interface StudentData {
  student_id: string
  first_name: string
  last_name: string
  nickname?: string | null
  program: string
  department?: string | null
  entry_year?: string
  photo_url?: string | null
}

export interface AdminData {
  admin_id: string
  role: string
  first_name?: string | null
  last_name?: string | null
}

// Standardized request from any channel
export interface AgentRequest {
  channel: Channel
  userId: string
  userType: 'student' | 'admin' | 'guest'
  role: UserRole
  message: string
  language: 'th' | 'en'
  sessionId: string            // '{channel}:{userId}'
  studentData?: StudentData
  adminData?: AdminData
  metadata?: Record<string, unknown>
}

// Resolved context injected into every AI call
export interface UserContext {
  userId: string
  userType: 'student' | 'admin' | 'guest'
  role: UserRole
  displayName: string
  permissions: string[]
  channel: Channel
  language: 'th' | 'en'
  timestamp: string
  studentData?: StudentData
  adminData?: AdminData
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentResponse {
  text: string
  toolsUsed: string[]
  latencyMs: number
  sessionId: string
  richData?: { type: string; payload: unknown }
  events?: { type: string; payload?: unknown }[]
}
