-- ============================================================
-- 0024 — สิทธิ์ดูประวัติการคุยกับผู้ช่วย AI
--
-- agent_logs กับ agent_conversations มีมาตั้งแต่ตอนทำบอท และบันทึกทุกเทิร์น
-- มาตลอด แต่ไม่มีหน้าไหนในระบบเปิดดูเลย เวลามีคนบอกว่า "ถามบอทแล้วมันตอบผิด"
-- จึงไม่มีทางตามดูว่าเกิดอะไรขึ้น ต้องเดาจากคำบอกเล่าอย่างเดียว
--
-- เนื้อหาในนั้นเป็นบทสนทนาส่วนตัวของนักเรียน (ถามเรื่องเกรด เรื่องเงิน
-- เรื่องปัญหาส่วนตัว) จึงไม่แจกตามฝ่ายเหมือน dashboard.view — ให้เฉพาะ ADMIN
-- ส่วน SUPER_ADMIN ใช้ wildcard '*' ในโค้ดอยู่แล้ว ไม่ต้องระบุที่นี่ (เหมือน 0003)
--
-- ต้องตรงกับ src/lib/rbac/definitions.ts เวลาเพิ่มให้แก้ทั้งสองที่
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

INSERT INTO public.permissions (key, label, module) VALUES
  ('agent.view_logs', 'ดูประวัติการคุยกับ AI', 'agent')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'ADMIN', 'agent.view_logs'
ON CONFLICT DO NOTHING;

-- --- ค้นประวัติให้เร็ว ----------------------------------------
-- หน้าใหม่เรียงใหม่ไปเก่าเสมอ และกรองด้วย user_id เวลาตามเรื่องของคนคนเดียว
CREATE INDEX IF NOT EXISTS agent_logs_recent_idx
  ON public.agent_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS agent_logs_user_idx
  ON public.agent_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- เรื่องที่ตามบ่อยที่สุดคือ "เทิร์นไหนพัง" ซึ่งเป็นส่วนน้อยของแถวทั้งหมด
CREATE INDEX IF NOT EXISTS agent_logs_error_idx
  ON public.agent_logs (created_at DESC)
  WHERE error IS NOT NULL;

-- ------------------------------------------------------------
-- SMOKE
--   -- ต้องได้ 1 แถว
--   SELECT * FROM public.permissions WHERE key = 'agent.view_logs';
--
--   -- ADMIN ต้องมี ส่วน ACADEMIC/REGISTRAR ต้องไม่มี
--   SELECT role_key FROM public.role_permissions
--    WHERE permission_key = 'agent.view_logs' ORDER BY 1;
--
--   -- index ครบ 3 ตัว
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'agent_logs' AND indexname LIKE 'agent_logs_%_idx'
--    ORDER BY 1;
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP INDEX IF EXISTS public.agent_logs_error_idx;
--   DROP INDEX IF EXISTS public.agent_logs_user_idx;
--   DROP INDEX IF EXISTS public.agent_logs_recent_idx;
--   DELETE FROM public.role_permissions WHERE permission_key = 'agent.view_logs';
--   DELETE FROM public.permissions WHERE key = 'agent.view_logs';
