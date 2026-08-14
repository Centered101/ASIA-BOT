-- ============================================================
-- 0002 — สร้าง user_accounts จากข้อมูลที่มีอยู่  (ข้อมูลล้วน ไม่มี DDL)
--
-- สร้าง 1 บัญชีต่อ admin / student / teacher ที่อนุมัติแล้ว แล้วผูก
-- profile.account_id กลับมา
--
-- ครูได้ login เป็นครั้งแรกที่นี่ ตาราง `teachers` มี desired_username +
-- desired_password_hash อยู่แล้วจากหน้า /become-teacher ซึ่งไม่เคยถูกใช้เลย
-- เราเอาค่านั้นมาใช้เป็น credential
--
-- นักเรียนตั้งใจให้ password_hash = NULL เพราะปัจจุบันยืนยันตัวตนด้วย
-- student_id + student_phone และเบอร์โทรไม่ควรกลายเป็น password hash ที่เก็บไว้
-- เส้นทางล็อกอินของนักเรียนไม่ถูกกระทบจาก migration นี้
--
-- ── แก้แล้วหลังเจอ error 23505 บน production ────────────────────────────────
-- เวอร์ชันแรกใส่ google_id / google_email ลง INSERT ตรง ๆ โดยกันไว้แค่
-- `ON CONFLICT (lower(login))` แต่ 0001 สร้าง unique index ไว้ 3 ตัว
-- (login, google_id, google_email) และ ON CONFLICT รับได้ทีละตัวเท่านั้น
-- การชนที่ google_id จึงทำให้ทั้ง migration ล้ม
--
-- การชนนี้เกิดจริงและเป็นเรื่องปกติของข้อมูลชุดนี้: `google_id` ที่นี่เก็บ
-- Supabase Auth user id (UUID) คนที่เป็นทั้ง admin และนักเรียนจึงมีค่าเดียวกัน
-- ในสองตาราง ซึ่งเป็นสิ่งที่ `admins.linked_student_id` มีไว้รองรับพอดี
--
-- วิธีแก้: insert บัญชีโดยไม่แตะคอลัมน์ Google ก่อน แล้วค่อยเติมทีหลังในรอบแยก
-- ที่เติมเฉพาะค่าที่ไม่กำกวม ตาราง profile ยังเก็บ google_id/google_email
-- ของตัวเองไว้ครบ และ Google login ปัจจุบัน resolve จากตารางเหล่านั้น
-- (ดู /api/auth/google และ /api/admin/auth/google) ไม่ใช่จาก user_accounts
-- จึงไม่มีอะไรพัง ส่วนการชนจะถูกรายงานด้วย query ท้ายไฟล์แทนการเดา
--
-- รันซ้ำได้: ทุกคำสั่งมีการ์ดกันไว้ รันซ้ำแล้วไม่มีอะไรเปลี่ยน
-- ============================================================

-- --- แอดมิน --------------------------------------------------
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

-- --- นักเรียน ------------------------------------------------
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

-- --- ครู (เฉพาะที่อนุมัติ/ใช้งานอยู่) --------------------------
-- ใบสมัครที่ยัง pending หรือถูกปฏิเสธ ต้องไม่กลายเป็น login ที่ใช้ได้
-- หมายเหตุ: teachers.email เป็นอีเมลติดต่อธรรมดา ไม่ใช่ Google identity ที่
-- verify แล้ว เวอร์ชันแรกเขียนค่านี้ลง google_email ซึ่งทั้งบิดเบือนความหมาย
-- และเสี่ยงชนกับ Google address จริงของแอดมิน จึงปล่อยเป็น NULL
-- ถ้าครูเชื่อม Google เมื่อไหร่ค่อยผูกอย่างตั้งใจ
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

-- --- Google identity เติมเฉพาะที่ไม่กำกวม ---------------------
-- หนึ่ง google_id มีผู้ชนะได้คนเดียว ฝั่ง admin ชนะ student เพราะบัญชี admin
-- คือฝั่งที่ล็อกอินด้วย Google จริงในวันนี้ ส่วน profile ที่แพ้ยังเก็บ
-- คอลัมน์ google_id ของตัวเองไว้ครบ เส้นทางล็อกอินจึงไม่ถูกกระทบ
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
-- SMOKE — จำนวนของ admins และ teachers ต้องเป็น 0
--
-- ถ้าจำนวนของ STUDENTS ไม่เป็น 0 มักไม่ใช่การชนกันของคนสองคน
-- บนฐานข้อมูลนี้มันหมายถึงคนคนเดียวที่มี 2 profile: staff ที่ username
-- ของตัวเองเป็น student_id ของตัวเอง วิธีแก้คือให้ทั้งสอง profile ใช้ account
-- เดียวกัน ซึ่งคือสิ่งที่ 0010_link_dual_profile.sql ทำ
-- อย่าเพิ่งเปลี่ยนชื่อใคร จนกว่าจะเช็ก admins.linked_student_id ก่อน
--
--   SELECT count(*) FROM public.admins   WHERE account_id IS NULL;
--   SELECT count(*) FROM public.students WHERE account_id IS NULL;
--   SELECT count(*) FROM public.teachers
--    WHERE account_id IS NULL AND status IN ('approved','active')
--      AND desired_username IS NOT NULL;
--
-- ตรวจความสมเหตุสมผล: จำนวนควรตรงกับตาราง profile
--   SELECT subject_type, count(*) FROM public.user_accounts GROUP BY 1;
--
-- เป็นเรื่องปกติ ไม่ใช่ error: profile ที่ Google identity ไปอยู่กับอีก account
-- เพราะคนคนเดียวกันถือ 2 profile คอลัมน์ google_id ของตัวเองยังอยู่ครบ
-- และ Google login ของเขายังใช้ได้
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
