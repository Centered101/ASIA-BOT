-- ============================================================
-- 0025 — รหัสยืนยันสำหรับผูกบัญชี LINE (ใช้ครั้งเดียว มีอายุ)
--
-- ของเดิม webhook ผูกบัญชีให้ทันทีเมื่อมีคนพิมพ์ "รหัสนักเรียน" เข้ามาในแชท
-- ซึ่งไม่ได้ยืนยันอะไรเลยนอกจากตัวรหัส — รหัสนักเรียนพิมพ์อยู่บนบัตร และใช้เป็น
-- username ตอนล็อกอินด้วย ไม่ใช่ความลับ ใครรู้รหัสของคนอื่นจึงผูก LINE ตัวเอง
-- เข้ากับนักเรียนคนนั้นได้ แล้วรับแจ้งเตือนส่วนตัวกับถาม AI แทนเขาได้ทั้งหมด
--
-- ตารางนี้เปลี่ยนให้ "สิ่งที่พิมพ์เข้าแชท" เป็นรหัส 6 หลักที่ออกให้เฉพาะคนที่
-- ล็อกอินเว็บสำเร็จแล้วเท่านั้น ใช้ได้ครั้งเดียวและหมดอายุใน 10 นาที
-- ============================================================

CREATE TABLE IF NOT EXISTS public.line_link_codes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  used_by_line_user_id text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT line_link_codes_pkey PRIMARY KEY (id)
);

-- ค้นด้วยรหัสตอน webhook เข้ามา จึงต้องเร็วและกันรหัสซ้ำที่ยังไม่ถูกใช้
CREATE INDEX IF NOT EXISTS line_link_codes_code_idx
  ON public.line_link_codes (code);

CREATE INDEX IF NOT EXISTS line_link_codes_student_idx
  ON public.line_link_codes (student_id);

-- กันออกรหัสค้างไว้หลายใบพร้อมกันต่อคน: ยกเลิกใบเก่าก่อนออกใบใหม่เสมอ
-- (ทำในโค้ดที่ /api/student/line-link/code ไม่ได้บังคับที่ระดับ DB
--  เพราะ partial unique index บน "ยังไม่ถูกใช้และยังไม่หมดอายุ" ต้องใช้
--  now() ซึ่งไม่ IMMUTABLE จึงสร้าง index แบบนั้นไม่ได้)

ALTER TABLE public.line_link_codes ENABLE ROW LEVEL SECURITY;

-- ไม่มี policy โดยตั้งใจ — ตารางนี้แตะผ่าน service role ฝั่ง server เท่านั้น
-- ไม่ควรมี client ตัวไหนอ่านรหัสของคนอื่นได้

-- smoke query: ต้องได้ 0 แถว และไม่ error
-- SELECT count(*) FROM public.line_link_codes;

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.line_link_codes;
