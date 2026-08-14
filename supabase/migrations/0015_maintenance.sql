-- ============================================================
-- 0015 — ระบบแจ้งซ่อม อาคารสถานที่ เครื่องมือ อุปกรณ์
--
-- โจทย์ที่ยากที่สุดของโมดูลนี้คือ "แจ้งซ่อมได้ทั้งของที่มีเลขครุภัณฑ์และไม่มี"
-- ถ้าบังคับให้ทุกคำขอต้องผูกกับ assets.id ก็จะแจ้ง "โต๊ะตัวที่สามในห้อง 302
-- ขาหัก" ไม่ได้ แต่ถ้าปล่อยให้พิมพ์ชื่อเอาเองทั้งหมด ประวัติซ่อมก็จะไม่เกาะ
-- กับครุภัณฑ์ชิ้นไหนเลย และตอบไม่ได้ว่าแอร์เครื่องนี้ซ่อมมากี่รอบแล้ว
--
-- ทางออกคือ target_kind + FK ทางเลือกสามตัว + target_label:
--   asset          -> ผูกกับครุภัณฑ์รายชิ้น ประวัติซ่อมเกาะที่ชิ้นนั้น
--   equipment_item -> ผูกกับคลังของยืม
--   room           -> ของติดอาคาร เช่น ไฟ ประปา แอร์ ที่ไม่ได้ลงครุภัณฑ์
--   other          -> พิมพ์เอง ต้องมี target_label (มี CHECK บังคับ)
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_code text NOT NULL,

  -- --- ผู้แจ้ง ---
  -- เก็บทั้งสองฝั่งเพราะทั้งนักเรียนและเจ้าหน้าที่แจ้งได้ และบางครั้งเป็นการ
  -- แจ้งแทนคนอื่น จึงต้องมีชื่อเป็น text ไม่ใช่พึ่ง FK อย่างเดียว
  reporter_name text NOT NULL,
  reporter_student_id text,
  reporter_admin_id text,
  reporter_phone text,

  -- --- สิ่งที่แจ้งซ่อม ---
  target_kind text NOT NULL DEFAULT 'other'::text CHECK (target_kind = ANY (ARRAY[
    'asset'::text, 'equipment_item'::text, 'room'::text, 'other'::text
  ])),
  asset_id uuid,
  equipment_item_id uuid,
  room_id uuid,
  target_label text,            -- ชื่อที่พิมพ์เอง เมื่อไม่มีเลขครุภัณฑ์
  location_note text,           -- "ห้อง 302 มุมซ้ายติดหน้าต่าง"

  -- จำนวนที่เสีย ใช้เฉพาะกับ target_kind = 'equipment_item' ซึ่งเป็นคลังที่
  -- นับเป็นจำนวน ("หูฟัง 3 อันจาก 20 พัง") ของรายชิ้นอย่าง asset/room
  -- ไม่ต้องใช้เพราะมีชิ้นเดียวอยู่แล้ว
  --
  -- ตั้งใจ **ไม่** ไปลด equipment_items.available_quantity ตรง ๆ เพราะคอลัมน์นั้น
  -- ถูก flow อนุมัติ/ปฏิเสธคำขอเบิกเขียนอยู่แล้ว ถ้าเขียนสองทางจะแย่งกันและ
  -- ยอดจะเพี้ยนเมื่อมีคำขอซ้อนกัน จำนวนที่ติดซ่อมจึงคำนวณจากตารางนี้แทน
  -- ดู equipmentUnderRepair() ใน src/lib/server/maintenance-stock.ts
  affected_quantity integer CHECK (affected_quantity IS NULL OR affected_quantity > 0),

  category text NOT NULL DEFAULT 'อื่นๆ'::text CHECK (category = ANY (ARRAY[
    'ไฟฟ้า'::text, 'ประปา'::text, 'แอร์'::text, 'โครงสร้าง'::text,
    'เฟอร์นิเจอร์'::text, 'อุปกรณ์'::text, 'คอมพิวเตอร์'::text, 'อื่นๆ'::text
  ])),
  symptom text NOT NULL,        -- อาการเสีย
  urgency text NOT NULL DEFAULT 'normal'::text CHECK (urgency = ANY (ARRAY[
    'low'::text, 'normal'::text, 'high'::text, 'critical'::text
  ])),

  -- --- ขั้นตอนการซ่อม ---
  status text NOT NULL DEFAULT 'reported'::text CHECK (status = ANY (ARRAY[
    'reported'::text,           -- แจ้งเข้ามา
    'received'::text,           -- รับเรื่องแล้ว
    'inspecting'::text,         -- กำลังตรวจสอบ
    'assigned'::text,           -- มอบหมายช่างแล้ว
    'repairing'::text,          -- กำลังซ่อม
    'waiting_inspection'::text, -- ซ่อมเสร็จ รอตรวจรับ
    'completed'::text,          -- ตรวจรับแล้ว
    'cancelled'::text           -- ยกเลิก
  ])),
  assigned_to text,
  scheduled_on date,
  cost numeric CHECK (cost IS NULL OR cost >= 0),
  parts_note text,              -- อะไหล่ที่ใช้
  completed_at timestamp with time zone,
  completion_note text,
  admin_note text,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT maintenance_requests_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_requests_asset_fkey
    FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL,
  CONSTRAINT maintenance_requests_equipment_fkey
    FOREIGN KEY (equipment_item_id) REFERENCES public.equipment_items(id) ON DELETE SET NULL,
  CONSTRAINT maintenance_requests_room_fkey
    FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL,

  -- กันคำขอที่ระบุไม่ได้ว่าซ่อมอะไร ถ้าเลือก kind ไหนต้องมีตัวชี้ของ kind นั้น
  -- ไม่งั้นจะได้คำขอที่ช่างอ่านแล้วไม่รู้ว่าต้องไปดูตรงไหน
  CONSTRAINT maintenance_requests_target_present CHECK (
    (target_kind = 'asset'          AND asset_id IS NOT NULL) OR
    (target_kind = 'equipment_item' AND equipment_item_id IS NOT NULL) OR
    (target_kind = 'room'           AND room_id IS NOT NULL) OR
    (target_kind = 'other'          AND target_label IS NOT NULL AND btrim(target_label) <> '')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS maintenance_requests_code_key
  ON public.maintenance_requests (request_code);

-- คิวงานของฝ่ายอาคาร เรียงตามความเร่งด่วนแล้วตามเวลาที่แจ้ง
CREATE INDEX IF NOT EXISTS maintenance_requests_queue_idx
  ON public.maintenance_requests (status, urgency, created_at DESC);

-- "แอร์เครื่องนี้ซ่อมมากี่รอบแล้ว" — ประวัติซ่อมของครุภัณฑ์ชิ้นหนึ่ง
CREATE INDEX IF NOT EXISTS maintenance_requests_asset_idx
  ON public.maintenance_requests (asset_id, created_at DESC) WHERE asset_id IS NOT NULL;

-- "อุปกรณ์ชิ้นนี้ติดซ่อมอยู่กี่อัน" — ถูกเรียกทุกครั้งที่แสดงคลังให้ยืม
-- จึงเป็น partial index เฉพาะงานที่ยังไม่ปิด
CREATE INDEX IF NOT EXISTS maintenance_requests_equipment_open_idx
  ON public.maintenance_requests (equipment_item_id)
  WHERE equipment_item_id IS NOT NULL AND status NOT IN ('completed', 'cancelled');

-- "ฉันแจ้งอะไรไปบ้าง" ฝั่งนักเรียน
CREATE INDEX IF NOT EXISTS maintenance_requests_reporter_idx
  ON public.maintenance_requests (reporter_student_id, created_at DESC)
  WHERE reporter_student_id IS NOT NULL;

COMMENT ON TABLE public.maintenance_requests IS
  'คำขอแจ้งซ่อม รองรับทั้งของที่มีเลขครุภัณฑ์ (asset_id) และไม่มี (target_label)';


-- --- รูปก่อน / ระหว่าง / หลังซ่อม ---------------------------
-- แยกตารางแทนที่จะเป็น text[] สามคอลัมน์ เพราะรูปพวกนี้เป็นหลักฐานการซ่อม
-- ต้องรู้ว่าใครถ่ายและถ่ายเมื่อไหร่ ซึ่ง array เก็บไม่ได้
CREATE TABLE IF NOT EXISTS public.maintenance_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  phase text NOT NULL CHECK (phase = ANY (ARRAY['before'::text, 'during'::text, 'after'::text])),
  image_url text NOT NULL,
  caption text,
  uploaded_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT maintenance_photos_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_photos_request_fkey
    FOREIGN KEY (request_id) REFERENCES public.maintenance_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS maintenance_photos_request_idx
  ON public.maintenance_photos (request_id, phase, created_at);

COMMENT ON TABLE public.maintenance_photos IS
  'รูปหลักฐานการซ่อม 3 ระยะ before/during/after';


-- --- ไทม์ไลน์การเปลี่ยนสถานะ --------------------------------
-- append-only เหมือน student_status_changes: maintenance_requests.status
-- บอกได้แค่ว่าตอนนี้อยู่ขั้นไหน แต่การตรวจสอบย้อนหลังต้องรู้ว่าใครเลื่อน
-- ขั้นไหนเมื่อไหร่ โดยเฉพาะช่วง waiting_inspection -> completed ที่มีค่าใช้จ่าย
CREATE TABLE IF NOT EXISTS public.maintenance_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT maintenance_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_status_history_request_fkey
    FOREIGN KEY (request_id) REFERENCES public.maintenance_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS maintenance_status_history_request_idx
  ON public.maintenance_status_history (request_id, created_at);

COMMENT ON TABLE public.maintenance_status_history IS
  'ไทม์ไลน์การเลื่อนสถานะงานซ่อม append-only';

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.maintenance_requests;
--
--   -- CHECK ต้องกันคำขอที่ระบุของไม่ได้ (คำสั่งนี้ต้อง error 23514)
--   INSERT INTO public.maintenance_requests (request_code, reporter_name, symptom, target_kind)
--   VALUES ('TEST-1', 'ทดสอบ', 'ทดสอบ', 'other');
--
--   -- แบบนี้ต้องผ่าน เพราะมี target_label
--   INSERT INTO public.maintenance_requests (request_code, reporter_name, symptom, target_kind, target_label)
--   VALUES ('TEST-2', 'ทดสอบ', 'ขาหัก', 'other', 'โต๊ะตัวที่สาม ห้อง 302');
--   DELETE FROM public.maintenance_requests WHERE request_code LIKE 'TEST-%';
--
--   -- คิวงานที่ค้างอยู่
--   SELECT status, urgency, count(*) FROM public.maintenance_requests
--    WHERE status NOT IN ('completed','cancelled') GROUP BY 1,2 ORDER BY 1,2;
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.maintenance_status_history;
--   DROP TABLE IF EXISTS public.maintenance_photos;
--   DROP TABLE IF EXISTS public.maintenance_requests;
