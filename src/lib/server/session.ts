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

/**
 * Check a token's signature and return the session id it carries, or null.
 *
 * Pure and database-free on purpose: a forged or truncated token is rejected
 * before any query runs, and the check is unit-testable without Supabase.
 */
export function verifyTokenSignature(token: string): string | null {
  const [sessionId, mac, ...rest] = token.split(".");
  if (!sessionId || !mac || rest.length > 0) return null;
  if (!/^[0-9a-f]+$/i.test(mac)) return null;
  return safeEqualHex(mac, sign(sessionId)) ? sessionId : null;
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
 * หา account จาก login แบบไม่สนตัวพิมพ์เล็กใหญ่
 *
 * 0001 สร้าง unique index ไว้บน lower(login) การเทียบจึงต้องเทียบแบบเดียวกัน
 * ส่วน ilike ฝั่ง PostgREST มอง % กับ _ เป็น wildcard และ username ที่ตั้งเอง
 * มีอักษรพวกนั้นได้ จึงกรองซ้ำในโค้ดให้เหลือเฉพาะแถวที่ตรงกันจริง
 */
async function findAccountIdByLogin(login: string): Promise<string | null> {
  const { data } = await getServiceClient()
    .from("user_accounts")
    .select("id, login")
    .ilike("login", login)
    .limit(5);

  const target = login.toLowerCase();
  return data?.find((row) => row.login.toLowerCase() === target)?.id ?? null;
}

/** แอดมินที่ใช้ username เดียวกับ login นี้ — คือ "อีกบทบาทหนึ่ง" ของคนเดียวกัน */
async function findAdminByUsername(
  login: string
): Promise<{ admin_id: string; role: string } | null> {
  const { data } = await getServiceClient()
    .from("admins")
    .select("admin_id, username, role")
    .ilike("username", login)
    .limit(5);

  const target = login.toLowerCase();
  const match = data?.find((row) => row.username?.toLowerCase() === target);
  return match ? { admin_id: match.admin_id, role: match.role } : null;
}

/** ผูก account เข้ากับแถว profile ตามชนิดของมัน */
async function linkProfileToAccount(
  subjectType: SubjectType,
  subjectId: string,
  accountId: string
): Promise<boolean> {
  const supabase = getServiceClient();

  if (subjectType === "admin") {
    const { error } = await supabase
      .from("admins")
      .update({ account_id: accountId })
      .eq("admin_id", subjectId);
    return !error;
  }
  if (subjectType === "student") {
    const { error } = await supabase
      .from("students")
      .update({ account_id: accountId })
      .eq("student_id", subjectId);
    return !error;
  }
  if (subjectType === "teacher") {
    const { error } = await supabase
      .from("teachers")
      .update({ account_id: accountId })
      .eq("id", subjectId);
    return !error;
  }
  return false;
}

/**
 * ให้ profile ที่ยังไม่มี account ได้ account — ใช้ของเดิมที่ login ตรงกัน หรือสร้างใหม่
 *
 * 0002 สร้าง user_accounts ให้เฉพาะคนที่มีอยู่ ณ วันที่รัน ส่วนแอดมิน/นักเรียนที่ถูก
 * สร้างหลังจากนั้นไม่มีใครสร้าง account ให้เลย คุกกี้จึงออกไม่ได้ แล้วทุก route ที่
 * ผ่าน withAuth ตอบ 401 ทั้งที่ล็อกอินผ่านแล้ว ฝั่งแอดมินมองไม่เห็นปัญหานี้เพราะยังมี
 * x-admin-id รับไว้ ส่วนนักเรียนไม่มีทางอื่นเลย หน้าแจ้งซ่อมและหน้าอื่นที่เรียก API
 * จึงพังเงียบ ๆ ตั้งแต่ล็อกอินสำเร็จ
 *
 * ถ้ามี account ที่ login ตรงกันอยู่แล้วต้องใช้ตัวนั้น ห้ามสร้างใหม่ — คนที่เป็นทั้ง
 * แอดมินและนักเรียน (admins.username = students.student_id) คือคนคนเดียว และต้องมี
 * account เดียวตามที่ 0010 วางไว้ ไม่งั้น audit log จะแตกเป็นสองสาย
 *
 * ตรรกะเดียวกับ 0002 ทุกประการ ต่างแค่ทำตอนล็อกอินแทนตอน migrate
 */
export async function ensureAccountForProfile(
  subjectType: SubjectType,
  subjectId: string,
  login: string
): Promise<string | null> {
  const supabase = getServiceClient();
  let accountId = await findAccountIdByLogin(login);

  if (!accountId) {
    // 0002 สร้างบัญชีฝั่งแอดมินก่อนฝั่งนักเรียนเสมอ ตรงนี้ต้องเรียงเหมือนกัน
    // ถ้าปล่อยให้ฝั่งนักเรียนสร้างก่อน account จะเป็น subject_type 'student'
    // แล้ว resolveFromCookie จะ resolve คนสองบทบาทเป็นนักเรียนทุกครั้ง ซึ่งร้ายกว่า
    // ที่คิด เพราะคุกกี้ถูกอ่านก่อน x-admin-id เขาจึงเสียสิทธิ์แอดมินทั้งที่ยังส่ง
    // header ตัวเก่าอยู่
    const twinAdmin = subjectType === "student" ? await findAdminByUsername(login) : null;

    const { data, error } = await supabase
      .from("user_accounts")
      .insert({
        login,
        subject_type: twinAdmin ? "admin" : subjectType,
        status: "active",
      })
      .select("id")
      .single();

    // 23505 = มีคนสร้าง login นี้แทรกเข้ามาระหว่างทาง อ่านซ้ำแล้วใช้ของเขา
    accountId = data?.id ?? (error?.code === "23505" ? await findAccountIdByLogin(login) : null);

    if (!accountId) {
      console.warn(
        `[session] สร้าง user_accounts ให้ ${subjectType}:${subjectId} ไม่สำเร็จ:`,
        error?.message
      );
      return null;
    }

    if (twinAdmin && data?.id) {
      // account เกิดใหม่ยังไม่มี grant เลย ซึ่งพอสำหรับคนที่มี profile เดียว
      // (loadRolesForAccount ตกไปใช้ค่า default ตาม subject_type ให้เอง) แต่คน
      // สองบทบาทต้องได้ทั้งสอง role และต้องใส่พร้อมกัน — ใส่แค่ STUDENT อย่างเดียว
      // จะไปปิด fallback ฝั่งแอดมินทิ้ง แล้วเขาจะเหลือแค่สิทธิ์นักเรียน
      // (บทเรียนเดียวกับที่ 0009 บันทึกไว้)
      const { error: grantError } = await supabase.from("user_roles").insert([
        { account_id: accountId, role_key: LEGACY_ADMIN_ROLE_MAP[twinAdmin.role] ?? "ACADEMIC" },
        { account_id: accountId, role_key: "STUDENT" },
      ]);
      if (grantError) {
        console.warn(`[session] ให้ role กับ ${twinAdmin.admin_id} ไม่สำเร็จ:`, grantError.message);
      }

      // ผูก profile ฝั่งแอดมินด้วย ไม่งั้นรอบหน้าที่เขาล็อกอินฝั่งแอดมินจะสร้างซ้ำ
      // แล้วชน unique index บน lower(login) — งานเดียวกับที่ 0010 ทำให้
      const { error: linkError } = await supabase
        .from("admins")
        .update({ account_id: accountId })
        .eq("admin_id", twinAdmin.admin_id);
      if (linkError) {
        console.warn(`[session] ผูก ${twinAdmin.admin_id} เข้ากับ account ไม่สำเร็จ:`, linkError.message);
      }
    }
  }

  return (await linkProfileToAccount(subjectType, subjectId, accountId)) ? accountId : null;
}

/**
 * Best-effort: look up the account for a profile, issue a session, and set the
 * cookie on `res`.
 *
 * Deliberately swallows every error. The app is deployed before the Phase 1
 * migrations run against production, so `user_accounts` may not exist yet and
 * `account_id` may still be NULL — neither may be allowed to break login.
 *
 * โปรไฟล์ที่ยังไม่มี account จะถูกสร้างให้ตรงนี้ ไม่ใช่ปล่อยผ่านเป็น no-op เหมือนเดิม
 * เพราะ "ปล่อยผ่าน" แปลว่านักเรียนล็อกอินได้แต่เรียก API อะไรไม่ได้เลย (401 ทุกเส้น)
 * ซึ่งแย่กว่าล็อกอินไม่ผ่านเสียอีก เพราะหน้าเว็บดูเหมือนใช้งานได้ปกติ
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
    // ค่าที่จะใช้เป็น login ถ้าต้องสร้าง account ให้ profile นี้ — ต้องตรงกับที่ 0002 ใช้
    let login: string | null = null;

    if (subjectType === "admin") {
      const { data } = await supabase
        .from("admins")
        .select("account_id, username")
        .eq("admin_id", subjectId)
        .maybeSingle();
      accountId = data?.account_id ?? null;
      login = data?.username ?? null;
    } else if (subjectType === "student") {
      const { data } = await supabase
        .from("students")
        .select("account_id, student_id")
        .eq("student_id", subjectId)
        .maybeSingle();
      accountId = data?.account_id ?? null;
      login = data?.student_id ?? null;
    } else if (subjectType === "teacher") {
      const { data } = await supabase
        .from("teachers")
        .select("account_id, desired_username")
        .eq("id", subjectId)
        .maybeSingle();
      accountId = data?.account_id ?? null;
      login = data?.desired_username ?? null;
    }

    if (!accountId && login) {
      accountId = await ensureAccountForProfile(subjectType, subjectId, login);
    }

    if (!accountId) {
      // ไม่เงียบอีกต่อไป อาการที่ปลายทางคือ 401 ทุกเส้นโดยไม่มีอะไรบอกว่าทำไม
      console.warn(
        `[session] ออกคุกกี้ให้ ${subjectType}:${subjectId} ไม่ได้ เพราะยังไม่มี user_accounts` +
          " — ทุก route ที่ผ่าน withAuth จะตอบ 401"
      );
      return false;
    }

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
    // ตั้ง SESSION_COOKIE_DOMAIN=".asia-bot.xyz" เพื่อให้ล็อกอินครั้งเดียว
    // แล้วใช้ได้ทั้งโดเมนหลักและซับโดเมน Mycer — ไม่ตั้งก็จะเป็นคุกกี้ของ
    // โฮสต์นั้นโฮสต์เดียวเหมือนเดิม ซึ่งเป็นค่าที่ปลอดภัยกว่าตอนยังไม่มีซับโดเมน
    ...(process.env.SESSION_COOKIE_DOMAIN
      ? { domain: process.env.SESSION_COOKIE_DOMAIN }
      : {}),
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

  // Verify the signature before touching the database so a forged or truncated
  // token costs nothing.
  if (!verifyTokenSignature(token)) return null;

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

/**
 * เวอร์ชันสำหรับ Server Component ที่ไม่มี Request ในมือ
 *
 * resolvePrincipal ต้องรับ Request เพราะยังต้องอ่าน header ตัวเก่า (x-admin-id)
 * แต่หน้า RSC อ่าน header นั้นไม่ได้อยู่แล้ว และไม่ควรอ่านด้วย — header
 * ตัวเก่าคือช่องทางที่ Phase 14 จะปิด หน้าที่เขียนใหม่จึงเริ่มจากคุกกี้อย่างเดียว
 */
export async function getPrincipal(): Promise<Principal | null> {
  return resolveFromCookie();
}
