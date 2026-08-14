-- ============================================================
-- 0009 — Backfill user_roles from existing profiles  (DATA ONLY, no DDL)
--
-- Found during Phase 1 local verification, and it is the reason this file
-- exists: 0003 seeds `roles`, `permissions`, and `role_permissions`, but
-- creates NO `user_roles` rows. Meanwhile 0002 links every admin to an
-- account. In that window `loadRolesForAccount()` finds no grant for the
-- account and falls through to the subject-type default — so EVERY admin,
-- superadmin included, resolved to ACADEMIC and lost write access. Confirmed
-- against live data: superadmin got 403 on POST /api/admin/products.
--
-- src/lib/server/session.ts now also passes the legacy admins.role mapping as
-- an explicit fallback, so the two fixes are belt and braces: the code no
-- longer depends on this backfill, and this backfill makes the grants
-- explicit in the database rather than inferred on every request.
--
-- Mapping is exactly LEGACY_ADMIN_ROLE_MAP in src/lib/rbac/definitions.ts:
--   superadmin -> SUPER_ADMIN
--   admin      -> ADMIN
--   staff      -> ACADEMIC
-- Nobody gains or loses access relative to before Phase 1.
--
-- Idempotent: guarded by the user_roles_unique_grant index.
-- ============================================================

-- --- Admins -------------------------------------------------
INSERT INTO public.user_roles (account_id, role_key)
SELECT
  a.account_id,
  CASE a.role
    WHEN 'superadmin' THEN 'SUPER_ADMIN'
    WHEN 'admin'      THEN 'ADMIN'
    WHEN 'staff'      THEN 'ACADEMIC'
    ELSE 'ACADEMIC'
  END
FROM public.admins a
WHERE a.account_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- --- Students -----------------------------------------------
INSERT INTO public.user_roles (account_id, role_key)
SELECT s.account_id, 'STUDENT'
FROM public.students s
WHERE s.account_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- --- Teachers -----------------------------------------------
-- TEACHER only. ADVISOR is a scoped grant (user_roles.scope_id ->
-- class_groups.id) and cannot be inferred yet — students.advisor_teacher_id
-- is still empty until rosters are assigned in Phase 2.
INSERT INTO public.user_roles (account_id, role_key)
SELECT t.account_id, 'TEACHER'
FROM public.teachers t
WHERE t.account_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- SMOKE
--   -- every linked account must hold at least one role (expect 0):
--   SELECT count(*) FROM public.user_accounts ua
--    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.account_id = ua.id);
--
--   -- role distribution should mirror admins.role exactly:
--   SELECT ur.role_key, count(*) FROM public.user_roles ur GROUP BY 1 ORDER BY 1;
--   SELECT role, count(*) FROM public.admins WHERE account_id IS NOT NULL GROUP BY 1;
--
--   -- the superadmin must really be SUPER_ADMIN:
--   SELECT a.admin_id, a.role, ur.role_key
--     FROM public.admins a
--     JOIN public.user_roles ur ON ur.account_id = a.account_id
--    WHERE a.role = 'superadmin';
-- ------------------------------------------------------------

-- ROLLBACK:
--   DELETE FROM public.user_roles;
