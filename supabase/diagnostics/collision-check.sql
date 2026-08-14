-- ============================================================
-- วินิจฉัยก่อนรัน 0002 ใหม่  (READ-ONLY ทั้งหมด ไม่แก้ข้อมูลใด ๆ)
-- ============================================================

-- 1) 0002 รอบที่ error ทิ้งอะไรไว้ไหม?
--    Supabase SQL Editor ครอบ script ด้วย transaction เดียว ปกติจะ rollback หมด
--    ทั้งสามค่าควรเป็น 0 ถ้า rollback สมบูรณ์
SELECT
  (SELECT count(*) FROM public.user_accounts)                        AS accounts_created,
  (SELECT count(*) FROM public.admins   WHERE account_id IS NOT NULL) AS admins_linked,
  (SELECT count(*) FROM public.students WHERE account_id IS NOT NULL) AS students_linked;

-- 2) ยืนยันสาเหตุ: google_id ตัวเดียวกันอยู่ทั้งใน admins และ students
SELECT
  a.google_id,
  a.admin_id,
  a.username,
  a.google_email      AS admin_google_email,
  s.student_id,
  s.first_name || ' ' || s.last_name AS student_name,
  a.linked_student_id
FROM public.admins a
JOIN public.students s ON s.google_id = a.google_id
WHERE a.google_id IS NOT NULL;

-- 3) google_email ก็มี unique index เหมือนกัน — เช็กว่าชนด้วยไหม
SELECT
  lower(a.google_email) AS google_email,
  a.admin_id,
  s.student_id
FROM public.admins a
JOIN public.students s ON lower(s.google_email) = lower(a.google_email)
WHERE a.google_email IS NOT NULL;

-- 4) ซ้ำกันเองภายในตารางเดียว (students.google_id ไม่มี UNIQUE ใน schema.sql
--    ต่างจาก admins.google_id ที่มี — ตรงนี้จึงอาจซ้ำได้)
SELECT google_id, count(*) AS n, string_agg(student_id, ', ') AS student_ids
FROM public.students
WHERE google_id IS NOT NULL
GROUP BY google_id
HAVING count(*) > 1;

SELECT lower(google_email) AS google_email, count(*) AS n, string_agg(student_id, ', ') AS student_ids
FROM public.students
WHERE google_email IS NOT NULL
GROUP BY lower(google_email)
HAVING count(*) > 1;

-- 5) login ชนกันระหว่าง admins.username กับ students.student_id
SELECT a.username, a.admin_id, s.student_id
FROM public.admins a
JOIN public.students s ON lower(s.student_id) = lower(a.username);
