-- ============================================================
-- 0006 — Student 360 core columns
--
-- `students` currently holds only: student_id, names, nickname, phone,
-- program, entry_year, department, uid, card_status, photo_url, and the
-- Google/LINE ids. Two gaps block the roadmap:
--
--   1. There is no status for the PERSON. `card_status` is the RFID card's
--      status (active/inactive/lost) — it cannot express studying / on_leave /
--      graduated / resigned, which Registration, Alumni, and Finance all need.
--   2. Students are not linked to a class at all. `class_groups` exists and is
--      used for room scheduling, but nothing joins a student to one, so
--      "นักเรียนในห้องของฉัน" is currently unanswerable.
--
-- Every column here is nullable or defaulted, so existing rows stay valid and
-- existing SELECTs are unaffected. Guardians and education history are their
-- own tables in Phase 2.
--
-- Additive only. Safe to run twice.
-- ============================================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS national_id text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS student_status text NOT NULL DEFAULT 'studying'::text,
  ADD COLUMN IF NOT EXISTS class_group_id uuid,
  ADD COLUMN IF NOT EXISTS advisor_teacher_id uuid;

-- CHECK constraints added separately: ALTER TABLE ... ADD CONSTRAINT has no
-- IF NOT EXISTS, so a second run would abort the whole file without a guard.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_gender_check') THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_gender_check
      CHECK (gender IS NULL OR gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]));
  END IF;

  -- CAUTION: src/types/database.ts declares student_status with the values
  -- 'active' | 'inactive' | 'suspended'. That column is NOT in schema.sql and
  -- no code reads or writes it, so it is almost certainly a phantom type — but
  -- "almost certainly" is not good enough when running against production. If
  -- the column already exists with out-of-range values, ADD CONSTRAINT would
  -- abort. Check first and report instead of failing.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_student_status_check') THEN
    IF EXISTS (
      SELECT 1 FROM public.students
       WHERE student_status IS NOT NULL
         AND student_status <> ALL (ARRAY['studying','on_leave','transferred','graduated','resigned','expelled'])
    ) THEN
      RAISE WARNING 'students.student_status holds values outside the new set (%). Constraint NOT added — map the old values first, then re-run this file.',
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

-- national_id is unique when present, but most rows will not have one yet.
CREATE UNIQUE INDEX IF NOT EXISTS students_national_id_key
  ON public.students (national_id) WHERE national_id IS NOT NULL;

-- Roster and homeroom lookups.
CREATE INDEX IF NOT EXISTS students_class_group_id_idx ON public.students (class_group_id);
CREATE INDEX IF NOT EXISTS students_advisor_teacher_id_idx ON public.students (advisor_teacher_id);
CREATE INDEX IF NOT EXISTS students_student_status_idx ON public.students (student_status);

COMMENT ON COLUMN public.students.student_status IS
  'สถานะของนักเรียน (คนละเรื่องกับ card_status ซึ่งเป็นสถานะของบัตร RFID)';

-- ------------------------------------------------------------
-- PRE-FLIGHT — run this BEFORE the file and read the result:
--   SELECT column_name, data_type, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'students'
--    ORDER BY ordinal_position;
--
-- If student_status already exists, also run:
--   SELECT student_status, count(*) FROM public.students GROUP BY 1;
-- and map any legacy values (active/inactive/suspended) onto the new set
-- before applying, e.g.:
--   UPDATE public.students SET student_status = 'studying' WHERE student_status = 'active';
--
-- SMOKE
--   SELECT student_status, count(*) FROM public.students GROUP BY 1;
--     -- expect every existing row to be 'studying'
--   SELECT count(*) FROM public.students WHERE class_group_id IS NOT NULL;
--     -- expect 0 until rosters are assigned in Phase 2
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
