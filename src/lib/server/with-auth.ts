import "server-only";
import { NextResponse } from "next/server";
import { getServiceClient } from "./supabase-server";
import { resolvePrincipal, type Principal } from "./session";
import { hasPermission } from "@/lib/rbac/definitions";

/**
 * One wrapper that resolves the caller, enforces a permission, and records an
 * audit entry:
 *
 *   export const POST = withAuth(handler, {
 *     permission: "shop.manage_products",
 *     audit: { action: "product.create", entityType: "product" },
 *   });
 *
 * Before Phase 1 each route re-solved this itself — 37 routes called
 * `checkAdminAuth`, several more duplicated a local `getRequester()`, and five
 * admin routes had no check at all. Nothing recorded who changed what.
 *
 * Error bodies keep the existing `{ status: "error", message }` shape so the
 * admin SPA and student pages parse them unchanged.
 */

export type AuthedContext<P> = {
  principal: Principal;
  params: P;
};

/** Returned by a handler to fill in the audit row. */
export type AuditPayload = {
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

export type AuthedHandler<P> = (
  req: Request,
  ctx: AuthedContext<P>
) => Promise<Response | { response: Response; audit?: AuditPayload }>;

export type WithAuthOptions = {
  /** Capability required, e.g. "shop.manage_products". Omit to require only a valid identity. */
  permission?: string;
  audit?: {
    /** Dotted verb, e.g. "product.create". */
    action: string;
    entityType?: string;
  };
};

function unauthorized() {
  return NextResponse.json(
    { status: "error", message: "กรุณาเข้าสู่ระบบ" },
    { status: 401 }
  );
}

function forbidden() {
  return NextResponse.json(
    { status: "error", message: "ไม่มีสิทธิ์เข้าถึงส่วนนี้" },
    { status: 403 }
  );
}

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}

/**
 * Audit writes must never break the request that succeeded — a logging
 * failure would otherwise turn a completed write into a 500 the caller
 * retries, duplicating the write.
 */
async function writeAudit(
  req: Request,
  principal: Principal,
  action: string,
  entityType: string | undefined,
  payload: AuditPayload | undefined
): Promise<void> {
  try {
    await getServiceClient().from("audit_logs").insert({
      actor_account_id: principal.accountId,
      actor_label: `${principal.subjectType}:${principal.subjectId}`,
      actor_role: principal.roles.join(","),
      action,
      entity_type: entityType ?? null,
      entity_id: payload?.entityId ?? null,
      before: (payload?.before ?? null) as never,
      after: (payload?.after ?? null) as never,
      ip_address: clientIp(req),
      user_agent: req.headers.get("user-agent"),
    });
  } catch (error) {
    console.error("[audit] failed to record", action, error);
  }
}

export function withAuth<P = Record<string, string>>(
  handler: AuthedHandler<P>,
  options: WithAuthOptions = {}
) {
  // The second parameter is declared required, not optional: Next 15 generates
  // a RouteContext check per route and `... | undefined` fails it even for
  // non-dynamic routes. Next always passes a context object at runtime.
  return async function wrapped(
    req: Request,
    routeCtx: { params: Promise<P> }
  ): Promise<Response> {
    const principal = await resolvePrincipal(req);
    if (!principal) return unauthorized();

    if (options.permission && !hasPermission(principal.permissions, options.permission)) {
      return forbidden();
    }

    // Next 15 hands route params in as a promise. Non-dynamic routes still get
    // a context object, but with no params to await.
    const params = routeCtx?.params ? await routeCtx.params : ({} as P);

    const result = await handler(req, { principal, params });
    const response = result instanceof Response ? result : result.response;
    const auditPayload = result instanceof Response ? undefined : result.audit;

    // Only record successful mutations; a rejected request is not a change.
    if (options.audit && response.ok) {
      await writeAudit(req, principal, options.audit.action, options.audit.entityType, auditPayload);
    }

    return response;
  };
}

/**
 * Record an action from a route that has not been migrated to `withAuth` yet.
 * Same guarantee: never throws.
 */
export async function recordAudit(
  req: Request,
  principal: Principal,
  action: string,
  entityType?: string,
  payload?: AuditPayload
): Promise<void> {
  await writeAudit(req, principal, action, entityType, payload);
}
