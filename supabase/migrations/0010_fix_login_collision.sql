-- ============================================================
-- 0010 — Fix the admin/student login collision  (DATA ONLY, no DDL)
--
-- ⚠ EDIT ONE LINE BEFORE RUNNING: new_username, marked "EDIT THIS" below.
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
--
-- The first version of this file spread the placeholder across four literals
-- and told you to edit two of them, so the guard kept firing even after you
-- had done exactly what it asked. Everything now reads one variable.
-- ============================================================

-- ── STEP 1 — look before you touch anything ─────────────────
-- Expect one row: ADM-1783669050569 / 3175 / ธเนศ.
SELECT a.admin_id, a.username, a.role, s.student_id, s.first_name, s.last_name
  FROM public.admins a
  JOIN public.students s ON lower(s.student_id) = lower(a.username);


-- ── STEP 2 — set the new username on the marked line, then run ──
-- Rules enforced by /api/admin/admins: ^[a-zA-Z0-9_]{3,20}$
-- Do not use another student_id, or this collides again. A name reads better
-- than a number here.
--
-- Tell the admin their username changed — they log in with it.
--
-- This block validates first and only writes if every check passes, so a bad
-- value changes nothing.
DO $$
DECLARE
  new_username text := 'CHANGE_ME';  -- ◄── EDIT THIS, and only this
  target_admin  text := 'ADM-1783669050569';
  old_username  text := '3175';
  moved_admin   integer;
  moved_account integer;
BEGIN
  IF new_username = 'CHANGE_ME' THEN
    RAISE EXCEPTION
      'Set new_username on the marked line first (it is still the placeholder).';
  END IF;

  IF new_username !~ '^[a-zA-Z0-9_]{3,20}$' THEN
    RAISE EXCEPTION
      'Username % is invalid: must be 3-20 chars of a-z, A-Z, 0-9, or _', new_username;
  END IF;

  -- Refuse to trade one collision for another.
  IF EXISTS (SELECT 1 FROM public.students WHERE lower(student_id) = lower(new_username)) THEN
    RAISE EXCEPTION 'Username % is a student_id — that is the bug we are fixing', new_username;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admins
     WHERE lower(username) = lower(new_username) AND admin_id <> target_admin
  ) THEN
    RAISE EXCEPTION 'Username % already belongs to another admin', new_username;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_accounts ua
     WHERE lower(ua.login) = lower(new_username)
       AND ua.id IS DISTINCT FROM (SELECT account_id FROM public.admins WHERE admin_id = target_admin)
  ) THEN
    RAISE EXCEPTION 'Login % is already taken in user_accounts', new_username;
  END IF;

  -- Order does not matter here — both statements match on the old value and
  -- the whole block is one transaction — but keeping the account and the
  -- profile adjacent makes the pair obvious to whoever reads this next.
  UPDATE public.user_accounts ua
     SET login = new_username
    FROM public.admins a
   WHERE a.admin_id = target_admin
     AND ua.id = a.account_id
     AND ua.login = old_username;
  GET DIAGNOSTICS moved_account = ROW_COUNT;

  UPDATE public.admins
     SET username = new_username,
         username_changed_at = now()
   WHERE admin_id = target_admin
     AND username = old_username;
  GET DIAGNOSTICS moved_admin = ROW_COUNT;

  IF moved_admin = 0 AND moved_account = 0 THEN
    RAISE NOTICE 'Nothing to do — the rename already happened. Safe to continue.';
  ELSE
    RAISE NOTICE 'Renamed % to %  (admins: % row, user_accounts: % row)',
      old_username, new_username, moved_admin, moved_account;
  END IF;
END $$;


-- ── STEP 3 — re-run 0002_backfill_accounts.sql ──────────────
-- Idempotent, and only touches rows where account_id IS NULL, so it picks up
-- just the student whose login was freed.

-- ── STEP 4 — re-run 0009_backfill_user_roles.sql ────────────
-- The new account needs its STUDENT grant. Idempotent too.


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
--   -- no collisions left — must return no rows
--   SELECT a.username FROM public.admins a
--     JOIN public.students s ON lower(s.student_id) = lower(a.username);
--
--   -- the renamed admin still resolves to its account
--   SELECT a.admin_id, a.username, a.role, ua.login, ur.role_key
--     FROM public.admins a
--     JOIN public.user_accounts ua ON ua.id = a.account_id
--     LEFT JOIN public.user_roles ur ON ur.account_id = ua.id
--    WHERE a.admin_id = 'ADM-1783669050569';
-- ------------------------------------------------------------

-- ROLLBACK: (replace <new> with the username you chose)
--   UPDATE public.user_accounts ua SET login = '3175'
--     FROM public.admins a
--    WHERE a.admin_id = 'ADM-1783669050569' AND ua.id = a.account_id
--      AND ua.login = '<new>';
--   UPDATE public.admins SET username = '3175', username_changed_at = NULL
--    WHERE admin_id = 'ADM-1783669050569';
--   -- and undo what step 3 created for the student:
--   UPDATE public.students SET account_id = NULL WHERE student_id = '3175';
--   DELETE FROM public.user_accounts WHERE login = '3175' AND subject_type = 'student';
