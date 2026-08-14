import "server-only";
import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getServiceClient } from "./supabase-server";
import {
  DEFAULT_ROLE_BY_SUBJECT,
  LEGACY_ADMIN_ROLE_MAP,
  isRole,
  permissionsForRoles,
  type Role,
  type SubjectType,
} from "@/lib/rbac/definitions";

/**
 * Verifiable sessions.
 *
 * Before Phase 1 the admin credential was the plaintext `x-admin-id` header —
 * the header WAS the identity, so anyone who learned an admin_id had that
 * admin's access, with no expiry and no way to revoke. Students had unsigned
 * JSON in localStorage.
 *
 * A session token here is `<sessionId>.<hmac>`. The HMAC is over the session
 * id using SESSION_SIGNING_SECRET, so a forged id fails before any database
 * round-trip. Only the SHA-256 of the whole token is stored, so a database
 * leak does not hand over live sessions.
 *
 * The legacy header is still accepted while AUTH_LEGACY_HEADER=1 (the Phase 1
 * default) so the 11.5k-line admin SPA keeps working unchanged. Phase 14 turns
 * it off.
 */

export const SESSION_COOKIE = "asia_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matching SESSION_TTL in config.ts

export type ScopeRef = { type: string; id: string };

export type Principal = {
  accountId: string | null;
  subjectType: SubjectType;
  /** admin_id / student_id / teacher id, depending on subjectType. */
  subjectId: string;
  displayName: string;
  roles: Role[];
  permissions: string[];
  /** Scoped grants, e.g. ADVISOR limited to one class_group. */
  scopes: ScopeRef[];
  /** True when resolved via the deprecated x-admin-id header. */
  viaLegacyHeader: boolean;
};

function signingSecret(): string {
  const secret = process.env.SESSION_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SIGNING_SECRET is missing or too short (need >= 16 chars). See .env.example."
    );
  }
  return secret;
}

function sign(sessionId: string): string {
  return createHmac("sha256", signingSecret()).update(sessionId).digest("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function legacyHeaderEnabled(): boolean {
  // Default ON for Phase 1: an unset var must not lock every admin out.
  return (process.env.AUTH_LEGACY_HEADER ?? "1") !== "0";
}

/** Constant-time compare of two hex strings of equal length. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

// ─── Issuing ─────────────────────────────────────────────────────────────────

export type IssueSessionInput = {
  accountId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Create a session row and return the raw token.
 * The caller sets it as a cookie via `sessionCookieOptions()`.
 */
export async function issueSession({
  accountId,
  ipAddress,
  userAgent,
}: IssueSessionInput): Promise<{ token: string; expiresAt: Date }> {
  const supabase = getServiceClient();
  const sessionId = randomBytes(18).toString("hex");
  const token = `${sessionId}.${sign(sessionId)}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const { error } = await supabase.from("auth_sessions").insert({
    account_id: accountId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
    ip_address: ipAddress ?? null,
    user_agent: userAgent ?? null,
  });
  if (error) throw new Error(`Could not create session: ${error.message}`);

  await supabase
    .from("user_accounts")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", accountId);

  return { token, expiresAt };
}

/**
 * Best-effort: look up the account for a profile, issue a session, and set the
 * cookie on `res`.
 *
 * Deliberately swallows every error. The app is deployed before the Phase 1
 * migrations run against production, so `user_accounts` may not exist yet and
 * `account_id` may still be NULL — neither may be allowed to break login. When
 * this no-ops the caller simply keeps the existing localStorage session, which
 * still works via the legacy header path.
 */
export async function attachSessionCookie(
  res: { cookies: { set: (opts: ReturnType<typeof sessionCookieOptions> & { value: string }) => unknown } },
  req: Request,
  subjectType: SubjectType,
  subjectId: string
): Promise<boolean> {
  try {
    if (!process.env.SESSION_SIGNING_SECRET) return false;

    const supabase = getServiceClient();
    let accountId: string | null = null;

    if (subjectType === "admin") {
      const { data } = await supabase
        .from("admins")
        .select("account_id")
        .eq("admin_id", subjectId)
        .maybeSingle();
      accountId = data?.account_id ?? null;
    } else if (subjectType === "student") {
      const { data } = await supabase
        .from("students")
        .select("account_id")
        .eq("student_id", subjectId)
        .maybeSingle();
      accountId = data?.account_id ?? null;
    } else if (subjectType === "teacher") {
      const { data } = await supabase
        .from("teachers")
        .select("account_id")
        .eq("id", subjectId)
        .maybeSingle();
      accountId = data?.account_id ?? null;
    }

    if (!accountId) return false;

    const { token, expiresAt } = await issueSession({
      accountId,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
    });

    res.cookies.set({ ...sessionCookieOptions(expiresAt), value: token });
    return true;
  } catch (error) {
    console.warn("[session] cookie not issued (migrations may not have run yet):", error);
    return false;
  }
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export async function revokeSession(token: string): Promise<void> {
  await getServiceClient()
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", hashToken(token));
}

/** Revoke every live session for an account (password change, role change, lockout). */
export async function revokeAllSessions(accountId: string): Promise<void> {
  await getServiceClient()
    .from("auth_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .is("revoked_at", null);
}

// ─── Resolving ───────────────────────────────────────────────────────────────

type AccountRow = {
  id: string;
  login: string;
  subject_type: string;
  status: string;
};

function isSubjectType(value: string): value is SubjectType {
  return value === "admin" || value === "teacher" || value === "student" || value === "parent" || value === "alumni";
}

/**
 * Roles + scopes for an account.
 *
 * `fallback` matters: an account with no explicit `user_roles` row must not
 * silently drop to the subject-type default. That bug shipped once — after
 * 0002 linked every admin to an account but before `user_roles` was seeded,
 * EVERY admin (superadmin included) resolved to ACADEMIC and lost write
 * access. Callers pass the legacy `admins.role` mapping so the account path
 * can never grant less than the pre-Phase-1 header path did.
 */
async function loadRolesForAccount(
  accountId: string,
  subjectType: SubjectType,
  fallback?: Role
): Promise<{ roles: Role[]; scopes: ScopeRef[] }> {
  const { data } = await getServiceClient()
    .from("user_roles")
    .select("role_key, scope_type, scope_id")
    .eq("account_id", accountId);

  const roles: Role[] = [];
  const scopes: ScopeRef[] = [];

  for (const row of data ?? []) {
    if (isRole(row.role_key)) roles.push(row.role_key);
    if (row.scope_type && row.scope_id) {
      scopes.push({ type: row.scope_type, id: row.scope_id });
    }
  }

  if (roles.length === 0) {
    roles.push(fallback ?? DEFAULT_ROLE_BY_SUBJECT[subjectType]);
  }
  return { roles, scopes };
}

/** The role an admin/teacher/student profile implies, for use as a fallback. */
async function legacyRoleFor(
  accountId: string,
  subjectType: SubjectType
): Promise<Role | undefined> {
  if (subjectType !== "admin") return undefined;
  const { data } = await getServiceClient()
    .from("admins")
    .select("role")
    .eq("account_id", accountId)
    .maybeSingle();
  return data ? LEGACY_ADMIN_ROLE_MAP[data.role] : undefined;
}

async function principalFromAccount(
  account: AccountRow,
  subjectId: string,
  displayName: string,
  viaLegacyHeader: boolean
): Promise<Principal | null> {
  if (account.status !== "active") return null;
  if (!isSubjectType(account.subject_type)) return null;

  const fallback = await legacyRoleFor(account.id, account.subject_type);
  const { roles, scopes } = await loadRolesForAccount(account.id, account.subject_type, fallback);

  return {
    accountId: account.id,
    subjectType: account.subject_type,
    subjectId,
    displayName,
    roles,
    permissions: permissionsForRoles(roles),
    scopes,
    viaLegacyHeader,
  };
}

/** Resolve via the signed session cookie. */
async function resolveFromCookie(): Promise<Principal | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [sessionId, mac] = token.split(".");
  if (!sessionId || !mac) return null;

  // Verify the signature before touching the database so a forged or truncated
  // token costs nothing.
  if (!safeEqualHex(mac, sign(sessionId))) return null;

  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("auth_sessions")
    .select("id, account_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  const { data: account } = await supabase
    .from("user_accounts")
    .select("id, login, subject_type, status")
    .eq("id", session.account_id)
    .maybeSingle();
  if (!account) return null;

  const { subjectId, displayName } = await loadProfile(account);
  return principalFromAccount(account, subjectId, displayName, false);
}

/** Map an account back to its profile row for subjectId + display name. */
async function loadProfile(account: AccountRow): Promise<{ subjectId: string; displayName: string }> {
  const supabase = getServiceClient();

  if (account.subject_type === "admin") {
    const { data } = await supabase
      .from("admins")
      .select("admin_id, first_name, last_name, nickname")
      .eq("account_id", account.id)
      .maybeSingle();
    if (data) {
      return {
        subjectId: data.admin_id,
        displayName: data.nickname ?? data.first_name ?? account.login,
      };
    }
  }

  if (account.subject_type === "student") {
    const { data } = await supabase
      .from("students")
      .select("student_id, first_name, nickname")
      .eq("account_id", account.id)
      .maybeSingle();
    if (data) {
      return {
        subjectId: data.student_id,
        displayName: data.nickname ?? data.first_name ?? account.login,
      };
    }
  }

  if (account.subject_type === "teacher") {
    const { data } = await supabase
      .from("teachers")
      .select("id, full_name, nickname")
      .eq("account_id", account.id)
      .maybeSingle();
    if (data) {
      return { subjectId: data.id, displayName: data.nickname ?? data.full_name };
    }
  }

  return { subjectId: account.login, displayName: account.login };
}

/**
 * Resolve via the deprecated `x-admin-id` header.
 *
 * This reproduces src/lib/admin-auth.ts exactly, including the two env
 * superadmin bypasses, so nothing that works today stops working. It is gated
 * behind AUTH_LEGACY_HEADER and is the path Phase 14 removes.
 */
async function resolveFromLegacyHeader(req: Request): Promise<Principal | null> {
  if (!legacyHeaderEnabled()) return null;

  const adminId = req.headers.get("x-admin-id");
  if (!adminId) return null;

  const envSuperadmin = (subjectId: string, displayName: string): Principal => ({
    accountId: null,
    subjectType: "admin",
    subjectId,
    displayName,
    roles: ["SUPER_ADMIN"],
    permissions: permissionsForRoles(["SUPER_ADMIN"]),
    scopes: [],
    viaLegacyHeader: true,
  });

  const fallbackUsername = process.env.ADMIN_FALLBACK_USERNAME;
  const fallbackPassword = process.env.ADMIN_FALLBACK_PASSWORD;
  if (fallbackUsername && fallbackPassword && adminId === "__env_superadmin__") {
    return envSuperadmin("__env_superadmin__", "Super Admin");
  }

  const envPassword = process.env.ADMIN_PASSWORD;
  if (envPassword && adminId === envPassword) {
    return envSuperadmin("env", "Admin");
  }

  const supabase = getServiceClient();
  const { data: admin } = await supabase
    .from("admins")
    .select("id, admin_id, role, first_name, last_name, nickname, admin_status, account_id")
    .eq("admin_id", adminId)
    .eq("admin_status", "active")
    .maybeSingle();
  if (!admin) return null;

  const displayName = admin.nickname ?? admin.first_name ?? admin.admin_id;

  // Prefer explicit user_roles grants once the account exists, but always pass
  // the legacy admins.role mapping as the fallback — between 0002 (accounts
  // linked) and the user_roles backfill there are no grants to find, and
  // without this an admin would silently resolve to the subject-type default.
  const legacyMapped = LEGACY_ADMIN_ROLE_MAP[admin.role] ?? "ACADEMIC";

  if (admin.account_id) {
    const { roles, scopes } = await loadRolesForAccount(admin.account_id, "admin", legacyMapped);
    return {
      accountId: admin.account_id,
      subjectType: "admin",
      subjectId: admin.admin_id,
      displayName,
      roles,
      permissions: permissionsForRoles(roles),
      scopes,
      viaLegacyHeader: true,
    };
  }

  return {
    accountId: null,
    subjectType: "admin",
    subjectId: admin.admin_id,
    displayName,
    roles: [legacyMapped],
    permissions: permissionsForRoles([legacyMapped]),
    scopes: [],
    viaLegacyHeader: true,
  };
}

/**
 * The one entry point for "who is making this request?".
 * Cookie first, then the legacy header while it is still enabled.
 */
export async function resolvePrincipal(req: Request): Promise<Principal | null> {
  const fromCookie = await resolveFromCookie();
  if (fromCookie) return fromCookie;
  return resolveFromLegacyHeader(req);
}
