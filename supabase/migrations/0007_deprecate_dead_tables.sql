-- ============================================================
-- 0007 — ทำเครื่องหมายตารางที่ถูกแทนที่แล้ว (ใส่ COMMENT เท่านั้น ไม่ลบอะไร)
--
-- ตอน audit นับจำนวนการอ้าง `.from("<table>")` ทั่ว src/ พบ 3 ตารางที่
-- ไม่มีโค้ดอ้างถึงเลย และแต่ละตัวมีตารางที่ใช้งานจริงซ้ำซ้อนอยู่แล้ว:
--
--   feedbacks            0 ครั้ง  เทียบกับ  feedback   20 ครั้ง
--   room_bookings        0 ครั้ง  เทียบกับ  bookings   24 ครั้ง
--   teacher_applications 0 ครั้ง  เทียบกับ  teachers   13 ครั้ง
--                                 (teachers.status มีค่า pending/reviewing/
--                                  approved/rejected อยู่แล้ว พร้อมกับ
--                                  desired_username/desired_password_hash)
--
-- ตารางเหล่านี้ยังมีแถวข้อมูลอยู่ และอาจมีประวัติที่ยังไม่มีใครย้าย
-- migration นี้จึงแค่ติดป้ายไว้ การลบเป็นการตัดสินใจแยกต่างหากที่ต้องทำ
-- หลังตรวจข้อมูลแล้ว ไม่ใช่สิ่งที่ควรพ่วงมากับ migration พื้นฐานที่รันกับ
-- production
--
-- ติดป้ายให้ student_cards (1 การอ้าง) เทียบ rfid_cards (4 การอ้าง) ที่เกือบตาย
-- และตารางเช็กชื่อ 3 ตัวที่ทับซ้อนกันด้วย ทั้งหมดยังใช้งานอยู่จริง
-- และจะรวบให้เหลือชุดเดียวใน Phase 3 ไม่ใช่ที่นี่
--
-- รันซ้ำได้ การใส่ comment เป็น idempotent อยู่แล้วโดยธรรมชาติ
-- ============================================================

COMMENT ON TABLE public.feedbacks IS
  'DEPRECATED (Phase 1 audit): superseded by public.feedback. Zero code references. Do not write new code against this table.';

COMMENT ON TABLE public.room_bookings IS
  'DEPRECATED (Phase 1 audit): superseded by public.bookings. Zero code references. Do not write new code against this table.';

COMMENT ON TABLE public.teacher_applications IS
  'DEPRECATED (Phase 1 audit): superseded by public.teachers (status + desired_username + desired_password_hash). Zero code references.';

COMMENT ON TABLE public.student_cards IS
  'LEGACY (Phase 1 audit): largely superseded by public.rfid_cards. Still referenced once; migrate remaining reads to rfid_cards before removing.';

COMMENT ON TABLE public.attendance IS
  'PRIMARY attendance table (toggle model: checkin_time/checkout_time/duration). See also attendance_logs and entry_logs — all three are live; consolidation is Phase 3.';

COMMENT ON TABLE public.attendance_logs IS
  'Secondary attendance history (check_in/check_out/duration_minutes). Overlaps public.attendance; consolidation is Phase 3.';

COMMENT ON TABLE public.entry_logs IS
  'Raw in/out scan events. Overlaps public.attendance; consolidation is Phase 3.';

-- ------------------------------------------------------------
-- SMOKE — ยืนยันว่าป้ายติดแล้ว และดูว่ามีข้อมูลค้างอยู่ในตารางที่เลิกใช้
-- มากแค่ไหน ก่อนจะตัดสินใจลบในอนาคต
--
--   SELECT c.relname, obj_description(c.oid) AS note
--     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public'
--      AND c.relname IN ('feedbacks','room_bookings','teacher_applications',
--                        'student_cards','attendance','attendance_logs','entry_logs');
--
--   SELECT 'feedbacks' t, count(*) FROM public.feedbacks
--   UNION ALL SELECT 'room_bookings', count(*) FROM public.room_bookings
--   UNION ALL SELECT 'teacher_applications', count(*) FROM public.teacher_applications;
-- ------------------------------------------------------------

-- ROLLBACK:
--   COMMENT ON TABLE public.feedbacks IS NULL;
--   COMMENT ON TABLE public.room_bookings IS NULL;
--   COMMENT ON TABLE public.teacher_applications IS NULL;
--   COMMENT ON TABLE public.student_cards IS NULL;
--   COMMENT ON TABLE public.attendance IS NULL;
--   COMMENT ON TABLE public.attendance_logs IS NULL;
--   COMMENT ON TABLE public.entry_logs IS NULL;
