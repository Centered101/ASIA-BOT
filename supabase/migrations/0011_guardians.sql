-- ============================================================
-- 0011 — ผู้ปกครองและผู้ติดต่อฉุกเฉิน
--
-- ตอนนี้ `students` มีแค่ `student_phone` ของตัวนักเรียนเอง ไม่มีข้อมูล
-- ผู้ปกครองเลยสักช่อง ทำให้ทำสิ่งเหล่านี้ไม่ได้:
--   * แจ้งเตือนผู้ปกครองเมื่อนักเรียนขาดเรียนหรือมีค่าใช้จ่ายค้าง
--   * ติดต่อฉุกเฉินตอนเกิดเหตุที่ห้องพยาบาล
--   * งานเยี่ยมบ้านของฝ่ายกิจการนักเรียน
--
-- แยกเป็นตารางไม่ใช่เพิ่มคอลัมน์ใน students เพราะนักเรียนหนึ่งคนมีผู้ปกครอง
-- ได้หลายคน (บิดา มารดา ผู้ปกครองตามกฎหมาย ญาติที่ติดต่อได้) และแต่ละคน
-- มีข้อมูลชุดเดียวกัน ถ้ายัดเป็นคอลัมน์จะกลายเป็น guardian1_*, guardian2_*
-- ซึ่งขยายต่อไม่ได้
--
-- ผูกด้วย `student_id` (text) ไม่ใช่ `students.id` เพราะ student_id คือกุญแจ
-- ที่ทุกตารางในระบบใช้อ้างนักเรียนอยู่แล้ว (attendance, entry_logs,
-- equipment_requests, name_change_requests ฯลฯ)
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guardians (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL,

  full_name text NOT NULL,
  -- ความสัมพันธ์กับนักเรียน ใช้ CHECK แทน enum ตามแบบเดิมของ schema นี้
  relationship text NOT NULL DEFAULT 'ผู้ปกครอง'::text
    CHECK (relationship = ANY (ARRAY['บิดา'::text, 'มารดา'::text, 'ผู้ปกครอง'::text, 'ญาติ'::text, 'อื่นๆ'::text])),
  phone text,
  phone_alt text,
  email text,
  line_user_id text,          -- เผื่อส่งแจ้งเตือนถึงผู้ปกครองผ่าน LINE ในอนาคต
  national_id text,
  occupation text,
  workplace text,
  income_range text,          -- ใช้ประกอบการพิจารณา กยศ. ในภายหลัง
  address text,

  -- ผู้ปกครองหลัก 1 คนต่อนักเรียน ใช้เป็นค่าตั้งต้นเวลาส่งแจ้งเตือน
  is_primary boolean NOT NULL DEFAULT false,
  -- ผู้ติดต่อฉุกเฉิน มีได้มากกว่า 1 คน และอาจไม่ใช่คนเดียวกับผู้ปกครองหลัก
  is_emergency_contact boolean NOT NULL DEFAULT false,

  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT guardians_pkey PRIMARY KEY (id),
  CONSTRAINT guardians_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS guardians_student_id_idx
  ON public.guardians (student_id);

-- ผู้ปกครองหลักได้คนเดียวต่อนักเรียน ใช้ partial unique index เพราะแถวที่
-- is_primary = false มีได้หลายแถว
CREATE UNIQUE INDEX IF NOT EXISTS guardians_one_primary_per_student
  ON public.guardians (student_id) WHERE is_primary = true;

-- ค้นผู้ติดต่อฉุกเฉินของนักเรียนคนหนึ่ง เป็น query ที่ห้องพยาบาลจะเรียกบ่อย
CREATE INDEX IF NOT EXISTS guardians_emergency_idx
  ON public.guardians (student_id) WHERE is_emergency_contact = true;

COMMENT ON TABLE public.guardians IS
  'ผู้ปกครองและผู้ติดต่อฉุกเฉินของนักเรียน หนึ่งคนมีได้หลายแถว';

-- ------------------------------------------------------------
-- SMOKE
--   -- ตารางต้องมีและว่าง
--   SELECT count(*) FROM public.guardians;
--
--   -- ต้องใส่ผู้ปกครองหลักซ้ำไม่ได้ (คำสั่งที่สองต้อง error 23505)
--   -- ทดสอบแล้วอย่าลืมลบทิ้ง
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.guardians;
