-- ============================================================
-- 0021 — ติดป้ายตารางที่เลิกใช้เพิ่มอีกสองกลุ่ม (COMMENT เท่านั้น ไม่ลบอะไร)
--
-- ทำต่อจาก 0007 ซึ่งติดป้ายให้ feedbacks / room_bookings /
-- teacher_applications ไว้แล้ว รอบนี้เพิ่มสองเรื่องที่เพิ่งชัดขึ้น
--
-- ── 1. student_positions ────────────────────────────────────
-- "ตำแหน่งในโรงเรียน" ย้ายไปอ่านจาก user_roles แล้ว เพราะตำแหน่งที่ไม่มีผล
-- กับสิ่งที่ทำได้จริงคือข้อความประดับ ไม่ใช่ตำแหน่ง — การเก็บไว้สองที่แปลว่า
-- วันหนึ่งจะเจอแฟ้มเขียนว่า "ประธานนักเรียน" แต่ระบบไม่ให้สิทธิ์อะไรเลย
-- ตารางนี้ไม่มีแถวเลยตั้งแต่สร้าง และ endpoint ที่เคยเขียนถูกถอดออกแล้ว
--
-- ── 2. permissions / role_permissions ───────────────────────
-- สองตารางนี้ถูก seed ไว้ตั้งแต่ 0003 (55 และ 183 แถว) แต่ **แอปไม่เคยอ่าน**
-- permissionsForRoles() ใน src/lib/rbac/definitions.ts คำนวณจากค่าคงที่ใน
-- TypeScript ล้วน ๆ ตอนนี้จึงมีแหล่งความจริงของสิทธิ์อยู่สองที่ และมีที่เดียว
-- ที่มีผลจริง ถ้าใครไปแก้ใน DB คิดว่าเปลี่ยนสิทธิ์แล้ว จะไม่มีอะไรเกิดขึ้นเลย
-- ซึ่งอันตรายกว่าตารางที่ตายสนิท
--
-- ยังไม่ลบทั้งสองกลุ่ม เพราะการเลือกว่าจะ "ลบตารางทิ้ง" หรือ "ย้ายไปอ่านจาก DB
-- จริง ๆ" เป็นการตัดสินใจเชิงสถาปัตยกรรม ไม่ใช่งานเก็บกวาด
--
-- ใส่ comment อย่างเดียว รันซ้ำได้โดยธรรมชาติ
-- ============================================================

COMMENT ON TABLE public.student_positions IS
  'DEPRECATED (0021): superseded by public.user_roles. School positions are RBAC roles now — a position that grants nothing is decoration, not a position. Zero rows, zero code references.';

COMMENT ON TABLE public.permissions IS
  'UNUSED BY APP (0021): seeded by 0003 but never read. permissionsForRoles() in src/lib/rbac/definitions.ts is the only source that takes effect. Editing this table changes nothing until the app is switched to read it.';

COMMENT ON TABLE public.role_permissions IS
  'UNUSED BY APP (0021): seeded by 0003 but never read. See public.permissions. Two sources of truth for permissions; only the TypeScript one is live.';

-- ------------------------------------------------------------
-- SMOKE
--   -- ต้องเห็นป้ายครบทั้งสามตาราง
--   SELECT c.relname, obj_description(c.oid) AS note
--     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname IN ('student_positions','permissions','role_permissions');
--
--   -- ยืนยันว่ายังไม่มีข้อมูลค้างใน student_positions ก่อนคิดจะลบในอนาคต
--   SELECT count(*) FROM public.student_positions;
-- ------------------------------------------------------------

-- ROLLBACK:
--   COMMENT ON TABLE public.student_positions IS NULL;
--   COMMENT ON TABLE public.permissions IS NULL;
--   COMMENT ON TABLE public.role_permissions IS NULL;
