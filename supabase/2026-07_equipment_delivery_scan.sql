-- เพิ่มฟิลด์ วิธีรับ-ส่ง / ช่วงเวลา / สถานะ "รับของแล้ว" (สแกนบัตร) ให้ equipment_requests
-- Migration นี้เป็นแบบ additive (ไม่ DROP ตารางเดิม) รันซ้ำได้อย่างปลอดภัย

ALTER TABLE public.equipment_requests
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_loc text,
  ADD COLUMN IF NOT EXISTS time_slot text,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamp with time zone;

ALTER TABLE public.equipment_requests
  DROP CONSTRAINT IF EXISTS equipment_requests_delivery_mode_check;
ALTER TABLE public.equipment_requests
  ADD CONSTRAINT equipment_requests_delivery_mode_check
  CHECK (delivery_mode = ANY (ARRAY['pickup'::text, 'delivery'::text]));

-- เพิ่มสถานะ 'picked_up' (รับของแล้ว รอคืน) ต่อจาก approved ก่อน returned
ALTER TABLE public.equipment_requests
  DROP CONSTRAINT IF EXISTS equipment_requests_status_check;
ALTER TABLE public.equipment_requests
  ADD CONSTRAINT equipment_requests_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'picked_up'::text, 'rejected'::text, 'cancelled'::text, 'returned'::text]));
