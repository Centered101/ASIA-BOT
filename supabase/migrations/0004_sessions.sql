-- ============================================================
-- 0004 — Server-side sessions
--
-- Admin auth today is the `x-admin-id` request header: the header IS the
-- credential (src/lib/admin-auth.ts). Anyone who learns an admin_id has that
-- admin's access — there is no token, no signature, no expiry, and no way to
-- revoke. Student "sessions" are unsigned JSON in localStorage.
--
-- This table backs signed, expiring cookies. Only the SHA-256 hash of the
-- token is stored, so a database leak does not hand over live sessions.
--
-- Additive only. Safe to run twice.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  -- SHA-256 of the token. Never store the token itself.
  token_hash text NOT NULL,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  ip_address text,
  user_agent text,
  CONSTRAINT auth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_sessions_token_hash_key UNIQUE (token_hash),
  CONSTRAINT auth_sessions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS auth_sessions_account_id_idx ON public.auth_sessions (account_id);

-- Lookup path for "is this session still good?" — partial so the index stays
-- small as revoked rows accumulate.
CREATE INDEX IF NOT EXISTS auth_sessions_active_idx
  ON public.auth_sessions (expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE public.auth_sessions IS
  'Signed session tokens (SHA-256 hashed). Backs the httpOnly session cookie introduced in Phase 1.';

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.auth_sessions;   -- expect 0
--
-- Housekeeping (run periodically, not part of this migration):
--   DELETE FROM public.auth_sessions
--    WHERE expires_at < now() - interval '30 days';
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.auth_sessions;
