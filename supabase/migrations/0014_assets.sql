-- ============================================================
-- 0014 — ทะเบียนครุภัณฑ์รายชิ้น และประวัติการย้าย
--
-- ทำไมไม่ใช้ equipment_items ที่มีอยู่แล้ว
-- equipment_items คือ "ของที่ยืมได้ นับเป็นจำนวน" — หูฟัง 20 อันคือ 1 แถว
-- ที่ total_quantity = 20 ส่วนครุภัณฑ์คือ "ของรายชิ้นที่ติดตามแยกกัน" —
-- หูฟังตัวที่ 7 มีเลขครุภัณฑ์ของตัวเอง มีประวัติซ่อมของตัวเอง และจำหน่ายแยกได้
--
-- ถ้ายัดรวมกัน จะบอกไม่ได้ว่าเครื่องไหนพัง และประวัติซ่อมจะไปเกาะกับ "กอง"
-- ไม่ใช่ "ชิ้น" คอลัมน์ equipment_item_id จึงมีไว้เชื่อมกลับ เมื่อครุภัณฑ์
-- ชิ้นนั้นเป็นส่วนหนึ่งของคลังยืมด้วย
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- เลขครุภัณฑ์ NULL ได้ และห้ามซ้ำเฉพาะเมื่อมีค่า (ดู partial index ด้านล่าง)
  -- นี่คือคำตอบของโจทย์ "รองรับทั้งที่มีและไม่มีเลขครุภัณฑ์" ของที่ยังไม่ได้
  -- ลงเลขก็บันทึกได้ ไม่ต้องปลอมเลขขึ้นมาให้เสียความหมาย
  asset_code text,
  serial_number text,

  name text NOT NULL,
  category text NOT NULL,
  brand text,
  model text,

  -- ที่อยู่ปัจจุบัน ประวัติการย้ายอยู่ในตาราง asset_movements
  room_id uuid,
  location_note text,
  responsible_person text,
  department text,

  acquired_on date,
  price numeric CHECK (price IS NULL OR price >= 0),
  funding_source text,          -- งบประมาณ/บริจาค/เงินรายได้

  condition text NOT NULL DEFAULT 'good'::text CHECK (condition = ANY (ARRAY[
    'new'::text, 'good'::text, 'fair'::text, 'poor'::text, 'broken'::text
  ])),
  status text NOT NULL DEFAULT 'in_use'::text CHECK (status = ANY (ARRAY[
    'in_use'::text, 'in_storage'::text, 'under_repair'::text,
    'disposed'::text, 'lost'::text
  ])),

  -- ใช้สร้าง QR ติดตัวครุภัณฑ์ แยกจาก id เพื่อให้เปลี่ยนได้ถ้าสติกเกอร์หลุด
  -- ไปอยู่ผิดชิ้น โดยไม่ต้องแตะ primary key ที่ตารางอื่นอ้างอยู่
  qr_token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),

  image_urls text[],
  equipment_item_id uuid,       -- เชื่อมกลับคลังยืม ถ้าชิ้นนี้อยู่ในคลังด้วย
  note text,

  -- จำหน่ายออกจากทะเบียน ไม่ลบแถวทิ้ง เพราะประวัติซ่อมและงบที่ใช้ไปยังต้องสืบได้
  disposed_at timestamp with time zone,
  disposed_reason text,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_room_id_fkey
    FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL,
  CONSTRAINT assets_equipment_item_id_fkey
    FOREIGN KEY (equipment_item_id) REFERENCES public.equipment_items(id) ON DELETE SET NULL
);

-- ห้ามเลขครุภัณฑ์ซ้ำ แต่ยอมให้ NULL ซ้ำได้ไม่จำกัด
CREATE UNIQUE INDEX IF NOT EXISTS assets_asset_code_key
  ON public.assets (asset_code) WHERE asset_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assets_qr_token_key
  ON public.assets (qr_token);

CREATE UNIQUE INDEX IF NOT EXISTS assets_serial_number_key
  ON public.assets (serial_number) WHERE serial_number IS NOT NULL;

-- ค้นทะเบียนตามหมวดและสถานะ เป็นตัวกรองหลักของหน้าครุภัณฑ์
CREATE INDEX IF NOT EXISTS assets_category_status_idx
  ON public.assets (category, status);

-- "ห้องนี้มีครุภัณฑ์อะไรบ้าง" — คำถามที่หน้าแจ้งซ่อมและแผนที่โรงเรียนจะถาม
CREATE INDEX IF NOT EXISTS assets_room_idx
  ON public.assets (room_id) WHERE room_id IS NOT NULL;

-- รายการที่ยังไม่ได้ลงเลขครุภัณฑ์ งานค้างที่ฝ่ายพัสดุต้องตามเก็บ
CREATE INDEX IF NOT EXISTS assets_missing_code_idx
  ON public.assets (created_at DESC) WHERE asset_code IS NULL AND disposed_at IS NULL;

COMMENT ON TABLE public.assets IS
  'ครุภัณฑ์รายชิ้น ต่างจาก equipment_items ที่เป็นคลังของยืมแบบนับจำนวน asset_code เป็น NULL ได้';


-- --- ประวัติการย้าย / เปลี่ยนผู้รับผิดชอบ -------------------
-- assets.room_id กับ responsible_person เก็บได้แค่ค่าปัจจุบัน เหตุผลเดียวกับ
-- student_status_changes ใน 0012: ถ้าของถูกย้ายสามรอบ คอลัมน์นั้นเหลือแค่
-- รอบสุดท้าย แต่ฝ่ายพัสดุต้องตอบได้ว่าปีที่แล้วของอยู่ที่ไหน
CREATE TABLE IF NOT EXISTS public.asset_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL,

  from_room_id uuid,
  to_room_id uuid,
  from_location text,
  to_location text,
  from_person text,
  to_person text,

  moved_on date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  recorded_by text,

  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT asset_movements_pkey PRIMARY KEY (id),
  CONSTRAINT asset_movements_asset_id_fkey
    FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  CONSTRAINT asset_movements_from_room_fkey
    FOREIGN KEY (from_room_id) REFERENCES public.rooms(id) ON DELETE SET NULL,
  CONSTRAINT asset_movements_to_room_fkey
    FOREIGN KEY (to_room_id) REFERENCES public.rooms(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS asset_movements_asset_idx
  ON public.asset_movements (asset_id, moved_on DESC);

COMMENT ON TABLE public.asset_movements IS
  'ประวัติการย้ายครุภัณฑ์ append-only ห้าม UPDATE ทับ';

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.assets;
--   SELECT count(*) FROM public.asset_movements;
--
--   -- เลขครุภัณฑ์ต้องห้ามซ้ำ แต่ NULL ซ้ำได้ (สองคำสั่งแรกต้องผ่าน
--   -- คำสั่งที่สามต้อง error 23505) — ทดสอบแล้วอย่าลืมลบทิ้ง
--   INSERT INTO public.assets (name, category) VALUES ('ทดสอบ1', 'ทดสอบ');
--   INSERT INTO public.assets (name, category) VALUES ('ทดสอบ2', 'ทดสอบ');
--   INSERT INTO public.assets (name, category, asset_code) VALUES ('ก', 'ทดสอบ', 'X-1');
--   INSERT INTO public.assets (name, category, asset_code) VALUES ('ข', 'ทดสอบ', 'X-1');
--   DELETE FROM public.assets WHERE category = 'ทดสอบ';
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.asset_movements;
--   DROP TABLE IF EXISTS public.assets;
