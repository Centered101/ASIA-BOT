-- ============================================================
-- 0005 — Audit log
--
-- The only logging today is login_logs / admin_logs (authentication attempts)
-- and agent_logs (AI calls). Nothing records who changed what: editing a
-- student, approving a request, or changing a role leaves no trace.
--
-- Roadmap §26 makes this mandatory before grades, finance, and approvals
-- exist, so it lands in Phase 1 rather than after those modules are built.
--
-- Additive only. Safe to run twice.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Nullable: break-glass env-superadmin actions have no account row, and we
  -- would rather record the action with actor_label than drop it entirely.
  actor_account_id uuid,
  actor_label text,
  actor_role text,
  -- Dotted verb, e.g. 'product.create', 'student.update', 'role.grant'.
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_account_id_fkey
    FOREIGN KEY (actor_account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL
);

-- "show me the history of this one record"
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON public.audit_logs (entity_type, entity_id);

-- "show me what happened recently" / "what did this person do"
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON public.audit_logs (actor_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON public.audit_logs (action, created_at DESC);

COMMENT ON TABLE public.audit_logs IS
  'Who changed what, when, with before/after. Written by withAuth() in src/lib/server/with-auth.ts.';

-- Deliberately NOT added to the supabase_realtime publication: audit rows can
-- contain the previous values of sensitive fields.

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.audit_logs;   -- expect 0
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'audit_logs';          -- expect 5 (pkey + 4)
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.audit_logs;
