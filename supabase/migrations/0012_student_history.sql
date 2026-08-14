-- ============================================================
-- 0012 — ประวัติการศึกษาเดิม และประวัติการเปลี่ยนสถานะ
--
-- สองตารางนี้ตอบคำถามคนละแบบกัน จึงแยกกัน:
--
--   student_education_history  ก่อนเข้ามาที่นี่เขาเรียนที่ไหนมา
--   student_status_changes     ตั้งแต่เข้ามาแล้ว เกิดอะไรขึ้นกับเขาบ้าง
--
-- ตัวที่สองสำคัญกว่าที่คิด: `students.student_status` (เพิ่มใน 0006) บอกได้
-- แค่สถานะ ณ ปัจจุบัน ถ้านักเรียนพักการเรียนแล้วกลับมา แล้วย้ายสาขา
-- คอลัมน์นั้นเก็บได้แค่ค่าสุดท้าย ฝ่ายทะเบียนต้องการทั้งเส้นทาง ไม่ใช่จุดจบ
--
-- ทั้งสองตารางเป็น append-only โดยเจตนา การแก้อดีตให้บันทึกแถวใหม่
-- ไม่ใช่ UPDATE ทับของเดิม
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

-- --- โรงเรียนเดิม / วุฒิที่ใช้สมัคร -------------------------
CREATE TABLE IF NOT EXISTS public.student_education_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL,

  school_name text NOT NULL,
  -- ระดับที่จบจากที่นั่น เช่น ป.6 / ม.3 / ม.6 / ปวช.
  level text,
  province text,
  gpa numeric CHECK (gpa IS NULL OR (gpa >= 0 AND gpa <= 4)),
  graduated_year text,        -- ปี พ.ศ. เก็บเป็น text ให้ตรงกับ students.entry_year
  document_url text,          -- ใบ ปพ.1 / ใบจบที่แนบตอนสมัคร
  note text,

  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT student_education_history_pkey PRIMARY KEY (id),
  CONSTRAINT student_education_history_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS student_education_history_student_id_idx
  ON public.student_education_history (student_id);

COMMENT ON TABLE public.student_education_history IS
  'ประวัติการศึกษาก่อนเข้าเรียนที่นี่ หนึ่งนักเรียนมีได้หลายแถว';


-- --- ประวัติการเปลี่ยนสถานะระหว่างเรียน ---------------------
CREATE TABLE IF NOT EXISTS public.student_status_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL,

  change_type text NOT NULL CHECK (change_type = ANY (ARRAY[
    'status'::text,             -- เปลี่ยนสถานะนักเรียน (กำลังเรียน/พัก/ลาออก/จบ)
    'department'::text,         -- ย้ายสาขา
    'class_group'::text,        -- ย้ายห้อง
    'advisor'::text,            -- เปลี่ยนครูที่ปรึกษา
    'program'::text             -- เปลี่ยนหลักสูตร เช่น ปวช. -> ปวส.
  ])),

  -- เก็บเป็น text ทั้งคู่เพื่อให้ตารางนี้บันทึกการเปลี่ยนของคอลัมน์ไหนก็ได้
  -- โดยไม่ต้องเพิ่มคอลัมน์ใหม่ทุกครั้งที่มีเรื่องใหม่ให้ติดตาม
  from_value text,
  to_value text,

  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  academic_year text,
  reason text,
  document_url text,
  recorded_by text,           -- admin_id หรือ login ของคนที่บันทึก

  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT student_status_changes_pkey PRIMARY KEY (id),
  CONSTRAINT student_status_changes_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE
);

-- ไทม์ไลน์ของนักเรียนคนหนึ่ง เรียงล่าสุดก่อน
CREATE INDEX IF NOT EXISTS student_status_changes_student_idx
  ON public.student_status_changes (student_id, effective_date DESC);

-- รายงานของฝ่ายทะเบียน เช่น "เทอมนี้มีใครย้ายสาขาบ้าง"
CREATE INDEX IF NOT EXISTS student_status_changes_type_date_idx
  ON public.student_status_changes (change_type, effective_date DESC);

COMMENT ON TABLE public.student_status_changes IS
  'ไทม์ไลน์การเปลี่ยนสถานะ/สาขา/ห้อง/ครูที่ปรึกษา เป็น append-only ห้าม UPDATE ทับ';

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.student_education_history;
--   SELECT count(*) FROM public.student_status_changes;
--
--   -- ไทม์ไลน์ของนักเรียนคนหนึ่ง
--   SELECT change_type, from_value, to_value, effective_date, reason
--     FROM public.student_status_changes
--    WHERE student_id = '3129' ORDER BY effective_date DESC;
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.student_status_changes;
--   DROP TABLE IF EXISTS public.student_education_history;
