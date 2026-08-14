-- ============================================================
-- 0010 — Fix the admin/student login collision  (DATA ONLY, no DDL)
--
-- ⚠ THIS FILE NEEDS YOU TO EDIT ONE LINE BEFORE RUNNING IT. See STEP 2.
--
-- user_accounts.login is unique across every subject type, so one string can
-- only ever belong to one account. Admin ADM-1783669050569 has
-- username = '3175', which is also student_id '3175' (ธเนศ). 0002 creates
-- admin accounts first, so that admin took the login and the student was
-- skipped — leaving students.account_id NULL for him.
--
-- Confirmed on production: 6 user_accounts rows for 7 profiles.
--
-- His current login still works: student auth goes through students.student_id
-- + student_phone, which this does not touch. What he cannot get is a signed
-- session cookie, because that is keyed on an account. So this must be fixed
-- before AUTH_LEGACY_HEADER is turned off, not necessarily before deploy.
--
-- The admin username is renamed rather than the student_id: student_id is a
-- real institutional identifier referenced by six foreign keys, while an admin
-- username is just a login handle.
-- ============================================================

-- ── STEP 1 — look before you touch anything ─────────────────
-- Expect: one row, admin_id ADM-1783669050569, username 3175.
SELECT a.admin_id, a.username, a.role, s.student_id, s.first_name, s.last_name
  FROM public.admins a
  JOIN public.students s ON lower(s.student_id) = lower(a.username);

-- Every collision, in case there is more than the one we know about:
SELECT a.admin_id, a.username FROM public.admins a
  JOIN public.students s ON lower(s.student_id) = lower(a.username);


-- ── STEP 2 — choose the new username, then edit both lines ──
-- Replace 'CHANGE_ME' in BOTH statements below with the same value.
-- Rules enforced by /api/admin/admins: ^[a-zA-Z0-9_]{3,20}$
-- It must not collide again, so do not use another student_id. Something like
-- the person's name is safer than another number.
--
-- Tell the admin their username changed — they log in with it.

-- Guard: refuse to run while the placeholder is still there.
DO $$
BEGIN
  IF 'CHANGE_ME' = 'CHANGE_ME' THEN
    RAISE EXCEPTION 'Edit 0010: replace CHANGE_ME with the new username in both statements first.';
  END IF;
END $$;

UPDATE public.admins
   SET username = 'CHANGE_ME',
       username_changed_at = now()
 WHERE admin_id = 'ADM-1783669050569'
   AND username = '3175';

-- Keep the account row in step with the profile it belongs to.
UPDATE public.user_accounts ua
   SET login = 'CHANGE_ME'
  FROM public.admins a
 WHERE a.admin_id = 'ADM-1783669050569'
   AND ua.id = a.account_id
   AND ua.login = '3175';


-- ── STEP 3 — re-run 0002 ────────────────────────────────────
-- 0002_backfill_accounts.sql is idempotent and only touches rows where
-- account_id IS NULL, so re-running it now picks up just the freed student.


-- ── STEP 4 — re-run 0009 ────────────────────────────────────
-- The new account needs its STUDENT grant. 0009 is idempotent too.


-- ------------------------------------------------------------
-- SMOKE — after steps 3 and 4
--
--   -- must be 0
--   SELECT count(*) FROM public.students WHERE account_id IS NULL;
--
--   -- must be 7: 3 admins + 4 students
--   SELECT count(*) FROM public.user_accounts;
--
--   -- ธเนศ must now have an account and a STUDENT role
--   SELECT s.student_id, s.first_name, ua.login, ur.role_key
--     FROM public.students s
--     JOIN public.user_accounts ua ON ua.id = s.account_id
--     LEFT JOIN public.user_roles ur ON ur.account_id = ua.id
--    WHERE s.student_id = '3175';
--
--   -- no collisions left
--   SELECT a.username FROM public.admins a
--     JOIN public.students s ON lower(s.student_id) = lower(a.username);
-- ------------------------------------------------------------

-- ROLLBACK:
--   UPDATE public.admins SET username = '3175', username_changed_at = NULL
--    WHERE admin_id = 'ADM-1783669050569';
--   UPDATE public.user_accounts ua SET login = '3175'
--     FROM public.admins a
--    WHERE a.admin_id = 'ADM-1783669050569' AND ua.id = a.account_id;
--   -- then remove the student account 0002 created:
--   UPDATE public.students SET account_id = NULL WHERE student_id = '3175';
--   DELETE FROM public.user_accounts WHERE login = '3175' AND subject_type = 'student';
