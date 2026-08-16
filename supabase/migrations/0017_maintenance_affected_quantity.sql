-- ============================================================
-- 0017 — เพิ่ม affected_quantity ให้ maintenance_requests
--
-- ทำไมต้องมีไฟล์นี้ ทั้งที่คอลัมน์นี้เขียนอยู่ใน 0015 แล้ว
--
-- คอลัมน์ถูกเพิ่มเข้าไปใน 0015 **หลังจาก 0015 ถูกรันไปแล้ว** และ 0015 สร้าง
-- ตารางด้วย CREATE TABLE IF NOT EXISTS การรันซ้ำจึงข้ามทั้งบล็อกไปเลย
-- ไม่ได้เพิ่มคอลัมน์ให้ ผลคือหน้าแจ้งซ่อมพังด้วย
--   Could not find the 'affected_quantity' column of 'maintenance_requests'
--
-- นี่คือเหตุผลที่กฎ "ห้ามแก้ migration ที่ apply แล้ว" มีอยู่ — การแก้ไฟล์เก่า
-- ทำให้ฐานข้อมูลที่รันไปแล้วกับไฟล์ในโค้ดไม่ตรงกัน โดยไม่มีอะไรเตือน
--
-- ฐานข้อมูลที่เพิ่งสร้างใหม่จะได้คอลัมน์นี้จาก 0015 อยู่แล้ว ไฟล์นี้จึงไม่ทำอะไร
-- (ADD COLUMN IF NOT EXISTS) ส่วนฐานที่รัน 0015 เวอร์ชันเก่าไปแล้วจะได้คอลัมน์
-- ตรงนี้ ทั้งสองทางจบที่สภาพเดียวกัน
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

ALTER TABLE public.maintenance_requests
  ADD COLUMN IF NOT EXISTS affected_quantity integer;

-- CHECK แยกออกมา เพราะ ADD CONSTRAINT ไม่มี IF NOT EXISTS
-- ถ้าไม่มีการ์ด การรันรอบสองจะล้มทั้งไฟล์
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'maintenance_requests_affected_quantity_check'
  ) THEN
    ALTER TABLE public.maintenance_requests
      ADD CONSTRAINT maintenance_requests_affected_quantity_check
      CHECK (affected_quantity IS NULL OR affected_quantity > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.maintenance_requests.affected_quantity IS
  'จำนวนที่เสีย ใช้เฉพาะ target_kind = equipment_item ซึ่งเป็นคลังที่นับเป็นจำนวน';

-- index สำหรับ "อุปกรณ์ชิ้นนี้ติดซ่อมอยู่กี่อัน" ถูกเรียกทุกครั้งที่แสดงคลังให้ยืม
-- อยู่ใน 0015 อยู่แล้วแต่ใส่ซ้ำไว้เผื่อฐานที่รันเวอร์ชันเก่าไปก่อนหน้านั้น
CREATE INDEX IF NOT EXISTS maintenance_requests_equipment_open_idx
  ON public.maintenance_requests (equipment_item_id)
  WHERE equipment_item_id IS NOT NULL AND status NOT IN ('completed', 'cancelled');

-- ------------------------------------------------------------
-- SMOKE
--   -- ต้องเจอคอลัมน์
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'maintenance_requests' AND column_name = 'affected_quantity';
--
--   -- ต้องเจอ constraint
--   SELECT conname FROM pg_constraint
--    WHERE conname = 'maintenance_requests_affected_quantity_check';
--
--   -- ค่าติดลบต้องถูกปฏิเสธ (คำสั่งนี้ต้อง error 23514)
--   -- UPDATE public.maintenance_requests SET affected_quantity = 0 WHERE true;
-- ------------------------------------------------------------

-- ROLLBACK:
--   ALTER TABLE public.maintenance_requests
--     DROP CONSTRAINT IF EXISTS maintenance_requests_affected_quantity_check;
--   ALTER TABLE public.maintenance_requests DROP COLUMN IF EXISTS affected_quantity;
