-- ============================================================
-- 0001 — ตารางตัวตนกลาง
--
-- เดิมผู้ใช้แต่ละประเภทมีวิธีล็อกอินของตัวเอง: `admins` ใช้
-- username/password_hash, `students` ใช้ student_id + เบอร์โทร, ส่วน
-- `teachers` ล็อกอินไม่ได้เลย (README ระบุว่าเป็นตารางไว้แสดงชื่อเท่านั้น)
-- แต่ roadmap ต้องการให้ REGISTRAR / FINANCE / NURSE / ADVISOR / ... ล็อกอินได้
-- ซึ่งทำไม่ไหวถ้าต้องมีเส้นทาง auth แยกต่อหนึ่งตาราง
--
-- `user_accounts` จึงกลายเป็น subject เดียวสำหรับการล็อกอิน ส่วน
-- admins / teachers / students คงเดิมทุกอย่างและกลายเป็นตาราง PROFILE
-- ที่ชี้มาที่นี่ผ่าน account_id ซึ่ง NULL ได้ ทำให้ query เดิมทุกตัวยังทำงานปกติ
-- การ backfill แยกไปอยู่ใน migration 0002
--
-- เพิ่มอย่างเดียว ไม่ลบไม่แก้ของเดิม รันซ้ำได้
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  -- login คือ username / student_id / email ที่ใช้เข้าสู่ระบบ
  login text NOT NULL,
  password_hash text,
  google_id text,
  google_email text,
  -- บัญชีนี้มาจากตาราง profile ไหนเป็นหลัก
  subject_type text NOT NULL CHECK (subject_type = ANY (ARRAY['admin'::text, 'teacher'::text, 'student'::text, 'parent'::text, 'alumni'::text])),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])),
  last_login_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_accounts_pkey PRIMARY KEY (id)
);

-- unique แบบไม่สนตัวพิมพ์ใหญ่เล็ก: `admins.username` ถูกแอปบังคับเป็นตัวเล็กอยู่แล้ว
-- แต่ student_id และ email ไม่ได้ถูกบังคับ และต้องไม่ยอมให้ "Somchai" กับ
-- "somchai" กลายเป็นคนละบัญชี
CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_login_lower_key
  ON public.user_accounts (lower(login));

-- ใช้ partial unique index ไม่ใช่ UNIQUE ธรรมดา เพราะส่วนใหญ่คอลัมน์นี้จะเป็น NULL
-- และเราต้องการกันแค่ไม่ให้สองบัญชีอ้าง Google identity เดียวกัน
CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_google_id_key
  ON public.user_accounts (google_id) WHERE google_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_google_email_key
  ON public.user_accounts (lower(google_email)) WHERE google_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_accounts_subject_type_idx
  ON public.user_accounts (subject_type);

-- คอลัมน์เชื่อมบนตาราง profile เดิม ทุกตัว NULL ได้ เพื่อไม่ให้ข้อมูลที่มีอยู่
-- กลายเป็นข้อมูลผิดทันทีที่รัน migration นี้
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS account_id uuid;

-- แยก FK ออกมาเพิ่มทีหลัง เพื่อให้รันซ้ำได้ถูก และ constraint ที่มีอยู่แล้ว
-- จะไม่ทำให้ migration ล้มกลางคัน
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admins_account_id_fkey') THEN
    ALTER TABLE public.admins
      ADD CONSTRAINT admins_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_account_id_fkey') THEN
    ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_account_id_fkey') THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- หนึ่ง account มี profile ได้ 1 แถวต่อหนึ่งตาราง แต่ข้ามตารางแชร์กันได้
-- (คนคนเดียวเป็นได้ทั้งครูและนักเรียน — ดู 0010)
CREATE UNIQUE INDEX IF NOT EXISTS admins_account_id_key
  ON public.admins (account_id) WHERE account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teachers_account_id_key
  ON public.teachers (account_id) WHERE account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS students_account_id_key
  ON public.students (account_id) WHERE account_id IS NOT NULL;

COMMENT ON TABLE public.user_accounts IS
  'ตัวตนกลางสำหรับล็อกอิน admins/teachers/students เป็นตาราง profile ที่เชื่อมมาผ่าน account_id ซึ่ง NULL ได้';

-- ------------------------------------------------------------
-- SMOKE (ควรได้: ตารางมีอยู่, 0 แถว, และมีคอลัมน์ account_id 3 ตาราง)
--   SELECT count(*) FROM public.user_accounts;
--   SELECT table_name FROM information_schema.columns
--    WHERE column_name = 'account_id' AND table_schema = 'public';
-- ------------------------------------------------------------

-- ROLLBACK:
--   ALTER TABLE public.admins   DROP CONSTRAINT IF EXISTS admins_account_id_fkey;
--   ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_account_id_fkey;
--   ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_account_id_fkey;
--   DROP INDEX IF EXISTS public.admins_account_id_key;
--   DROP INDEX IF EXISTS public.teachers_account_id_key;
--   DROP INDEX IF EXISTS public.students_account_id_key;
--   ALTER TABLE public.admins   DROP COLUMN IF EXISTS account_id;
--   ALTER TABLE public.teachers DROP COLUMN IF EXISTS account_id;
--   ALTER TABLE public.students DROP COLUMN IF EXISTS account_id;
--   DROP TABLE IF EXISTS public.user_accounts;
