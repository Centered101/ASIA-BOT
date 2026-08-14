-- ============================================================
-- 0010 — ผูก profile นักเรียนของคนที่มี 2 บทบาท เข้ากับ account ของเขา
--        (ข้อมูลล้วน ไม่มี DDL — รันได้เลย ไม่ต้องแก้อะไร)
--
-- เรื่องนี้คืออะไรกันแน่
-- หลัง 0002 ฐานข้อมูลมี user_accounts 6 แถวสำหรับ 7 profile ซึ่งตอนแรกอ่านว่า
-- "นักเรียนถูกข้ามเพราะ username ชนกัน ต้องเปลี่ยนชื่อแอดมิน" — อ่านผิด
--
-- ธเนศ สีแดง (โอม) เป็นทั้งนักเรียนรหัส 3175 และ staff admin
-- ADM-1783669050569 เขาคือคนคนเดียว และ admins.linked_student_id = '3175'
-- บันทึกเรื่องนี้ไว้อยู่แล้ว การที่ login '3175' โผล่ทั้งสองตารางไม่ใช่คนสองคน
-- ชนกัน แต่คือคนเดียวที่ถือ 2 profile ซึ่งเป็นเคสที่โมเดลตัวตนของ Phase 1
-- ออกแบบมารองรับพอดี:
--
--   user_accounts (1 แถวต่อ 1 คน)
--        ↑                    ↑
--   admins.account_id   students.account_id
--
-- FK ทั้งสองตัวมี unique index แยกตามตาราง ดังนั้น 1 account ถูกอ้างจากแถว
-- admin ได้มากสุด 1 แถว และจากแถว student ได้มากสุด 1 แถว การแชร์ข้ามตาราง
-- ทำได้ และเป็นรูปแบบที่ตั้งใจไว้
--
-- ดังนั้น 6 account ต่อ 7 profile จึง **ถูกต้อง** และต้องคงเป็น 6
-- ถ้าเปลี่ยน username ของเขาจะกลายเป็นคนเดียวมี 2 login และ audit log
-- จะถูกแยกเป็นสองสาย
--
-- migration นี้ผูก profile นักเรียนเข้ากับ account ที่แอดมินมีอยู่แล้ว
-- และให้ role STUDENT กับ account นั้นเพิ่มจาก role ฝั่ง staff ที่มีอยู่
--
-- เขียนแบบ generic: แก้ให้ทุกคู่ admin/student ที่ใช้ login เดียวกัน
-- ไม่ใช่เฉพาะรายนี้ ถ้ามีคนที่มี 2 บทบาทเพิ่มอีกก็จัดการแบบเดียวกัน
-- ============================================================

-- ── ขั้นที่ 1 — ดูก่อนว่ากระทบใครบ้าง ────────────────────────
-- ควรได้: ADM-1783669050569 / ธเนศ สีแดง / นักเรียน 3175, linked_student_id 3175
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


-- ── ขั้นที่ 2 — ผูก แล้วให้ role ────────────────────────────
DO $$
DECLARE
  linked  integer;
  granted integer;
BEGIN
  -- ผูก profile นักเรียนเข้ากับ account ที่แอดมินมีอยู่แล้ว แต่ทำเฉพาะเมื่อ
  -- นักเรียนยังไม่มี account ถ้ามีอยู่แล้วจะไม่แตะ
  UPDATE public.students s
     SET account_id = a.account_id
    FROM public.admins a
   WHERE s.account_id IS NULL
     AND a.account_id IS NOT NULL
     AND lower(a.username) = lower(s.student_id);
  GET DIAGNOSTICS linked = ROW_COUNT;

  -- ตอนนี้ account นั้นเป็นตัวแทนของนักเรียนด้วย จึงต้องได้ role STUDENT
  -- เพิ่มจาก role ฝั่งแอดมินที่มีอยู่แล้ว
  INSERT INTO public.user_roles (account_id, role_key)
  SELECT s.account_id, 'STUDENT'
    FROM public.students s
   WHERE s.account_id IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS granted = ROW_COUNT;

  RAISE NOTICE 'ผูก profile นักเรียน % รายการ และเพิ่ม role STUDENT % รายการ', linked, granted;

  IF linked = 0 THEN
    RAISE NOTICE 'ไม่มีนักเรียนรอผูก อาจทำไปแล้ว หรือไม่มีรายการต้องทำ';
  END IF;
END $$;


-- ------------------------------------------------------------
-- SMOKE
--
--   -- ต้องเป็น 0: นักเรียนทุกคนมี account แล้ว
--   SELECT count(*) FROM public.students WHERE account_id IS NULL;
--
--   -- ต้องยังเป็น 6 — หนึ่งคน หนึ่ง account ไม่ใช่ 7
--   SELECT count(*) FROM public.user_accounts;
--
--   -- ธเนศ: 1 account, ครบทั้งสอง profile, ครบทั้งสอง role
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
--   -- ควรได้: 3175 | admin | ADM-1783669050569 | staff | 3175 | ACADEMIC, STUDENT
--
--   -- ทุก account ยังต้องมีอย่างน้อย 1 role
--   SELECT count(*) FROM public.user_accounts ua
--    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.account_id = ua.id);
--
--   -- ต้องไม่มี account ไหนถูกอ้างโดยสองแถวในตารางเดียวกัน
--   SELECT account_id, count(*) FROM public.students
--    WHERE account_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--   SELECT account_id, count(*) FROM public.admins
--    WHERE account_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
-- ------------------------------------------------------------

-- หมายเหตุเรื่อง subject_type
-- account ของเขายังเป็น subject_type = 'admin' คอลัมน์นี้บันทึกว่า account
-- ถูกสร้างมาจาก profile ไหน เป็นแค่ข้อมูลบอกใบ้ ไม่ใช่ตัวตัดสินสิทธิ์
-- สิทธิ์มาจาก user_roles และ resolvePrincipal() อ่านตาราง profile ด้วย
-- account_id ไม่มีตรงไหนแตกเงื่อนไขตาม subject_type เพื่อตัดสินว่าเขาทำอะไรได้
-- การปล่อยไว้เป็น 'admin' จึงไม่เสียอะไร และไม่ต้องไปเขียนประวัติใหม่

-- ROLLBACK:
--   DELETE FROM public.user_roles ur
--    USING public.students s
--    WHERE ur.account_id = s.account_id
--      AND ur.role_key = 'STUDENT'
--      AND s.student_id = '3175';
--   UPDATE public.students SET account_id = NULL WHERE student_id = '3175';
