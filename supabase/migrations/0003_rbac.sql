-- ============================================================
-- 0003 — Role-based access control
--
-- Two role systems exist today and neither is enough:
--   * admins.role — only superadmin | admin | staff, and it is the one the
--     API layer actually enforces.
--   * src/lib/agent/permissions.ts — 10 roles with granular capability
--     strings, the right design, but only the AI agent ever consults it.
--
-- This makes the granular model the database's model. `admins.role` is NOT
-- touched: it stays as the fallback that resolvePrincipal() reads when an
-- account has no explicit user_roles row, so nobody loses access on day one.
--
-- Additive only. Safe to run twice.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roles (
  key text NOT NULL,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.permissions (
  key text NOT NULL,
  label text NOT NULL,
  module text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_key text NOT NULL,
  permission_key text NOT NULL,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_key, permission_key),
  CONSTRAINT role_permissions_role_key_fkey
    FOREIGN KEY (role_key) REFERENCES public.roles(key) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_key_fkey
    FOREIGN KEY (permission_key) REFERENCES public.permissions(key) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  role_key text NOT NULL,
  -- scope_type/scope_id narrow a role to one object. ADVISOR scoped to a
  -- class_group is what makes "ครูที่ปรึกษาเห็นเฉพาะนักเรียนในห้องตัวเอง"
  -- possible without another schema change in Phase 6.
  scope_type text CHECK (scope_type IS NULL OR scope_type = ANY (ARRAY['class_group'::text, 'department'::text, 'room'::text])),
  scope_id text,
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_role_key_fkey
    FOREIGN KEY (role_key) REFERENCES public.roles(key) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT user_roles_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES public.user_accounts(id) ON DELETE SET NULL
);

-- COALESCE so that (account, role, NULL scope) can only be granted once —
-- a plain unique index treats every NULL as distinct and would allow dupes.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique_grant
  ON public.user_roles (account_id, role_key, COALESCE(scope_type, ''), COALESCE(scope_id, ''));

CREATE INDEX IF NOT EXISTS user_roles_account_id_idx ON public.user_roles (account_id);

-- --- Seed roles ---------------------------------------------
INSERT INTO public.roles (key, label, description, sort_order, is_system) VALUES
  ('SUPER_ADMIN',     'ผู้ดูแลสูงสุด',        'เข้าถึงทุกระบบ รวมการจัดการบัญชีผู้ดูแล', 10, true),
  ('ADMIN',           'ผู้ดูแลระบบ',          'จัดการข้อมูลหลักของระบบ',                  20, true),
  ('EXECUTIVE',       'ผู้บริหาร',            'ดูภาพรวมและรายงาน',                        30, true),
  ('REGISTRAR',       'ฝ่ายทะเบียน',          'รับสมัคร เอกสาร รหัสนักเรียน สถานะนักเรียน', 40, true),
  ('FINANCE',         'ฝ่ายการเงิน',          'ค่าเทอม ค่าธรรมเนียม ใบเสร็จ กยศ.',        50, true),
  ('ACADEMIC',        'ฝ่ายวิชาการ',          'ตารางเรียน ผลการเรียน',                    60, true),
  ('STUDENT_AFFAIRS', 'ฝ่ายกิจการนักเรียน',   'ความประพฤติ การลงโทษ เยี่ยมบ้าน',          70, true),
  ('TEACHER',         'ครูผู้สอน',            'เช็กชื่อรายวิชา งานที่สั่ง',                80, true),
  ('ADVISOR',         'ครูที่ปรึกษา',         'ดูแลนักเรียนในห้องที่รับผิดชอบ',            90, true),
  ('DUAL_EDUCATION',  'ฝ่ายทวิภาคี',          'ฝึกงาน สถานประกอบการ นิเทศ',              100, true),
  ('ACTIVITY',        'ฝ่ายกิจกรรม',          'กิจกรรม ชั่วโมงกิจกรรม',                  110, true),
  ('LIBRARY',         'ห้องสมุด',             'หนังสือ ยืม-คืน',                         120, true),
  ('NURSE',           'ห้องพยาบาล',           'ผู้ป่วย ยา เวชภัณฑ์',                     130, true),
  ('ASSET_MANAGER',   'ผู้ดูแลครุภัณฑ์',      'ทะเบียนครุภัณฑ์',                         140, true),
  ('MAINTENANCE',     'ฝ่ายอาคารสถานที่',     'งานแจ้งซ่อม',                             150, true),
  ('SHOP_MANAGER',    'ผู้ดูแลสหกรณ์',        'สินค้า สต็อก ออเดอร์',                    160, true),
  ('STUDENT',         'นักเรียน',             'ข้อมูลของตัวเอง',                         170, true),
  ('PARENT',          'ผู้ปกครอง',            'ข้อมูลของบุตรหลาน',                       180, true),
  ('ALUMNI',          'ศิษย์เก่า',            'ข้อมูลและกิจกรรมศิษย์เก่า',                190, true),
  ('GUEST',           'ผู้เยี่ยมชม',          'ข้อมูลสาธารณะ',                           200, true)
ON CONFLICT (key) DO NOTHING;

-- --- Seed permissions ---------------------------------------
-- Mirrors src/lib/rbac/definitions.ts. Keep the two in sync when adding.
INSERT INTO public.permissions (key, label, module) VALUES
  ('school.info',                 'ดูข้อมูลทั่วไปของโรงเรียน',   'school'),
  ('dashboard.view',              'ดูแดชบอร์ด',                  'dashboard'),
  ('student.view_own',            'ดูข้อมูลของตัวเอง',           'student'),
  ('student.view_children',       'ดูข้อมูลบุตรหลาน',            'student'),
  ('student.view_advisees',       'ดูนักเรียนในที่ปรึกษา',       'student'),
  ('student.view_all',            'ดูข้อมูลนักเรียนทั้งหมด',     'student'),
  ('student.create',              'เพิ่มนักเรียน',               'student'),
  ('student.update',              'แก้ไขข้อมูลนักเรียน',         'student'),
  ('student.delete',              'ลบนักเรียน',                  'student'),
  ('student.export',              'ส่งออกข้อมูลนักเรียน',        'student'),
  ('attendance.view_own',         'ดูการเข้าเรียนของตัวเอง',     'attendance'),
  ('attendance.view_children',    'ดูการเข้าเรียนของบุตรหลาน',   'attendance'),
  ('attendance.view_advisees',    'ดูการเข้าเรียนในที่ปรึกษา',   'attendance'),
  ('attendance.view_all',         'ดูการเข้าเรียนทั้งหมด',       'attendance'),
  ('attendance.update',           'แก้ไขการเข้าเรียน',           'attendance'),
  ('attendance.export',           'ส่งออกการเข้าเรียน',          'attendance'),
  ('schedule.view',               'ดูตารางเรียน',                'schedule'),
  ('schedule.manage',             'จัดการตารางเรียน',            'schedule'),
  ('booking.view_own',            'ดูการจองของตัวเอง',           'booking'),
  ('booking.view_all',            'ดูการจองทั้งหมด',             'booking'),
  ('booking.create',              'สร้างการจอง',                 'booking'),
  ('booking.approve',             'อนุมัติการจอง',               'booking'),
  ('room.manage',                 'จัดการห้อง',                  'booking'),
  ('shop.view_products',          'ดูสินค้า',                    'shop'),
  ('shop.manage_products',        'จัดการสินค้า',                'shop'),
  ('shop.view_own_orders',        'ดูออเดอร์ของตัวเอง',          'shop'),
  ('shop.view_all_orders',        'ดูออเดอร์ทั้งหมด',            'shop'),
  ('shop.create_order',           'สั่งซื้อ',                    'shop'),
  ('shop.manage_orders',          'จัดการออเดอร์',               'shop'),
  ('equipment.view_items',        'ดูรายการคุรุภัณฑ์',           'equipment'),
  ('equipment.manage_items',      'จัดการคุรุภัณฑ์',             'equipment'),
  ('equipment.view_own_requests', 'ดูคำขอเบิกของตัวเอง',         'equipment'),
  ('equipment.view_all_requests', 'ดูคำขอเบิกทั้งหมด',           'equipment'),
  ('equipment.create_request',    'สร้างคำขอเบิก',               'equipment'),
  ('equipment.approve',           'อนุมัติคำขอเบิก',             'equipment'),
  ('feedback.create',             'ส่งความคิดเห็น',              'feedback'),
  ('feedback.view_all',           'ดูความคิดเห็นทั้งหมด',        'feedback'),
  ('feedback.manage',             'จัดการความคิดเห็น',           'feedback'),
  ('project.view',                'ดูโปรเจกต์',                  'project'),
  ('project.manage',              'จัดการโปรเจกต์',              'project'),
  ('library.manage',              'จัดการห้องสมุด',              'library'),
  ('notifications.send',          'ส่งการแจ้งเตือน',             'notification'),
  ('iot.manage',                  'จัดการอุปกรณ์ RFID',          'system'),
  ('system.manage',               'จัดการระบบ',                  'system'),
  ('audit.view',                  'ดู audit log',                'system'),
  ('role.manage',                 'จัดการสิทธิ์ผู้ใช้',          'system')
ON CONFLICT (key) DO NOTHING;

-- --- Seed role → permission ---------------------------------
-- SUPER_ADMIN is handled in code with a '*' wildcard, so it is not enumerated.
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r, p FROM (VALUES
  ('ADMIN','school.info'),('ADMIN','dashboard.view'),('ADMIN','student.view_all'),
  ('ADMIN','student.create'),('ADMIN','student.update'),('ADMIN','student.export'),
  ('ADMIN','attendance.view_all'),('ADMIN','attendance.update'),('ADMIN','attendance.export'),
  ('ADMIN','schedule.view'),('ADMIN','schedule.manage'),('ADMIN','booking.view_all'),
  ('ADMIN','booking.approve'),('ADMIN','room.manage'),('ADMIN','shop.view_products'),
  ('ADMIN','shop.manage_products'),('ADMIN','shop.view_all_orders'),('ADMIN','shop.manage_orders'),
  ('ADMIN','equipment.view_items'),('ADMIN','equipment.manage_items'),
  ('ADMIN','equipment.view_all_requests'),('ADMIN','equipment.approve'),
  ('ADMIN','feedback.view_all'),('ADMIN','feedback.manage'),('ADMIN','project.view'),
  ('ADMIN','project.manage'),('ADMIN','notifications.send'),('ADMIN','iot.manage'),

  ('EXECUTIVE','school.info'),('EXECUTIVE','dashboard.view'),('EXECUTIVE','student.view_all'),
  ('EXECUTIVE','attendance.view_all'),('EXECUTIVE','booking.view_all'),
  ('EXECUTIVE','schedule.view'),('EXECUTIVE','feedback.view_all'),

  ('REGISTRAR','school.info'),('REGISTRAR','dashboard.view'),('REGISTRAR','student.view_all'),
  ('REGISTRAR','student.create'),('REGISTRAR','student.update'),('REGISTRAR','student.export'),
  ('REGISTRAR','schedule.view'),

  ('FINANCE','school.info'),('FINANCE','dashboard.view'),('FINANCE','student.view_all'),

  ('ACADEMIC','school.info'),('ACADEMIC','dashboard.view'),('ACADEMIC','student.view_all'),
  ('ACADEMIC','attendance.view_all'),('ACADEMIC','attendance.update'),
  ('ACADEMIC','schedule.view'),('ACADEMIC','schedule.manage'),
  ('ACADEMIC','booking.view_all'),('ACADEMIC','booking.approve'),
  ('ACADEMIC','equipment.view_items'),('ACADEMIC','equipment.view_own_requests'),
  ('ACADEMIC','equipment.create_request'),('ACADEMIC','feedback.view_all'),
  ('ACADEMIC','project.view'),
  -- ACADEMIC is the mapping target for the legacy `staff` role. staff can read
  -- every admin tab today (NAV_SECTIONS applies no role gating), so these two
  -- read permissions must be present or the products/shoporders tabs break.
  ('ACADEMIC','shop.view_products'),('ACADEMIC','shop.view_all_orders'),

  ('STUDENT_AFFAIRS','school.info'),('STUDENT_AFFAIRS','dashboard.view'),
  ('STUDENT_AFFAIRS','student.view_all'),('STUDENT_AFFAIRS','attendance.view_all'),
  ('STUDENT_AFFAIRS','feedback.view_all'),('STUDENT_AFFAIRS','feedback.manage'),

  ('TEACHER','school.info'),('TEACHER','schedule.view'),('TEACHER','student.view_all'),
  ('TEACHER','attendance.view_all'),('TEACHER','attendance.update'),
  ('TEACHER','booking.view_all'),('TEACHER','booking.create'),
  ('TEACHER','equipment.view_items'),('TEACHER','equipment.view_own_requests'),
  ('TEACHER','equipment.create_request'),('TEACHER','project.view'),

  ('ADVISOR','school.info'),('ADVISOR','schedule.view'),('ADVISOR','student.view_advisees'),
  ('ADVISOR','attendance.view_advisees'),('ADVISOR','booking.create'),
  ('ADVISOR','equipment.view_items'),('ADVISOR','equipment.create_request'),

  ('DUAL_EDUCATION','school.info'),('DUAL_EDUCATION','dashboard.view'),
  ('DUAL_EDUCATION','student.view_all'),('DUAL_EDUCATION','attendance.view_all'),

  ('ACTIVITY','school.info'),('ACTIVITY','dashboard.view'),('ACTIVITY','student.view_all'),
  ('ACTIVITY','notifications.send'),

  ('LIBRARY','school.info'),('LIBRARY','student.view_all'),('LIBRARY','library.manage'),

  ('NURSE','school.info'),('NURSE','student.view_all'),

  ('ASSET_MANAGER','school.info'),('ASSET_MANAGER','equipment.view_items'),
  ('ASSET_MANAGER','equipment.manage_items'),('ASSET_MANAGER','equipment.view_all_requests'),
  ('ASSET_MANAGER','equipment.approve'),

  ('MAINTENANCE','school.info'),('MAINTENANCE','equipment.view_items'),

  ('SHOP_MANAGER','school.info'),('SHOP_MANAGER','shop.view_products'),
  ('SHOP_MANAGER','shop.manage_products'),('SHOP_MANAGER','shop.view_all_orders'),
  ('SHOP_MANAGER','shop.manage_orders'),

  ('STUDENT','school.info'),('STUDENT','student.view_own'),('STUDENT','attendance.view_own'),
  ('STUDENT','schedule.view'),('STUDENT','booking.view_own'),('STUDENT','booking.create'),
  ('STUDENT','shop.view_products'),('STUDENT','shop.view_own_orders'),('STUDENT','shop.create_order'),
  ('STUDENT','equipment.view_items'),('STUDENT','equipment.view_own_requests'),
  ('STUDENT','equipment.create_request'),('STUDENT','feedback.create'),('STUDENT','project.view'),

  ('PARENT','school.info'),('PARENT','student.view_children'),
  ('PARENT','attendance.view_children'),('PARENT','schedule.view'),

  ('ALUMNI','school.info'),('ALUMNI','project.view'),

  ('GUEST','school.info')
) AS seed(r, p)
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.roles;              -- expect 20
--   SELECT count(*) FROM public.permissions;        -- expect 47
--   SELECT role_key, count(*) FROM public.role_permissions GROUP BY 1 ORDER BY 1;
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.user_roles;
--   DROP TABLE IF EXISTS public.role_permissions;
--   DROP TABLE IF EXISTS public.permissions;
--   DROP TABLE IF EXISTS public.roles;
