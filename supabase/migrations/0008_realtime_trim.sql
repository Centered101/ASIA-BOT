-- ============================================================
-- 0008 — Stop broadcasting admins.password_hash over realtime
--
-- schema.sql adds ~32 tables to the supabase_realtime publication so the admin
-- panel updates across sessions. `admins` is one of them — and that table
-- carries password_hash.
--
-- Realtime publishes the whole row on every change. With RLS disabled
-- (schema.sql:637-643) and the anon key shipping to the browser, that row is
-- reachable by anyone who can open a realtime subscription.
--
-- The admin panel DOES depend on this subscription — src/app/admin/page.tsx
-- line ~702 maps `admins` to the dashboard/admins/settings tabs — so simply
-- dropping the table from the publication would break live refresh. Instead
-- we republish it with an explicit column list that omits password_hash.
-- Every column the UI reads is still included, so behaviour is unchanged.
--
-- REQUIRES PostgreSQL 15+ (publication column lists). Supabase is on 17.
-- Safe to run twice.
-- ============================================================

DO $$
DECLARE
  pg_major integer := current_setting('server_version_num')::integer / 10000;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'supabase_realtime publication not found; nothing to do.';
    RETURN;
  END IF;

  IF pg_major < 15 THEN
    -- No column lists before 15: drop the table rather than keep leaking the
    -- hash. Live refresh of the admins tab is lost until the DB is upgraded.
    RAISE WARNING 'PostgreSQL % does not support publication column lists; dropping public.admins from supabase_realtime instead.', pg_major;
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admins'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.admins';
    END IF;
    RETURN;
  END IF;

  -- Republish with an explicit column list. DROP first because a table's
  -- column list cannot be altered in place.
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admins'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.admins';
  END IF;

  EXECUTE $sql$
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admins (
      id, admin_id, username, role,
      first_name, last_name, nickname, email, phone,
      entry_year, department, avatar, admin_status,
      created_at, username_changed_at, linked_student_id,
      google_id, google_email, account_id
    )
  $sql$;
END $$;

-- The Phase 1 tables (user_accounts, auth_sessions, audit_logs, user_roles,
-- roles, permissions, role_permissions) are deliberately NOT added to the
-- publication — they hold credentials, session hashes, and before/after
-- snapshots of sensitive fields.

-- ------------------------------------------------------------
-- SMOKE
--   -- password_hash must NOT appear; the other 19 columns must:
--   SELECT unnest(attnames) AS col
--     FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' AND tablename = 'admins'
--    ORDER BY 1;
--
--   -- admins must still be published, and the other tables untouched (~32):
--   SELECT count(*) FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' AND schemaname = 'public';
--
-- Then reload the admin panel and confirm the admins/dashboard tabs still
-- update live when another session edits an admin.
-- ------------------------------------------------------------

-- ROLLBACK:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.admins;
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.admins;
