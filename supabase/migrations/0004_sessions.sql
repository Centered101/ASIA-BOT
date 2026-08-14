-- ============================================================
-- 0004 — session ฝั่งเซิร์ฟเวอร์
--
-- ทุกวันนี้ auth ของแอดมินคือ header `x-admin-id` เฉย ๆ นั่นคือ header
-- **เป็นตัว credential เอง** (src/lib/admin-auth.ts) ใครรู้ admin_id ก็ได้สิทธิ์
-- ของแอดมินคนนั้น ไม่มี token ไม่มีลายเซ็น ไม่มีวันหมดอายุ และเพิกถอนไม่ได้
-- ส่วน "session" ของนักเรียนคือ JSON ที่ไม่ได้เซ็นใน localStorage
--
-- ตารางนี้รองรับ cookie ที่เซ็นและมีวันหมดอายุ เก็บเฉพาะค่า SHA-256 ของ token
-- ไม่ได้เก็บตัว token ดังนั้นถ้าฐานข้อมูลรั่วก็ไม่ได้ยก session ที่ยังใช้ได้ให้ไป
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  -- ค่า SHA-256 ของ token ห้ามเก็บตัว token เอง
  token_hash text NOT NULL,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  ip_address text,
  user_agent text,
  CONSTRAINT auth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_sessions_token_hash_key UNIQUE (token_hash),
  CONSTRAINT auth_sessions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS auth_sessions_account_id_idx ON public.auth_sessions (account_id);

-- เส้นทางค้นสำหรับคำถาม "session นี้ยังใช้ได้ไหม" ใช้ partial index
-- เพื่อให้ index ไม่บวมตามจำนวนแถวที่ถูกเพิกถอนไปแล้ว
CREATE INDEX IF NOT EXISTS auth_sessions_active_idx
  ON public.auth_sessions (expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE public.auth_sessions IS
  'Signed session tokens (SHA-256 hashed). Backs the httpOnly session cookie introduced in Phase 1.';

-- ------------------------------------------------------------
-- SMOKE
--   SELECT count(*) FROM public.auth_sessions;   -- expect 0
--
-- งานดูแลรักษา (รันเป็นระยะ ไม่ใช่ส่วนหนึ่งของ migration นี้):
--   DELETE FROM public.auth_sessions
--    WHERE expires_at < now() - interval '30 days';
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.auth_sessions;
