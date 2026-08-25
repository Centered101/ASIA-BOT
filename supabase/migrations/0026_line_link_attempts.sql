-- ============================================================
-- 0026 — สถานะการเชื่อมบัญชี LINE ที่ค้างอยู่ระหว่างทาง + กันเดาเบอร์
--
-- 0025 เปิดทางเชื่อมด้วยรหัส 6 หลักจากเว็บ ซึ่งปลอดภัยที่สุดแต่ต้องล็อกอินเว็บก่อน
-- นักเรียนที่เปิดเว็บไม่ได้ตอนนั้นจึงเชื่อมไม่ได้เลย ตารางนี้เปิดทางที่สองคือ
-- พิมพ์รหัสนักเรียนแล้วยืนยันด้วย "เบอร์โทรที่แจ้งไว้กับโรงเรียน"
--
-- ต้องมีตารางเพราะการยืนยันเป็นสองจังหวะ (ส่งรหัสนักเรียน → บอทถามเบอร์ →
-- ส่งเบอร์) จึงต้องจำไว้ว่า LINE คนนี้กำลังยืนยันรหัสไหนอยู่ และเก็บจำนวนครั้ง
-- ที่กรอกเบอร์ผิดไว้ด้วย ไม่งั้นเดาเบอร์ทีละครั้งไปเรื่อย ๆ ได้ไม่จำกัด
-- ============================================================

CREATE TABLE IF NOT EXISTS public.line_link_attempts (
  line_user_id text NOT NULL,
  student_id text NOT NULL,
  failed_count integer NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  blocked_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT line_link_attempts_pkey PRIMARY KEY (line_user_id)
);

-- PK เป็น line_user_id ตัวเดียวโดยตั้งใจ — หนึ่งบัญชี LINE ยืนยันได้ทีละรหัส
-- เท่านั้น พิมพ์รหัสใหม่เข้ามาก็ทับของเดิม จะได้ไม่มีคิวค้างหลายอันพร้อมกัน

CREATE INDEX IF NOT EXISTS line_link_attempts_student_idx
  ON public.line_link_attempts (student_id);

ALTER TABLE public.line_link_attempts ENABLE ROW LEVEL SECURITY;

-- ไม่มี policy โดยตั้งใจ — แตะผ่าน service role ฝั่ง server เท่านั้น

-- smoke query: ต้องได้ 0 แถว และไม่ error
-- SELECT count(*) FROM public.line_link_attempts;

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.line_link_attempts;
