-- ============================================================
-- 0023 — ศูนย์เอกสาร: แฟ้มเอกสารของนักเรียน และคำขอเอกสาร
--
-- ตอบ roadmap ข้อ 20 สองส่วนที่ต่างกันจริง ไม่ใช่เรื่องเดียวกัน:
--
--   student_documents = ไฟล์ที่ "แนบเข้าแฟ้ม" — บัตรประชาชน ทะเบียนบ้าน ปพ.
--     ใบจบ ของที่นักเรียนส่งให้โรงเรียนเก็บ มีสถานะการตรวจ
--
--   document_requests = คำขอ "ให้โรงเรียนออกเอกสารให้" — ใบรับรอง Transcript
--     ใบรับรองความประพฤติ เป็น workflow ที่จบด้วยการรับของ
--
-- ถ้ายัดรวมกันเป็นตารางเดียวจะได้แถวที่ครึ่งหนึ่งของคอลัมน์ว่างเสมอ และ
-- สถานะจะปนกันจนอ่านไม่ออกว่า "approved" แปลว่าตรวจเอกสารผ่าน หรือ
-- อนุมัติให้ออกเอกสาร
--
-- สถานะของ student_documents ตรงกับที่ roadmap ข้อ 6 ระบุ:
--   pending → reviewing → approved | rejected | revision_required
--
-- สถานะของ document_requests ตรงกับ roadmap ข้อ 20:
--   pending → reviewing → approved → processing → ready → completed (+ rejected)
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

-- --- ประเภทเอกสารที่ระบบรู้จัก --------------------------------
-- เป็นตารางไม่ใช่ CHECK เพราะฝ่ายทะเบียนต้องเพิ่มประเภทเองได้โดยไม่ต้อง
-- migrate และแต่ละประเภทมีกติกาต่างกัน (บางอย่างมีค่าธรรมเนียม บางอย่าง
-- นักเรียนขอเองไม่ได้)
CREATE TABLE IF NOT EXISTS public.document_types (
  key text NOT NULL,
  label text NOT NULL,
  -- 'upload' = นักเรียนส่งเข้าแฟ้ม, 'issue' = ขอให้โรงเรียนออกให้
  kind text NOT NULL CHECK (kind = ANY (ARRAY['upload'::text, 'issue'::text])),
  description text,
  -- ต้องมีในแฟ้มทุกคนไหม ใช้ทำรายการ "เอกสารที่ยังขาด"
  is_required boolean NOT NULL DEFAULT false,
  -- นักเรียนกดขอเองได้ไหม บางอย่างต้องให้ครูขอแทน
  student_can_request boolean NOT NULL DEFAULT true,
  fee numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT document_types_pkey PRIMARY KEY (key)
);

INSERT INTO public.document_types (key, label, kind, is_required, student_can_request, sort_order) VALUES
  ('id_card',        'สำเนาบัตรประชาชน',   'upload', true,  true, 10),
  ('house_reg',      'สำเนาทะเบียนบ้าน',    'upload', true,  true, 11),
  ('photo',          'รูปถ่าย',            'upload', true,  true, 12),
  ('prior_transcript','ใบ ปพ. จากที่เดิม',  'upload', true,  true, 13),
  ('graduation_cert','ใบจบการศึกษาเดิม',   'upload', true,  true, 14),
  ('guardian_id',    'สำเนาบัตรผู้ปกครอง',  'upload', false, true, 15),
  ('other_upload',   'เอกสารอื่น ๆ',        'upload', false, true, 19),
  ('study_cert',     'ใบรับรองการเป็นนักเรียน', 'issue', false, true, 20),
  ('transcript',     'Transcript',          'issue', false, true, 21),
  ('conduct_cert',   'ใบรับรองความประพฤติ',  'issue', false, true, 22),
  ('graduation',     'ใบจบการศึกษา',        'issue', false, false, 23),
  ('other_issue',    'เอกสารอื่น ๆ',        'issue', false, true, 29)
ON CONFLICT (key) DO NOTHING;

-- --- แฟ้มเอกสารของนักเรียน ------------------------------------
CREATE TABLE IF NOT EXISTS public.student_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  document_type text NOT NULL,
  file_url text NOT NULL,
  file_name text,
  note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'approved'::text,
                               'rejected'::text, 'revision_required'::text])),
  -- เหตุผลที่ตีกลับ นักเรียนต้องเห็นว่าต้องแก้อะไร ไม่ใช่แค่คำว่า "ไม่ผ่าน"
  review_note text,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  -- ใครอัปโหลด ตัวเองหรือเจ้าหน้าที่ เหตุผลเดียวกับ 0020
  source text NOT NULL DEFAULT 'student'
    CHECK (source = ANY (ARRAY['student'::text, 'staff'::text])),
  uploaded_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_documents_pkey PRIMARY KEY (id),
  CONSTRAINT student_documents_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT student_documents_document_type_fkey
    FOREIGN KEY (document_type) REFERENCES public.document_types(key) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS student_documents_student_idx
  ON public.student_documents (student_id, created_at DESC);
-- คิวงานของฝ่ายทะเบียน: ที่ยังไม่ตรวจ
CREATE INDEX IF NOT EXISTS student_documents_queue_idx
  ON public.student_documents (status, created_at)
  WHERE status IN ('pending', 'reviewing');

-- --- คำขอให้ออกเอกสาร -----------------------------------------
CREATE TABLE IF NOT EXISTS public.document_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_code text NOT NULL UNIQUE,
  student_id text NOT NULL,
  document_type text NOT NULL,
  copies integer NOT NULL DEFAULT 1 CHECK (copies > 0),
  purpose text,
  -- รับเองหรือให้ส่ง ใช้คำเดียวกับ orders/equipment_requests ที่มีอยู่แล้ว
  delivery_mode text NOT NULL DEFAULT 'pickup'
    CHECK (delivery_mode = ANY (ARRAY['pickup'::text, 'delivery'::text])),
  delivery_note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'approved'::text,
                               'processing'::text, 'ready'::text, 'completed'::text,
                               'rejected'::text])),
  fee numeric NOT NULL DEFAULT 0,
  paid_at timestamp with time zone,
  -- ไฟล์ที่ออกให้ ถ้าเป็นเอกสารดิจิทัล
  issued_file_url text,
  -- โค้ดสำหรับสแกนตรวจสอบว่าเอกสารจริง (roadmap ข้อ 20)
  verify_token text UNIQUE,
  admin_note text,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT document_requests_pkey PRIMARY KEY (id),
  CONSTRAINT document_requests_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE,
  CONSTRAINT document_requests_document_type_fkey
    FOREIGN KEY (document_type) REFERENCES public.document_types(key) ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS document_requests_student_idx
  ON public.document_requests (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS document_requests_queue_idx
  ON public.document_requests (status, created_at)
  WHERE status NOT IN ('completed', 'rejected');

-- --- ประวัติการเปลี่ยนสถานะ -----------------------------------
-- เหตุผลเดียวกับ maintenance_status_history: ต้องตอบได้ว่าใครอนุมัติเมื่อไหร่
-- คอลัมน์ reviewed_by เก็บได้แค่คนล่าสุด
CREATE TABLE IF NOT EXISTS public.document_request_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT document_request_history_pkey PRIMARY KEY (id),
  CONSTRAINT document_request_history_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.document_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS document_request_history_request_idx
  ON public.document_request_history (request_id, created_at);

-- --- สิทธิ์ ---------------------------------------------------
INSERT INTO public.permissions (key, label, module) VALUES
  ('document.view_own',    'ดูเอกสารของตัวเอง',      'document'),
  ('document.upload_own',  'ส่งเอกสารของตัวเอง',     'document'),
  ('document.request',     'ขอเอกสาร',              'document'),
  ('document.view_all',    'ดูเอกสารทุกคน',          'document'),
  ('document.review',      'ตรวจและอนุมัติเอกสาร',    'document'),
  ('document.issue',       'ออกเอกสาร',             'document')
ON CONFLICT (key) DO NOTHING;

-- นักเรียนจัดการของตัวเองได้ · REGISTRAR ตรวจและออกเอกสาร ·
-- ADMIN/SUPER_ADMIN ได้ทุกอย่างผ่าน '*' อยู่แล้ว
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT r, p FROM (VALUES
  ('STUDENT',   'document.view_own'),
  ('STUDENT',   'document.upload_own'),
  ('STUDENT',   'document.request'),
  ('ALUMNI',    'document.view_own'),
  ('ALUMNI',    'document.request'),
  ('REGISTRAR', 'document.view_all'),
  ('REGISTRAR', 'document.review'),
  ('REGISTRAR', 'document.issue'),
  -- ตั้งใจไม่ให้ ACADEMIC/ADVISOR เพราะ document.view_all แปลว่าเห็นเอกสาร
  -- ของนักเรียนทุกคนในโรงเรียน ครูที่ปรึกษาควรเห็นเฉพาะเด็กในที่ปรึกษา
  -- ซึ่งต้องใช้ scope (user_roles.scope_id) ที่ยังไม่ได้ต่อกับโมดูลนี้
  ('ADMIN',     'document.view_all'),
  ('ADMIN',     'document.review'),
  ('ADMIN',     'document.issue')
) AS t(r, p)
WHERE EXISTS (SELECT 1 FROM public.roles WHERE key = r)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.document_types;            -- 12
--   SELECT kind, count(*) FROM public.document_types GROUP BY 1;  -- upload 7, issue 5
--   SELECT count(*) FROM public.student_documents;         -- 0
--   SELECT count(*) FROM public.document_requests;         -- 0
--   SELECT count(*) FROM public.permissions WHERE module = 'document';  -- 6
--   SELECT role_key, count(*) FROM public.role_permissions
--    WHERE permission_key LIKE 'document.%' GROUP BY 1 ORDER BY 1;
-- ------------------------------------------------------------

-- ROLLBACK:
--   DELETE FROM public.role_permissions WHERE permission_key LIKE 'document.%';
--   DELETE FROM public.permissions WHERE module = 'document';
--   DROP TABLE IF EXISTS public.document_request_history;
--   DROP TABLE IF EXISTS public.document_requests;
--   DROP TABLE IF EXISTS public.student_documents;
--   DROP TABLE IF EXISTS public.document_types;
