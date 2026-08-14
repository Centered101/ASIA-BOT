import type { UserRole, UserContext } from './types'
import {
  LEGACY_AGENT_ROLE_PERMISSIONS,
  hasPermission,
} from '@/lib/rbac/definitions'

/**
 * Agent-side permission checks.
 *
 * The role/permission data moved to src/lib/rbac/definitions.ts in Phase 1 so
 * the API layer and the agent share one source of truth. The agent still uses
 * its own lowercase role names (see ./types), so it reads the frozen
 * LEGACY_AGENT_ROLE_PERMISSIONS table — identical to what lived here before,
 * so `can()` behaves exactly as it did.
 */

export function getPermissions(role: UserRole): string[] {
  return LEGACY_AGENT_ROLE_PERMISSIONS[role] ?? LEGACY_AGENT_ROLE_PERMISSIONS.guest
}

export function can(ctx: UserContext, permission: string): boolean {
  return hasPermission(ctx.permissions, permission)
}
