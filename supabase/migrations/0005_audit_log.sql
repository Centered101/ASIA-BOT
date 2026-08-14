-- ============================================================
-- 0005 — บันทึกการตรวจสอบ (audit log)
--
-- ทุกวันนี้มีแค่ login_logs / admin_logs (การพยายามล็อกอิน) และ agent_logs
-- (การเรียก AI) ไม่มีอะไรบันทึกว่าใครแก้อะไร การแก้ข้อมูลนักเรียน อนุมัติคำขอ
-- หรือเปลี่ยน role ไม่ทิ้งร่องรอยไว้เลย
--
-- roadmap ข้อ 26 บังคับให้ต้องมีก่อนจะมีระบบเกรด การเงิน และการอนุมัติ
-- จึงทำใน Phase 1 ไม่ใช่รอให้โมดูลเหล่านั้นสร้างเสร็จก่อน
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  -- ให้ NULL ได้: การใช้ทางลัด env-superadmin ไม่มีแถว account อยู่จริง
  -- และเรายอมบันทึกด้วย actor_label ดีกว่าทิ้งบันทึกนั้นไปเลย
  actor_account_id uuid,
  actor_label text,
  actor_role text,
  -- คำกริยาคั่นจุด เช่น 'product.create', 'student.update', 'role.grant'
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_account_id_fkey
    FOREIGN KEY (actor_account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL
);

-- สำหรับคำถาม "ขอดูประวัติของเรคอร์ดนี้"
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON public.audit_logs (entity_type, entity_id);

-- สำหรับคำถาม "ช่วงนี้มีอะไรเกิดขึ้นบ้าง" / "คนนี้ทำอะไรไปบ้าง"
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON public.audit_logs (actor_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON public.audit_logs (action, created_at DESC);

COMMENT ON TABLE public.audit_logs IS
  'Who changed what, when, with before/after. Written by withAuth() in src/lib/server/with-auth.ts.';

-- ตั้งใจ **ไม่** ใส่เข้า publication supabase_realtime เพราะแถว audit
-- อาจมีค่าเดิมของฟิลด์ที่อ่อนไหวอยู่ข้างใน

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.audit_logs;   -- expect 0
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'audit_logs';          -- expect 5 (pkey + 4)
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.audit_logs;
