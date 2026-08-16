-- ============================================================
-- 0018 — เช็กชื่อรายวิชา และงานที่สั่งในคาบ
--
-- ที่มีอยู่แล้วคือ `attendance` ซึ่งเป็นการเข้า-ออกโรงเรียนผ่านบัตร RFID
-- บอกได้แค่ว่าวันนั้นมาโรงเรียนไหม ไม่ได้บอกว่าเข้าเรียนวิชาไหนบ้าง
-- นักเรียนที่มาโรงเรียนแล้วโดดคาบจึงดูเหมือนมาเรียนปกติ
--
-- ตารางนี้เก็บระดับ "คาบ" โดยอ้าง class_schedules ที่มีอยู่แล้ว 39 คาบ
-- รายชื่อนักเรียนในคาบมาจาก students.class_group_id ที่ตรงกับ
-- class_schedules.class_group_id จึงไม่ต้องมีตารางรายชื่อแยกอีกตัว
--
-- ⚠ ต้องจัดนักเรียนเข้าห้องก่อน (students.class_group_id) ไม่งั้นคาบจะไม่มี
--   รายชื่อให้เช็ก — ทำได้ที่ /admin/student-360
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

-- --- ผูกตารางเรียนกับครูตัวจริง -----------------------------
-- class_schedules.teacher เป็น text มาแต่เดิม ใช้แสดงผลได้แต่ query ไม่ได้
-- ครูจึงเปิดดู "คาบของฉันวันนี้" ไม่ได้ เพราะไม่มีอะไรผูกกับบัญชีเขา
-- คอลัมน์ text เดิมยังอยู่ ไม่ลบ เพื่อไม่ให้หน้าตารางเรียนที่ใช้อยู่พัง
ALTER TABLE public.class_schedules
  ADD COLUMN IF NOT EXISTS teacher_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_schedules_teacher_id_fkey') THEN
    ALTER TABLE public.class_schedules
      ADD CONSTRAINT class_schedules_teacher_id_fkey
      FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS class_schedules_teacher_idx
  ON public.class_schedules (teacher_id, day_of_week) WHERE teacher_id IS NOT NULL;


-- --- เช็กชื่อรายคาบ ------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_schedule_id uuid NOT NULL,
  student_id text NOT NULL,
  attend_date date NOT NULL DEFAULT CURRENT_DATE,

  status text NOT NULL DEFAULT 'present'::text CHECK (status = ANY (ARRAY[
    'present'::text,   -- มาเรียน
    'late'::text,      -- มาสาย
    'absent'::text,    -- ขาด
    'leave'::text,     -- ลา
    'activity'::text   -- ไปกิจกรรม/แข่งขัน ไม่นับขาด
  ])),
  note text,
  recorded_by text,            -- admin_id / teacher id ของคนเช็ก

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT class_attendance_pkey PRIMARY KEY (id),
  CONSTRAINT class_attendance_schedule_fkey
    FOREIGN KEY (class_schedule_id) REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  CONSTRAINT class_attendance_student_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE
);

-- หนึ่งนักเรียนมีผลได้ครั้งเดียวต่อคาบต่อวัน การเช็กซ้ำคือการแก้ของเดิม
-- ไม่ใช่การเพิ่มแถวใหม่ ไม่งั้นยอดขาดจะนับซ้ำ
CREATE UNIQUE INDEX IF NOT EXISTS class_attendance_unique_entry
  ON public.class_attendance (class_schedule_id, student_id, attend_date);

-- "คาบนี้วันนี้ใครมาบ้าง" — query หลักตอนเปิดหน้าเช็กชื่อ
CREATE INDEX IF NOT EXISTS class_attendance_session_idx
  ON public.class_attendance (class_schedule_id, attend_date);

-- "นักเรียนคนนี้ขาดไปกี่คาบแล้ว" — ใช้ทำ alert ขาดเกินกำหนด
-- partial index เพราะคำถามนี้สนใจเฉพาะที่ไม่ได้มาเรียน
CREATE INDEX IF NOT EXISTS class_attendance_student_missing_idx
  ON public.class_attendance (student_id, attend_date DESC)
  WHERE status IN ('absent', 'late');

COMMENT ON TABLE public.class_attendance IS
  'เช็กชื่อระดับคาบเรียน คนละเรื่องกับตาราง attendance ที่เป็นการเข้า-ออกโรงเรียนด้วยบัตร';


-- --- งานที่สั่งในคาบ ------------------------------------------
-- ตอบโจทย์ "นักเรียนขาดเรียนแล้วไม่รู้ว่าครูสั่งงานอะไร" โดยผูกงานกับคาบ
-- ระบบจึงบอกได้ว่าวันที่เขาขาด คาบนั้นมีงานอะไรค้างอยู่
CREATE TABLE IF NOT EXISTS public.class_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_schedule_id uuid NOT NULL,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,

  title text NOT NULL,
  description text,
  due_date date,
  max_score numeric CHECK (max_score IS NULL OR max_score >= 0),
  attachment_url text,
  created_by text,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT class_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT class_assignments_schedule_fkey
    FOREIGN KEY (class_schedule_id) REFERENCES public.class_schedules(id) ON DELETE CASCADE
);

-- "วันที่นักเรียนขาด คาบนั้นสั่งงานอะไรไว้"
CREATE INDEX IF NOT EXISTS class_assignments_session_idx
  ON public.class_assignments (class_schedule_id, assigned_date DESC);

CREATE INDEX IF NOT EXISTS class_assignments_due_idx
  ON public.class_assignments (due_date) WHERE due_date IS NOT NULL;

COMMENT ON TABLE public.class_assignments IS
  'งานที่ครูสั่งในคาบ ใช้บอกนักเรียนที่ขาดว่ามีงานอะไรค้าง';

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.class_attendance;
--   SELECT count(*) FROM public.class_assignments;
--
--   -- ต้องมีคอลัมน์ teacher_id
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'class_schedules' AND column_name = 'teacher_id';
--
--   -- คาบที่พร้อมเช็กชื่อ = คาบที่ห้องมีนักเรียนอยู่จริง
--   -- ถ้าได้ 0 แปลว่ายังไม่ได้จัดนักเรียนเข้าห้อง ให้ไปทำที่ /admin/student-360 ก่อน
--   SELECT count(DISTINCT cs.id)
--     FROM public.class_schedules cs
--     JOIN public.students s ON s.class_group_id = cs.class_group_id;
--
--   -- เช็กซ้ำต้องไม่ได้ (คำสั่งที่สองต้อง error 23505)
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.class_assignments;
--   DROP TABLE IF EXISTS public.class_attendance;
--   ALTER TABLE public.class_schedules
--     DROP CONSTRAINT IF EXISTS class_schedules_teacher_id_fkey;
--   ALTER TABLE public.class_schedules DROP COLUMN IF EXISTS teacher_id;
