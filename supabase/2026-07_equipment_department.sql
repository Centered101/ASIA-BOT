-- เพิ่มฟิลด์ "สาขา" ให้คุรุภัณฑ์ เพื่อกรองว่าเครื่องมือเป็นของสาขาไหน (null = ใช้ได้ทุกสาขา)
-- Migration แบบ additive รันซ้ำได้อย่างปลอดภัย

ALTER TABLE public.equipment_items
  ADD COLUMN IF NOT EXISTS department text;

CREATE INDEX IF NOT EXISTS idx_equipment_items_department ON public.equipment_items (department);
