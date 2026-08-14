-- ============================================================
-- 0010 — Link the student profile of a dual-role person to their account
--        (DATA ONLY, no DDL — runs as-is, nothing to edit)
--
-- WHAT THIS ACTUALLY IS
-- After 0002 the database held 6 user_accounts for 7 profiles, and the first
-- reading of that was "a student got skipped by a username collision, rename
-- the admin". That reading was wrong.
--
-- ธเนศ สีแดง (โอม) is student 3175 AND staff admin ADM-1783669050569. He is
-- one person. admins.linked_student_id = '3175' already recorded that. The
-- login '3175' appearing in both tables is not two people colliding — it is
-- one person holding two profiles, which is exactly the case the Phase 1
-- identity model was built for:
--
--   user_accounts (one row per human)
--        ↑                    ↑
--   admins.account_id   students.account_id
--
-- Each of those FKs is uniquely indexed per table, so one account may be
-- referenced by at most one admin row and at most one student row. Sharing
-- across tables is allowed and is the intended shape.
--
-- So 6 accounts for 7 profiles is CORRECT, and stays 6. Renaming his username
-- would have given one human two logins and split his audit trail in two.
--
-- This migration links the student profile to the account the admin already
-- has, and grants that account the STUDENT role alongside its staff role.
--
-- Generic by design: it fixes every admin/student pair that shares a login,
-- not just this one, so a second dual-role person is handled the same way.
-- ============================================================

-- ── STEP 1 — see who this affects ───────────────────────────
-- Expect: ADM-1783669050569 / ธเนศ สีแดง / student 3175, linked_student_id 3175.
SELECT
  a.admin_id,
  a.username,
  a.role                          AS admin_role,
  a.linked_student_id,
  s.student_id,
  s.first_name || ' ' || s.last_name AS name,
  a.account_id                    AS admin_account,
  s.account_id                    AS student_account
FROM public.admins a
JOIN public.students s ON lower(s.student_id) = lower(a.username)
ORDER BY a.admin_id;


-- ── STEP 2 — link, then grant ───────────────────────────────
DO $$
DECLARE
  linked  integer;
  granted integer;
BEGIN
  -- Attach the student profile to the admin's existing account, but only when
  -- the student has no account yet. An account already set is left alone.
  UPDATE public.students s
     SET account_id = a.account_id
    FROM public.admins a
   WHERE s.account_id IS NULL
     AND a.account_id IS NOT NULL
     AND lower(a.username) = lower(s.student_id);
  GET DIAGNOSTICS linked = ROW_COUNT;

  -- That account now speaks for a student too, so it needs the STUDENT role in
  -- addition to whatever its admin role already granted.
  INSERT INTO public.user_roles (account_id, role_key)
  SELECT s.account_id, 'STUDENT'
    FROM public.students s
   WHERE s.account_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS granted = ROW_COUNT;

  RAISE NOTICE 'Linked % student profile(s); added % STUDENT grant(s).', linked, granted;

  IF linked = 0 THEN
    RAISE NOTICE 'No student was waiting for a link — already done, or none to do.';
  END IF;
END $$;


-- ------------------------------------------------------------
-- SMOKE
--
--   -- must be 0: every student now has an account
--   SELECT count(*) FROM public.students WHERE account_id IS NULL;
--
--   -- must still be 6 — one human, one account. NOT 7.
--   SELECT count(*) FROM public.user_accounts;
--
--   -- ธเนศ: one account, both profiles, both roles
--   SELECT ua.login, ua.subject_type,
--          a.admin_id, a.role AS admin_role,
--          s.student_id,
--          string_agg(ur.role_key, ', ' ORDER BY ur.role_key) AS roles
--     FROM public.user_accounts ua
--     LEFT JOIN public.admins   a  ON a.account_id  = ua.id
--     LEFT JOIN public.students s  ON s.account_id  = ua.id
--     LEFT JOIN public.user_roles ur ON ur.account_id = ua.id
--    WHERE ua.login = '3175'
--    GROUP BY ua.login, ua.subject_type, a.admin_id, a.role, s.student_id;
--   -- expect: 3175 | admin | ADM-1783669050569 | staff | 3175 | ACADEMIC, STUDENT
--
--   -- every account still holds at least one role
--   SELECT count(*) FROM public.user_accounts ua
--    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.account_id = ua.id);
--
--   -- no account is claimed by two rows of the same table
--   SELECT account_id, count(*) FROM public.students
--    WHERE account_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--   SELECT account_id, count(*) FROM public.admins
--    WHERE account_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
-- ------------------------------------------------------------

-- NOTE ON subject_type
-- His account keeps subject_type = 'admin'. That column records which profile
-- the account was created from; it is a hint, not an authorisation input.
-- Access comes from user_roles, and resolvePrincipal() reads the profile
-- tables by account_id. Nothing branches on subject_type to decide what he may
-- do, so leaving it as 'admin' costs nothing and avoids rewriting history.

-- ROLLBACK:
--   DELETE FROM public.user_roles ur
--    USING public.students s
--    WHERE ur.account_id = s.account_id
--      AND ur.role_key = 'STUDENT'
--      AND s.student_id = '3175';
--   UPDATE public.students SET account_id = NULL WHERE student_id = '3175';
