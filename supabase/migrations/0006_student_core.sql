-- ============================================================
-- 0006 — คอลัมน์แกนกลางของ Student 360
--
-- ตอนนี้ `students` มีแค่: student_id, ชื่อ-นามสกุล, ชื่อเล่น, เบอร์โทร,
-- program, entry_year, department, uid, card_status, photo_url และ id ของ
-- Google/LINE มีช่องว่าง 2 อย่างที่บล็อก roadmap:
--
--   1. ไม่มีสถานะของ **ตัวคน** เลย `card_status` คือสถานะของบัตร RFID
--      (active/inactive/lost) ซึ่งบอกไม่ได้ว่ากำลังเรียน / พักการเรียน /
--      จบแล้ว / ลาออก ทั้งที่ฝ่ายทะเบียน ศิษย์เก่า และการเงินต้องใช้ทั้งหมด
--   2. นักเรียนไม่ได้ผูกกับห้องเรียนเลย `class_groups` มีอยู่และถูกใช้จัด
--      ตารางห้อง แต่ไม่มีอะไรเชื่อมนักเรียนเข้ากับห้อง คำถามว่า
--      "นักเรียนในห้องของฉัน" จึงตอบไม่ได้
--
-- ทุกคอลัมน์ที่เพิ่มเป็น NULL ได้หรือมีค่า default แถวเดิมจึงยังถูกต้อง
-- และ SELECT เดิมไม่ถูกกระทบ ส่วนผู้ปกครองกับประวัติการศึกษาจะแยกเป็น
-- ตารางของตัวเองใน Phase 2
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS student_status text NOT NULL DEFAULT 'studying'::text,
  ADD COLUMN IF NOT EXISTS class_group_id uuid,
  ADD COLUMN IF NOT EXISTS advisor_teacher_id uuid;

-- แยก CHECK constraint ออกมาเพิ่มทีหลัง เพราะ ALTER TABLE ... ADD CONSTRAINT
-- ไม่มี IF NOT EXISTS ถ้าไม่มีการ์ด การรันรอบสองจะทำให้ทั้งไฟล์ล้ม
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_gender_check') THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_gender_check
      CHECK (gender IS NULL OR gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]));
  END IF;

  -- ระวัง: src/types/database.ts ประกาศ student_status ไว้ด้วยค่า
  -- 'active' | 'inactive' | 'suspended' คอลัมน์นั้น **ไม่มี** ใน schema.sql
  -- และไม่มีโค้ดไหนอ่านหรือเขียน จึงเกือบแน่ว่าเป็น type ผี — แต่ "เกือบแน่"
  -- ไม่พอเมื่อรันกับ production ถ้าคอลัมน์มีอยู่จริงพร้อมค่าที่อยู่นอกชุดใหม่
  -- ADD CONSTRAINT จะล้ม จึงตรวจก่อนแล้วรายงาน แทนที่จะปล่อยให้พัง
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_student_status_check') THEN
    IF EXISTS (
      SELECT 1 FROM public.students
       WHERE student_status IS NOT NULL
         AND student_status <> ALL (ARRAY['studying','on_leave','transferred','graduated','resigned','expelled'])
    ) THEN
      RAISE WARNING 'students.student_status มีค่าที่อยู่นอกชุดใหม่ (%) จึงยังไม่ได้เพิ่ม constraint ให้ map ค่าเดิมก่อน แล้วค่อยรันไฟล์นี้ซ้ำ',
        (SELECT string_agg(DISTINCT student_status, ', ') FROM public.students
          WHERE student_status <> ALL (ARRAY['studying','on_leave','transferred','graduated','resigned','expelled']));
    ELSE
      ALTER TABLE public.students
        ADD CONSTRAINT students_student_status_check
        CHECK (student_status = ANY (ARRAY[
          'studying'::text,    -- กำลังศึกษา
          'on_leave'::text,    -- พักการเรียน
          'transferred'::text, -- ย้ายสถานศึกษา
          'graduated'::text,   -- จบการศึกษา
          'resigned'::text,    -- ลาออก
          'expelled'::text     -- พ้นสภาพ
        ]));
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_class_group_id_fkey') THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_class_group_id_fkey
      FOREIGN KEY (class_group_id) REFERENCES public.class_groups(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_advisor_teacher_id_fkey') THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_advisor_teacher_id_fkey
      FOREIGN KEY (advisor_teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- national_id ต้องไม่ซ้ำถ้ามีค่า แต่ส่วนใหญ่ยังไม่มีข้อมูลนี้
CREATE UNIQUE INDEX IF NOT EXISTS students_national_id_key
  ON public.students (national_id) WHERE national_id IS NOT NULL;

-- ใช้ค้นรายชื่อนักเรียนในห้องและงานครูที่ปรึกษา
CREATE INDEX IF NOT EXISTS students_class_group_id_idx ON public.students (class_group_id);
CREATE INDEX IF NOT EXISTS students_advisor_teacher_id_idx ON public.students (advisor_teacher_id);
CREATE INDEX IF NOT EXISTS students_student_status_idx ON public.students (student_status);

COMMENT ON COLUMN public.students.student_status IS
  'สถานะของนักเรียน (คนละเรื่องกับ card_status ซึ่งเป็นสถานะของบัตร RFID)';

-- ------------------------------------------------------------
-- ตรวจก่อนรัน — รันคำสั่งนี้ก่อนไฟล์ แล้วอ่านผลให้เข้าใจ:
--   SELECT column_name, data_type, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'students'
--    ORDER BY ordinal_position;
--
-- ถ้า student_status มีอยู่แล้ว ให้รันเพิ่ม:
--   SELECT student_status, count(*) FROM public.students GROUP BY 1;
-- แล้ว map ค่าเดิม (active/inactive/suspended) ให้เข้ากับชุดค่าใหม่
-- ก่อนจะรัน migration เช่น:
--   UPDATE public.students SET student_status = 'studying' WHERE student_status = 'active';
--
-- SMOKE
--   SELECT student_status, count(*) FROM public.students GROUP BY 1;
--     -- ควรได้ 'studying' ทุกแถวที่มีอยู่
--   SELECT count(*) FROM public.students WHERE class_group_id IS NOT NULL;
--     -- ควรได้ 0 จนกว่าจะจัดนักเรียนเข้าห้องใน Phase 2
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP INDEX IF EXISTS public.students_national_id_key;
--   DROP INDEX IF EXISTS public.students_class_group_id_idx;
--   DROP INDEX IF EXISTS public.students_advisor_teacher_id_idx;
--   DROP INDEX IF EXISTS public.students_student_status_idx;
--   ALTER TABLE public.students
--     DROP CONSTRAINT IF EXISTS students_gender_check,
--     DROP CONSTRAINT IF EXISTS students_student_status_check,
--     DROP CONSTRAINT IF EXISTS students_class_group_id_fkey,
--     DROP CONSTRAINT IF EXISTS students_advisor_teacher_id_fkey;
--   ALTER TABLE public.students
--     DROP COLUMN IF EXISTS birth_date,
--     DROP COLUMN IF EXISTS gender,
--     DROP COLUMN IF EXISTS national_id,
--     DROP COLUMN IF EXISTS address,
--     DROP COLUMN IF EXISTS student_status,
--     DROP COLUMN IF EXISTS class_group_id,
--     DROP COLUMN IF EXISTS advisor_teacher_id;
