-- ============================================================
-- 0020 — ให้นักเรียนกรอกข้อมูลของตัวเองได้
--
-- เปิดให้นักเรียนจัดการ ผู้ปกครอง / ประวัติการศึกษาเดิม / ผลงานและรางวัล
-- ของตัวเอง (ไทม์ไลน์การเปลี่ยนแปลงไม่รวมอยู่ด้วย ดูเหตุผลท้ายไฟล์)
--
-- ปัญหาคือสามตารางนี้เดิมมีแต่ฝ่ายทะเบียนเป็นคนกรอก พอเปิดให้นักเรียนกรอกด้วย
-- จะแยกไม่ออกว่าแถวไหนมาจากใคร แล้วนักเรียนจะลบทับข้อมูลที่ฝ่ายทะเบียนตรวจ
-- แล้วได้ ซึ่งอันตรายที่สุดกับเบอร์ผู้ติดต่อฉุกเฉิน — ถ้าถูกแก้เป็นเบอร์เพื่อน
-- โรงเรียนจะโทรหาผู้ปกครองไม่ได้ตอนเกิดเหตุจริง และไม่มีใครรู้ว่าถูกแก้ไปแล้ว
--
-- คอลัมน์ source จึงบอกว่าแถวนั้นใครเป็นคนกรอก ฝั่งแอปบังคับว่า
--   - นักเรียนเพิ่มแถวใหม่ได้เสมอ (source = 'student')
--   - นักเรียนแก้/ลบได้เฉพาะแถวที่ source = 'student'
--   - แถวของฝ่ายทะเบียน (source = 'staff') นักเรียนเห็นแต่แตะไม่ได้
--
-- ค่าตั้งต้นเป็น 'staff' เพราะแถวที่มีอยู่แล้วทั้งหมดมาจากฝ่ายทะเบียน
-- ข้อมูลเดิมจึงถูกล็อกไว้ให้อัตโนมัติโดยไม่ต้อง backfill
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

ALTER TABLE public.guardians
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'staff',
  -- ตารางอื่นมี recorded_by อยู่แล้ว ตารางนี้ไม่มี เพิ่มให้ครบชุดเดียวกัน
  ADD COLUMN IF NOT EXISTS recorded_by text;

ALTER TABLE public.student_education_history
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'staff';

ALTER TABLE public.student_achievements
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'staff';

-- CHECK แยกออกมาเพราะ ADD CONSTRAINT ไม่มี IF NOT EXISTS
-- ถ้าไม่มีการ์ด การรันรอบสองจะล้มทั้งไฟล์
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'guardians',
    'student_education_history',
    'student_achievements'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = t || '_source_check'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (source = ANY (ARRAY[''staff''::text, ''student''::text]))',
        t, t || '_source_check'
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.guardians.source IS
  'ใครกรอกแถวนี้ — staff = ฝ่ายทะเบียน (นักเรียนแก้ไม่ได้), student = นักเรียนกรอกเอง';
COMMENT ON COLUMN public.student_education_history.source IS
  'ใครกรอกแถวนี้ — staff = ฝ่ายทะเบียน (นักเรียนแก้ไม่ได้), student = นักเรียนกรอกเอง';
COMMENT ON COLUMN public.student_achievements.source IS
  'ใครกรอกแถวนี้ — staff = ฝ่ายทะเบียน (นักเรียนแก้ไม่ได้), student = นักเรียนกรอกเอง';

-- ------------------------------------------------------------
-- ทำไมไทม์ไลน์ (student_status_changes) ไม่อยู่ในไฟล์นี้
--
-- ตารางนั้นบันทึกการย้ายสาขา เปลี่ยนสถานะ พักการเรียน ลาออก ซึ่งเป็น
-- "สิ่งที่โรงเรียนตัดสิน" ไม่ใช่ "สิ่งที่นักเรียนกรอก" ถ้าเขียนได้เอง
-- นักเรียนจะสร้างประวัติปลอมของตัวเองได้ และตารางนี้ทั้งตารางจะเชื่อถือไม่ได้อีก
-- ฝั่งแอปจึงเปิดให้นักเรียน "อ่าน" อย่างเดียว ไม่มี endpoint สำหรับเขียน
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- SMOKE
--   -- ต้องเจอคอลัมน์ครบสามตาราง
--   SELECT table_name, column_name, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE column_name = 'source'
--      AND table_name IN ('guardians','student_education_history','student_achievements');
--
--   -- ต้องเจอ constraint ครบสามตัว
--   SELECT conname FROM pg_constraint WHERE conname LIKE '%_source_check';
--
--   -- แถวเดิมต้องเป็น staff ทั้งหมด
--   SELECT source, count(*) FROM public.guardians GROUP BY 1;
--
--   -- ค่านอกรายการต้องถูกปฏิเสธ (คำสั่งนี้ต้อง error 23514)
--   -- UPDATE public.guardians SET source = 'อะไรก็ไม่รู้' WHERE true;
-- ------------------------------------------------------------

-- ROLLBACK:
--   ALTER TABLE public.guardians DROP CONSTRAINT IF EXISTS guardians_source_check;
--   ALTER TABLE public.student_education_history DROP CONSTRAINT IF EXISTS student_education_history_source_check;
--   ALTER TABLE public.student_achievements DROP CONSTRAINT IF EXISTS student_achievements_source_check;
--   ALTER TABLE public.guardians DROP COLUMN IF EXISTS source;
--   ALTER TABLE public.guardians DROP COLUMN IF EXISTS recorded_by;
--   ALTER TABLE public.student_education_history DROP COLUMN IF EXISTS source;
--   ALTER TABLE public.student_achievements DROP COLUMN IF EXISTS source;
