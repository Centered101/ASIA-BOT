-- ============================================================
-- 0019 — เพิ่ม division (ฝ่าย) ให้ admins
--
-- เมนูหลังบ้านถูกจัดกลุ่มตามฝ่ายไปแล้ว แต่การมองเห็นยังคุมด้วย role เดิม
-- 3 ระดับ (superadmin/admin/staff) เท่านั้น คนของฝ่ายอาคารจึงเห็นเมนู
-- ฝ่ายทะเบียน ฝ่ายวิชาการ สหกรณ์ ครบทุกอัน ทั้งที่ไม่ใช่งานตัวเอง
--
-- คอลัมน์นี้บอกว่าบัญชีนั้นสังกัดฝ่ายไหน ค่าที่เก็บใช้ key ชุดเดียวกับ
-- roles.key (ดู 0003_rbac.sql และ src/lib/rbac/definitions.ts) ไม่ได้ตั้งชื่อ
-- ใหม่ ถ้าวันหนึ่งย้ายไปใช้ user_roles เต็มตัวจะเป็นแค่การย้ายข้อมูล
-- ไม่ต้องไล่เปลี่ยนชื่อทั้งระบบ
--
-- NULL = ยังไม่ระบุฝ่าย ตั้งใจให้แปลว่า "ไม่กรอง" ฝั่งแอปจะแสดงเมนูเหมือนเดิม
-- ทุกอย่าง บัญชีเก่าจึงไม่พังระหว่างที่ทยอยตั้งค่าให้ทีละคน
--
-- superadmin กับ admin ทำงานข้ามฝ่ายอยู่แล้ว ไม่ต้องตั้งค่านี้
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS division text;

-- CHECK แยกออกมา เพราะ ADD CONSTRAINT ไม่มี IF NOT EXISTS
-- ถ้าไม่มีการ์ด การรันรอบสองจะล้มทั้งไฟล์
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'admins_division_check'
  ) THEN
    ALTER TABLE public.admins
      ADD CONSTRAINT admins_division_check
      CHECK (division IS NULL OR division = ANY (ARRAY[
        'REGISTRAR'::text,        -- ฝ่ายทะเบียน
        'ACADEMIC'::text,         -- ฝ่ายวิชาการ
        'STUDENT_AFFAIRS'::text,  -- ฝ่ายกิจการนักเรียน
        'MAINTENANCE'::text,      -- ฝ่ายอาคารสถานที่
        'ASSET_MANAGER'::text,    -- ฝ่ายพัสดุ
        'SHOP_MANAGER'::text      -- สหกรณ์โรงเรียน
      ]));
  END IF;
END $$;

COMMENT ON COLUMN public.admins.division IS
  'ฝ่ายที่สังกัด ใช้ key เดียวกับ roles.key — NULL คือยังไม่ระบุ แปลว่าเห็นเมนูทุกฝ่ายเหมือนเดิม';

-- ------------------------------------------------------------
-- SMOKE
--   -- ต้องเจอคอลัมน์
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name = 'admins' AND column_name = 'division';
--
--   -- ต้องเจอ constraint
--   SELECT conname FROM pg_constraint WHERE conname = 'admins_division_check';
--
--   -- ค่านอกรายการต้องถูกปฏิเสธ (คำสั่งนี้ต้อง error 23514)
--   -- UPDATE public.admins SET division = 'ฝ่ายอะไรก็ไม่รู้' WHERE true;
--
--   -- ดูว่าตอนนี้ใครอยู่ฝ่ายไหน
--   SELECT role, division, count(*) FROM public.admins GROUP BY 1,2 ORDER BY 1,2;
-- ------------------------------------------------------------

-- ROLLBACK:
--   ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS admins_division_check;
--   ALTER TABLE public.admins DROP COLUMN IF EXISTS division;
