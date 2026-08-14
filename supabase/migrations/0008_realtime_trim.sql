-- ============================================================
-- 0008 — หยุดกระจาย admins.password_hash ผ่าน realtime
--
-- schema.sql ใส่ตารางราว 32 ตัวเข้า publication supabase_realtime เพื่อให้
-- หน้า admin อัปเดตข้ามเครื่องได้ และ `admins` เป็นหนึ่งในนั้น —
-- ซึ่งตารางนั้นมี password_hash อยู่
--
-- Realtime ส่งทั้งแถวออกไปทุกครั้งที่มีการเปลี่ยนแปลง เมื่อ RLS ถูกปิด
-- (schema.sql:637-643) และ anon key ถูกส่งไปฝั่ง browser แถวนั้นจึงเข้าถึงได้
-- โดยใครก็ตามที่เปิด realtime subscription ได้
--
-- หน้า admin **พึ่ง** subscription นี้จริง — src/app/admin/page.tsx บรรทัด
-- ประมาณ 702 map `admins` ไปที่แท็บ dashboard/admins/settings ดังนั้นถ้า
-- เอาตารางออกจาก publication ดื้อ ๆ การอัปเดตสดจะพัง เราจึง republish ใหม่
-- พร้อมระบุรายชื่อคอลัมน์ที่ตัด password_hash ออก คอลัมน์ทุกตัวที่ UI อ่าน
-- ยังอยู่ครบ พฤติกรรมจึงไม่เปลี่ยน
--
-- ต้องใช้ PostgreSQL 15 ขึ้นไป (publication column list) Supabase ใช้ 17 อยู่แล้ว
-- รันซ้ำได้
-- ============================================================

DO $$
DECLARE
  pg_major integer := current_setting('server_version_num')::integer / 10000;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'ไม่พบ publication supabase_realtime จึงไม่ต้องทำอะไร';
    RETURN;
  END IF;

  IF pg_major < 15 THEN
    -- ก่อนเวอร์ชัน 15 ไม่มี column list: เลือกเอาตารางออกดีกว่าปล่อยให้
    -- hash รั่วต่อไป แลกกับการอัปเดตสดของแท็บ admin จนกว่าจะอัปเกรด DB
    RAISE WARNING 'PostgreSQL % ไม่รองรับ publication column list จึงเอา public.admins ออกจาก supabase_realtime แทน', pg_major;
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admins'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.admins';
    END IF;
    RETURN;
  END IF;

  -- republish ใหม่พร้อมระบุคอลัมน์ ต้อง DROP ก่อนเพราะ column list ของตาราง
  -- แก้ตรง ๆ ไม่ได้
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admins'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.admins';
  END IF;

  EXECUTE $sql$
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admins (
      id, admin_id, username, role,
      first_name, last_name, nickname, email, phone,
      entry_year, department, avatar, admin_status,
      created_at, username_changed_at, linked_student_id,
      google_id, google_email, account_id
    )
  $sql$;
END $$;

-- ตารางของ Phase 1 (user_accounts, auth_sessions, audit_logs, user_roles,
-- roles, permissions, role_permissions) ตั้งใจ **ไม่** ใส่เข้า publication
-- เพราะเก็บ credential, hash ของ session และค่าก่อน/หลังของฟิลด์ที่อ่อนไหว

-- ------------------------------------------------------------
-- SMOKE
--   -- password_hash ต้อง **ไม่** โผล่ ส่วนอีก 19 คอลัมน์ต้องมี:
--   SELECT unnest(attnames) AS col
--     FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' AND tablename = 'admins'
--    ORDER BY 1;
--
--   -- admins ต้องยังอยู่ใน publication และตารางอื่นไม่ถูกแตะ (ราว 32 ตัว):
--   SELECT count(*) FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' AND schemaname = 'public';
--
-- จากนั้นรีโหลดหน้า admin แล้วยืนยันว่าแท็บ admins/dashboard ยังอัปเดตสด
-- เมื่ออีกเครื่องแก้ข้อมูลแอดมิน
-- ------------------------------------------------------------

-- ROLLBACK:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.admins;
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.admins;
