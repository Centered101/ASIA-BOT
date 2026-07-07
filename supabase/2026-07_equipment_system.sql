-- ระบบเบิก-ยืมคุรุภัณฑ์ (Equipment Borrow/Return System)
-- รันสคริปต์นี้ใน Supabase SQL Editor เพื่อสร้างตารางที่จำเป็น
-- สคริปต์นี้รันซ้ำได้อย่างปลอดภัย (DROP ... IF EXISTS ก่อนสร้างใหม่ทุกครั้ง)

DROP TABLE IF EXISTS public.equipment_requests CASCADE;
DROP TABLE IF EXISTS public.equipment_items CASCADE;

CREATE TABLE public.equipment_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_code text,
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'ชิ้น',
  total_quantity integer NOT NULL DEFAULT 1 CHECK (total_quantity >= 0),
  available_quantity integer NOT NULL DEFAULT 1 CHECK (available_quantity >= 0),
  image_url text,
  description text,
  active boolean NOT NULL DEFAULT true,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT equipment_items_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_items_category ON public.equipment_items (category);

CREATE TABLE public.equipment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_code text NOT NULL,
  equipment_item_id uuid NOT NULL REFERENCES public.equipment_items(id),
  student_id text,
  department text NOT NULL,
  requester_name text NOT NULL,
  requester_phone text,
  quantity integer NOT NULL CHECK (quantity > 0),
  purpose text,
  borrow_date date NOT NULL,
  due_date date NOT NULL,
  returned_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'returned'::text])),
  admin_note text,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT equipment_requests_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_requests_status ON public.equipment_requests (status);
CREATE INDEX IF NOT EXISTS idx_equipment_requests_department ON public.equipment_requests (department);
CREATE INDEX IF NOT EXISTS idx_equipment_requests_item ON public.equipment_requests (equipment_item_id);
CREATE INDEX IF NOT EXISTS idx_equipment_requests_student ON public.equipment_requests (student_id);
