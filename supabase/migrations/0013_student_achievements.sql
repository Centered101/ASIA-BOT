-- ============================================================
-- 0013 — ผลงาน รางวัล การแข่งขัน และตำแหน่งในโรงเรียน
--
-- ทุกวันนี้ผลงานนักเรียนอยู่ในตาราง `projects` ซึ่งเป็นผลงานระดับ "โปรเจกต์
-- ที่มีหน้าเว็บให้ประเมิน" ไม่ใช่ประวัติรายบุคคล ทำให้ตอบไม่ได้ว่า
-- นักเรียนคนนี้เคยไปแข่งอะไรมาบ้าง ได้รางวัลอะไร เคยเป็นหัวหน้าห้องปีไหน
--
-- แยกเป็นสองตารางเพราะเป็นคนละเรื่อง:
--   student_achievements  เหตุการณ์ที่เกิดครั้งเดียว (แข่ง ได้รางวัล ได้เกียรติบัตร)
--   student_positions     ช่วงเวลาที่ดำรงตำแหน่ง (มีวันเริ่ม วันสิ้นสุด)
--
-- ตารางแรกมี event_date จุดเดียว ตารางที่สองมีช่วง ถ้ารวมกันจะต้องมีคอลัมน์
-- ที่ว่างครึ่งหนึ่งตลอดเวลา และ query "ตอนนี้ใครเป็นหัวหน้าห้อง" จะเขียนยาก
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

-- --- ผลงาน / รางวัล / การแข่งขัน ---------------------------
CREATE TABLE IF NOT EXISTS public.student_achievements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL,

  kind text NOT NULL DEFAULT 'competition'::text CHECK (kind = ANY (ARRAY[
    'competition'::text,        -- การแข่งขัน
    'award'::text,              -- รางวัล
    'certificate'::text,        -- เกียรติบัตร
    'performance'::text,        -- การแสดง/นำเสนอ
    'publication'::text         -- ผลงานเผยแพร่
  ])),

  title text NOT NULL,
  -- ระดับของงาน ใช้จัดอันดับความสำคัญเวลาแสดงในโปรไฟล์และทำรายงาน
  level text CHECK (level IS NULL OR level = ANY (ARRAY[
    'school'::text, 'district'::text, 'province'::text,
    'region'::text, 'national'::text, 'international'::text
  ])),
  rank text,                    -- ชนะเลิศ / รองชนะเลิศอันดับ 1 / เข้าร่วม
  organizer text,               -- หน่วยงานที่จัด
  event_name text,
  event_date date,
  academic_year text,
  team_members text,            -- ชื่อเพื่อนร่วมทีม กรณีแข่งเป็นทีม
  advisor_name text,            -- ครูผู้ควบคุม
  description text,
  image_urls text[],            -- รูปเกียรติบัตร/ภาพงาน เก็บใน Supabase Storage
  document_url text,
  recorded_by text,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT student_achievements_pkey PRIMARY KEY (id),
  CONSTRAINT student_achievements_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS student_achievements_student_idx
  ON public.student_achievements (student_id, event_date DESC);

-- รายงานระดับโรงเรียน เช่น "ปีนี้ได้รางวัลระดับชาติกี่รายการ"
CREATE INDEX IF NOT EXISTS student_achievements_level_year_idx
  ON public.student_achievements (level, academic_year);

COMMENT ON TABLE public.student_achievements IS
  'ผลงาน รางวัล และการแข่งขันรายบุคคล คนละเรื่องกับตาราง projects';


-- --- ตำแหน่ง/ยศในโรงเรียน ----------------------------------
CREATE TABLE IF NOT EXISTS public.student_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL,

  position text NOT NULL,       -- หัวหน้าห้อง / ประธานนักเรียน / หัวหน้าชมรม
  scope text NOT NULL DEFAULT 'class'::text CHECK (scope = ANY (ARRAY[
    'class'::text, 'department'::text, 'school'::text, 'club'::text, 'other'::text
  ])),
  scope_ref text,               -- ชื่อห้อง/สาขา/ชมรม ที่ตำแหน่งนี้สังกัด
  academic_year text,

  started_on date NOT NULL DEFAULT CURRENT_DATE,
  ended_on date,                -- NULL = ยังดำรงตำแหน่งอยู่
  note text,
  recorded_by text,

  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT student_positions_pkey PRIMARY KEY (id),
  CONSTRAINT student_positions_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  -- วันสิ้นสุดต้องไม่มาก่อนวันเริ่ม
  CONSTRAINT student_positions_date_order
    CHECK (ended_on IS NULL OR ended_on >= started_on)
);

CREATE INDEX IF NOT EXISTS student_positions_student_idx
  ON public.student_positions (student_id, started_on DESC);

-- "ตอนนี้ใครดำรงตำแหน่งอะไรอยู่บ้าง" — partial index เพราะแถวที่จบไปแล้ว
-- ไม่เคยถูกถามในคำถามนี้
CREATE INDEX IF NOT EXISTS student_positions_active_idx
  ON public.student_positions (position, scope) WHERE ended_on IS NULL;

COMMENT ON TABLE public.student_positions IS
  'ตำแหน่งที่นักเรียนดำรงในโรงเรียน ended_on = NULL คือยังอยู่ในตำแหน่ง';

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.student_achievements;
--   SELECT count(*) FROM public.student_positions;
--
--   -- ตำแหน่งที่ยังดำรงอยู่ทั้งโรงเรียน
--   SELECT s.student_id, s.first_name, p.position, p.scope_ref
--     FROM public.student_positions p
--     JOIN public.students s ON s.student_id = p.student_id
--    WHERE p.ended_on IS NULL;
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.student_positions;
--   DROP TABLE IF EXISTS public.student_achievements;
