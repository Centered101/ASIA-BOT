-- ============================================================
-- 0016 — สิทธิ์ของโมดูลแจ้งซ่อมและครุภัณฑ์
--
-- ไม่แก้ 0003 ที่รันไปแล้ว แต่เพิ่มต่อท้ายเป็นไฟล์ของตัวเอง เพราะ 0003
-- ถูก apply กับ production ไปแล้วและการแก้ไฟล์ที่รันแล้วทำให้ประวัติ
-- migration เชื่อถือไม่ได้
--
-- ต้องตรงกับ src/lib/rbac/definitions.ts เวลาเพิ่มให้แก้ทั้งสองที่
--
-- ก่อนหน้านี้ MAINTENANCE มีแค่ ["school.info", "equipment.view_items"]
-- ซึ่งไม่พอจะทำงานของตัวเองเลย และ ASSET_MANAGER ไม่มีสิทธิ์ครุภัณฑ์จริง
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

INSERT INTO public.permissions (key, label, module) VALUES
  ('maintenance.create',    'แจ้งซ่อม',                  'maintenance'),
  ('maintenance.view_own',  'ดูคำขอซ่อมของตัวเอง',      'maintenance'),
  ('maintenance.view_all',  'ดูคำขอซ่อมทั้งหมด',        'maintenance'),
  ('maintenance.update',    'แก้ไขคำขอซ่อม',            'maintenance'),
  ('maintenance.assign',    'มอบหมายงานซ่อม',           'maintenance'),
  ('maintenance.complete',  'ตรวจรับงานซ่อม',           'maintenance'),
  ('asset.view',            'ดูทะเบียนครุภัณฑ์',        'asset'),
  ('asset.manage',          'จัดการทะเบียนครุภัณฑ์',    'asset'),
  ('asset.dispose',         'จำหน่ายครุภัณฑ์',          'asset')
ON CONFLICT (key) DO NOTHING;

-- --- ผูกสิทธิ์เข้ากับ role ----------------------------------
-- SUPER_ADMIN ใช้ wildcard '*' ในโค้ด จึงไม่ต้องระบุที่นี่ (เหมือน 0003)

-- ทุกคนแจ้งซ่อมและดูของตัวเองได้ รวมถึงนักเรียน เพราะคนที่เจอของพังก่อน
-- มักเป็นคนใช้งาน ไม่ใช่ฝ่ายอาคาร การกันไม่ให้แจ้งทำให้ของพังนานขึ้นเฉย ๆ
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r.key, p.key
  FROM public.roles r
  CROSS JOIN (VALUES ('maintenance.create'), ('maintenance.view_own')) AS p(key)
-- ไม่รวม ALUMNI และ GUEST เพราะไม่ได้ใช้อาคารอยู่แล้ว
-- (รายชื่อนี้ตรงกับ Role ใน definitions.ts ที่ 0003 seed ไว้ครบ 20 ตัว)
 WHERE r.key IN (
   'STUDENT', 'PARENT', 'TEACHER', 'ADVISOR', 'ACADEMIC', 'REGISTRAR',
   'FINANCE', 'STUDENT_AFFAIRS', 'DUAL_EDUCATION', 'ACTIVITY', 'LIBRARY',
   'NURSE', 'SHOP_MANAGER', 'EXECUTIVE',
   'ASSET_MANAGER', 'MAINTENANCE', 'ADMIN'
 )
ON CONFLICT DO NOTHING;

-- ฝ่ายอาคารสถานที่ — ทำงานซ่อมได้ครบ แต่ไม่ได้สิทธิ์แก้ทะเบียนครุภัณฑ์
-- (ดูได้อย่างเดียว) เพราะการเพิ่ม/จำหน่ายครุภัณฑ์เป็นงานฝ่ายพัสดุ
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'MAINTENANCE', p.key
  FROM (VALUES
    ('maintenance.view_all'), ('maintenance.update'),
    ('maintenance.assign'), ('maintenance.complete'),
    ('asset.view')
  ) AS p(key)
ON CONFLICT DO NOTHING;

-- ผู้ดูแลครุภัณฑ์ — คุมทะเบียนได้เต็ม และดูงานซ่อมได้เพื่อรู้ว่าของชิ้นไหน
-- กำลังซ่อมอยู่ แต่ไม่ได้สิทธิ์เลื่อนสถานะงานซ่อม
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'ASSET_MANAGER', p.key
  FROM (VALUES
    ('asset.view'), ('asset.manage'), ('asset.dispose'),
    ('maintenance.view_all')
  ) AS p(key)
ON CONFLICT DO NOTHING;

-- ADMIN ได้ทั้งหมด
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'ADMIN', p.key
  FROM (VALUES
    ('maintenance.view_all'), ('maintenance.update'),
    ('maintenance.assign'), ('maintenance.complete'),
    ('asset.view'), ('asset.manage'), ('asset.dispose')
  ) AS p(key)
ON CONFLICT DO NOTHING;

-- ผู้บริหารดูได้อย่างเดียว ใช้ประกอบการอนุมัติงบซ่อม
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'EXECUTIVE', p.key
  FROM (VALUES ('maintenance.view_all'), ('asset.view')) AS p(key)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- SMOKE
--   -- ต้องได้ 9 แถว
--   SELECT count(*) FROM public.permissions WHERE module IN ('maintenance','asset');
--
--   -- MAINTENANCE ต้องมี maintenance.complete แต่ต้องไม่มี asset.manage
--   SELECT permission_key FROM public.role_permissions
--    WHERE role_key = 'MAINTENANCE' ORDER BY 1;
--
--   -- ASSET_MANAGER ต้องมี asset.manage แต่ต้องไม่มี maintenance.complete
--   SELECT permission_key FROM public.role_permissions
--    WHERE role_key = 'ASSET_MANAGER' ORDER BY 1;
--
--   -- นักเรียนต้องแจ้งซ่อมได้ แต่ดูของคนอื่นไม่ได้
--   SELECT permission_key FROM public.role_permissions
--    WHERE role_key = 'STUDENT' AND permission_key LIKE 'maintenance%' ORDER BY 1;
-- ------------------------------------------------------------

-- ROLLBACK:
--   DELETE FROM public.role_permissions
--    WHERE permission_key LIKE 'maintenance.%' OR permission_key LIKE 'asset.%';
--   DELETE FROM public.permissions
--    WHERE module IN ('maintenance', 'asset');
