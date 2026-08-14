-- ============================================================
-- 0007 — Mark superseded tables (COMMENT ONLY — nothing is dropped)
--
-- The audit counted `.from("<table>")` references across src/ and found three
-- tables with ZERO code references, each duplicated by a table that is in
-- active use:
--
--   feedbacks           0 refs  vs  feedback            20 refs
--   room_bookings       0 refs  vs  bookings            24 refs
--   teacher_applications 0 refs vs  teachers            13 refs
--                                   (teachers.status already carries
--                                    pending/reviewing/approved/rejected plus
--                                    desired_username/desired_password_hash)
--
-- They still hold rows and might hold history nobody has migrated, so this
-- migration only labels them. Dropping is a separate, deliberate decision
-- after the data has been reviewed — not something to bundle into a
-- foundation migration running against production.
--
-- Also labels the near-dead student_cards (1 ref) vs rfid_cards (4 refs), and
-- the three overlapping attendance tables, which all remain in active use and
-- are consolidated in Phase 3, not here.
--
-- Safe to run twice. Comments are idempotent by nature.
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
-- SMOKE — confirm the labels landed, and see how much data is parked in the
-- deprecated tables before any future decision to drop them.
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
