-- ============================================================
-- 0009 — ให้ role กับ account ที่มีอยู่  (ข้อมูลล้วน ไม่มี DDL)
--
-- เจอตอนทดสอบ Phase 1 บนเครื่อง และเป็นเหตุผลที่ไฟล์นี้มีอยู่: 0003 ใส่ข้อมูล
-- ตั้งต้นให้ `roles`, `permissions`, `role_permissions` แต่ **ไม่ได้สร้างแถว**
-- `user_roles` เลย ขณะที่ 0002 ผูก account ให้แอดมินทุกคนไปแล้ว ในช่วงคาบเกี่ยว
-- นั้น `loadRolesForAccount()` หา grant ของ account ไม่เจอ จึงตกไปใช้ค่า
-- default ตาม subject_type ผลคือ **แอดมินทุกคน** รวมถึง superadmin
-- ถูก resolve เป็น ACADEMIC และเสียสิทธิ์เขียน ยืนยันกับข้อมูลจริงแล้ว:
-- superadmin ได้ 403 ตอน POST /api/admin/products
--
-- ตอนนี้ src/lib/server/session.ts ส่งค่า map จาก admins.role เดิมเป็น fallback
-- ให้ด้วย การแก้จึงมีสองชั้นทับกัน: โค้ดไม่ต้องพึ่ง backfill นี้อีกต่อไป
-- และ backfill นี้ทำให้ grant ชัดเจนอยู่ในฐานข้อมูล แทนที่จะต้องเดาใหม่ทุก request
--
-- การ map ตรงกับ LEGACY_ADMIN_ROLE_MAP ใน src/lib/rbac/definitions.ts เป๊ะ:
--   superadmin -> SUPER_ADMIN
--   admin      -> ADMIN
--   staff      -> ACADEMIC
-- ไม่มีใครได้สิทธิ์เพิ่มหรือเสียสิทธิ์เทียบกับก่อน Phase 1
--
-- รันซ้ำได้: มี index user_roles_unique_grant กันไว้
-- ============================================================

-- --- แอดมิน --------------------------------------------------
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

-- --- นักเรียน ------------------------------------------------
INSERT INTO public.user_roles (account_id, role_key)
SELECT s.account_id, 'STUDENT'
FROM public.students s
WHERE s.account_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- --- ครู -----------------------------------------------------
-- ให้แค่ TEACHER ส่วน ADVISOR เป็น grant ที่มี scope (user_roles.scope_id ->
-- class_groups.id) ซึ่งยังเดาไม่ได้ เพราะ students.advisor_teacher_id
-- ยังว่างจนกว่าจะจัดนักเรียนเข้าห้องใน Phase 2
INSERT INTO public.user_roles (account_id, role_key)
SELECT t.account_id, 'TEACHER'
FROM public.teachers t
WHERE t.account_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- SMOKE
--   -- ทุก account ที่ผูกแล้วต้องมีอย่างน้อย 1 role (ควรได้ 0):
--   SELECT count(*) FROM public.user_accounts ua
--    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.account_id = ua.id);
--
--   -- การกระจายของ role ต้องสะท้อน admins.role เป๊ะ:
--   SELECT ur.role_key, count(*) FROM public.user_roles ur GROUP BY 1 ORDER BY 1;
--   SELECT role, count(*) FROM public.admins WHERE account_id IS NOT NULL GROUP BY 1;
--
--   -- superadmin ต้องเป็น SUPER_ADMIN จริง ๆ:
--   SELECT a.admin_id, a.role, ur.role_key
--     FROM public.admins a
--     JOIN public.user_roles ur ON ur.account_id = a.account_id
--    WHERE a.role = 'superadmin';
-- ------------------------------------------------------------

-- ROLLBACK:
--   DELETE FROM public.user_roles;
