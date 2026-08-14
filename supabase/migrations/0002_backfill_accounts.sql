-- ============================================================
-- 0002 — Backfill user_accounts from existing rows  (DATA ONLY, no DDL)
--
-- Creates one account per existing admin / student / approved teacher and
-- links profile.account_id.
--
-- Teachers get a login for the first time here. `teachers` already carries
-- desired_username + desired_password_hash, collected by /become-teacher and
-- until now unused — that is the credential we promote.
--
-- Students deliberately get password_hash = NULL. They currently authenticate
-- with student_id + student_phone; a phone number must not become a stored
-- password hash. Their login path is unchanged by this migration.
--
-- ── FIXED after a 23505 failure on production ──────────────────────────────
-- The first version carried google_id / google_email straight into the INSERT
-- while guarding only `ON CONFLICT (lower(login))`. 0001 creates THREE unique
-- indexes (login, google_id, google_email), and ON CONFLICT handles exactly
-- one — so a google_id collision aborted the whole migration.
--
-- The collision is real and expected in this data: `google_id` here holds the
-- Supabase Auth user id (a UUID), and one person who is both an admin and a
-- student carries the same value in both tables — which is precisely what
-- `admins.linked_student_id` exists to model.
--
-- Fix: insert accounts WITHOUT the Google columns, then populate them in a
-- separate pass that only fills values which are unambiguous. The profile
-- tables keep their own google_id/google_email, and today's Google login
-- resolves against those tables (see /api/auth/google and
-- /api/admin/auth/google), not against user_accounts — so nothing regresses.
-- Collisions are reported by the final query instead of being guessed at.
--
-- Idempotent: every statement is guarded so re-running changes nothing.
-- ============================================================

-- --- Admins -------------------------------------------------
INSERT INTO public.user_accounts (login, password_hash, subject_type, status)
SELECT
  a.username,
  a.password_hash,
  'admin',
  CASE WHEN a.admin_status = 'active' THEN 'active' ELSE 'inactive' END
FROM public.admins a
WHERE a.account_id IS NULL
  AND a.username IS NOT NULL
ON CONFLICT (lower(login)) DO NOTHING;

UPDATE public.admins a
SET account_id = ua.id
FROM public.user_accounts ua
WHERE a.account_id IS NULL
  AND ua.subject_type = 'admin'
  AND lower(ua.login) = lower(a.username);

-- --- Students -----------------------------------------------
INSERT INTO public.user_accounts (login, password_hash, subject_type, status)
SELECT
  s.student_id,
  NULL,
  'student',
  'active'
FROM public.students s
WHERE s.account_id IS NULL
  AND s.student_id IS NOT NULL
ON CONFLICT (lower(login)) DO NOTHING;

UPDATE public.students s
SET account_id = ua.id
FROM public.user_accounts ua
WHERE s.account_id IS NULL
  AND ua.subject_type = 'student'
  AND lower(ua.login) = lower(s.student_id);

-- --- Teachers (approved/active only) ------------------------
-- A pending or rejected application must not become a working login.
-- NOTE: teachers.email is an ordinary contact address, not a verified Google
-- identity — the first version wrote it into google_email, which both
-- misrepresents it and invites a false collision with an admin's real Google
-- address. Left NULL; link it deliberately if a teacher connects Google.
INSERT INTO public.user_accounts (login, password_hash, subject_type, status)
SELECT
  t.desired_username,
  t.desired_password_hash,
  'teacher',
  'active'
FROM public.teachers t
WHERE t.account_id IS NULL
  AND t.desired_username IS NOT NULL
  AND t.status IN ('approved', 'active')
ON CONFLICT (lower(login)) DO NOTHING;

UPDATE public.teachers t
SET account_id = ua.id
FROM public.user_accounts ua
WHERE t.account_id IS NULL
  AND ua.subject_type = 'teacher'
  AND lower(ua.login) = lower(t.desired_username);

-- --- Google identity, only where unambiguous ----------------
-- One winner per google_id. Admin beats student because admin accounts are
-- the ones that authenticate with Google today; the losing profile keeps its
-- own google_id column untouched, so its login path is unaffected.
WITH candidate AS (
  SELECT a.account_id, a.google_id, 1 AS priority
    FROM public.admins a
   WHERE a.google_id IS NOT NULL AND a.account_id IS NOT NULL
  UNION ALL
  SELECT s.account_id, s.google_id, 2
    FROM public.students s
   WHERE s.google_id IS NOT NULL AND s.account_id IS NOT NULL
),
winner AS (
  SELECT DISTINCT ON (google_id) account_id, google_id
    FROM candidate
   ORDER BY google_id, priority, account_id
)
UPDATE public.user_accounts ua
   SET google_id = w.google_id
  FROM winner w
 WHERE ua.id = w.account_id
   AND ua.google_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.user_accounts x
      WHERE x.google_id = w.google_id AND x.id <> ua.id
   );

WITH candidate AS (
  SELECT a.account_id, a.google_email, 1 AS priority
    FROM public.admins a
   WHERE a.google_email IS NOT NULL AND a.account_id IS NOT NULL
  UNION ALL
  SELECT s.account_id, s.google_email, 2
    FROM public.students s
   WHERE s.google_email IS NOT NULL AND s.account_id IS NOT NULL
),
winner AS (
  SELECT DISTINCT ON (lower(google_email)) account_id, google_email
    FROM candidate
   ORDER BY lower(google_email), priority, account_id
)
UPDATE public.user_accounts ua
   SET google_email = w.google_email
  FROM winner w
 WHERE ua.id = w.account_id
   AND ua.google_email IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.user_accounts x
      WHERE lower(x.google_email) = lower(w.google_email) AND x.id <> ua.id
   );

-- ------------------------------------------------------------
-- SMOKE — the admins and teachers counts must be 0.
--
-- A non-zero STUDENTS count is usually NOT a collision between two people.
-- On this database it meant one person holding two profiles: a staff member
-- whose admin username is also their own student_id. The fix is to share one
-- account between both profiles, which is what 0010_link_dual_profile.sql
-- does — do not rename anyone until you have checked admins.linked_student_id.
--
--   SELECT count(*) FROM public.admins   WHERE account_id IS NULL;
--   SELECT count(*) FROM public.students WHERE account_id IS NULL;
--   SELECT count(*) FROM public.teachers
--    WHERE account_id IS NULL AND status IN ('approved','active')
--      AND desired_username IS NOT NULL;
--
-- Sanity: counts should line up with the profile tables.
--   SELECT subject_type, count(*) FROM public.user_accounts GROUP BY 1;
--
-- EXPECTED, not an error: profiles whose Google identity went to another
-- account because the same human holds two profiles. Their own google_id
-- column is intact and their Google login still works.
--   SELECT 'admin' src, a.admin_id AS profile, a.google_id
--     FROM public.admins a JOIN public.user_accounts ua ON ua.id = a.account_id
--    WHERE a.google_id IS NOT NULL AND ua.google_id IS DISTINCT FROM a.google_id
--   UNION ALL
--   SELECT 'student', s.student_id, s.google_id
--     FROM public.students s JOIN public.user_accounts ua ON ua.id = s.account_id
--    WHERE s.google_id IS NOT NULL AND ua.google_id IS DISTINCT FROM s.google_id;
-- ------------------------------------------------------------

-- ROLLBACK:
--   UPDATE public.admins   SET account_id = NULL;
--   UPDATE public.students SET account_id = NULL;
--   UPDATE public.teachers SET account_id = NULL;
--   DELETE FROM public.user_accounts;
