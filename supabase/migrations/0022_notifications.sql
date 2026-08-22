-- ============================================================
-- 0022 — ศูนย์แจ้งเตือนรายบุคคล
--
-- ของเดิมยิงแจ้งเตือนเข้า "กลุ่ม LINE" อย่างเดียว (line_notification_channels)
-- ซึ่งเหมาะกับเจ้าหน้าที่ที่เฝ้ากลุ่มอยู่แล้ว แต่ตอบโจทย์ roadmap ข้อ 22 ไม่ได้
-- เพราะสิ่งที่ต้องการคือ "ขาดเรียน → แจ้งนักเรียน + ครูที่ปรึกษา + ผู้ปกครอง"
-- คือส่งถึง *คน* ไม่ใช่ห้องแชทรวม
--
-- ปัญหาของการยิงเข้ากลุ่มอย่างเดียว: นักเรียนที่ไม่ได้อยู่ในกลุ่มไม่มีทางรู้
-- เรื่องของตัวเอง และเรื่องส่วนตัว (ค่าเทอมค้าง ผลการเรียน) ก็ไม่ควรไปโผล่
-- ในกลุ่มรวมตั้งแต่แรก
--
-- ตารางนี้จึงเป็นกล่องข้อความของแต่ละ account ส่วนการยิง LINE เข้ากลุ่ม
-- ยังทำงานเหมือนเดิม ไม่ถูกแตะ — สองอย่างนี้อยู่คู่กัน
--
-- ใช้ line_notification_categories เป็นหมวดร่วมกัน ไม่สร้าง taxonomy ชุดที่สอง
-- เพราะถ้าแยกกันวันหนึ่งจะมีหมวด "จองห้อง" สองอันที่สะกดไม่เหมือนกัน
--
-- เพิ่มอย่างเดียว รันซ้ำได้
-- ============================================================

-- --- หมวดที่โมดูลใหม่ ๆ ต้องใช้ ------------------------------
-- ของเดิมมี 8 หมวด (admin, broadcast, booking, feedback, order, attendance,
-- data_change, equipment) — maintenance ถูกใช้ในโค้ดแล้วแต่ยังไม่มีในตาราง
-- ส่วนที่เหลือเตรียมไว้ให้โมดูลที่กำลังจะทำ จะได้ไม่ต้อง migrate ทีละหมวด
INSERT INTO public.line_notification_categories (key, label, description, sort_order)
VALUES
  ('maintenance', 'แจ้งซ่อม',      'งานซ่อมอาคารสถานที่ ครุภัณฑ์ อุปกรณ์', 90),
  ('document',    'เอกสาร',        'คำขอเอกสารและสถานะการอนุมัติ',          91),
  ('finance',     'การเงิน',       'ค่าเทอม ค่าธรรมเนียม ใบเสร็จ',           92),
  ('academic',    'การเรียน',      'ผลการเรียน การเข้าเรียน งานที่สั่ง',      93),
  ('affairs',     'กิจการนักเรียน', 'ความประพฤติ การติดตาม เยี่ยมบ้าน',       94),
  ('activity',    'กิจกรรม',       'กิจกรรมและการเข้าร่วม',                  95),
  ('library',     'ห้องสมุด',      'ยืม-คืนหนังสือ เกินกำหนด ค่าปรับ',        96),
  ('health',      'ห้องพยาบาล',    'การเข้ารับบริการและการติดตามอาการ',       97)
ON CONFLICT (key) DO NOTHING;

-- --- กล่องแจ้งเตือนของแต่ละคน --------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  -- ผู้รับเป็น account เสมอ ไม่ใช่ student_id/admin_id เพราะคนคนเดียวอาจมี
  -- หลาย profile (staff ที่เป็นนักเรียนด้วย) และควรเห็นกล่องเดียว
  account_id uuid NOT NULL,
  category_key text NOT NULL DEFAULT 'admin',
  title text NOT NULL,
  body text,
  -- เส้นทางในแอปที่กดแล้วไปถึงเรื่องนั้น เช่น /admin/maintenance/<id>
  link text,
  -- ผูกกลับไปที่ของจริง ไว้ลบ/รวมแจ้งเตือนของ entity เดียวกันได้
  entity_type text,
  entity_id text,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])),
  read_at timestamp with time zone,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  CONSTRAINT notifications_category_key_fkey
    FOREIGN KEY (category_key) REFERENCES public.line_notification_categories(key) ON UPDATE CASCADE
);

-- นับ badge "ยังไม่อ่าน" ต้องเร็วเพราะเรียกทุกครั้งที่โหลดหน้า
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (account_id) WHERE read_at IS NULL;

-- รายการในกล่อง เรียงใหม่ไปเก่า
CREATE INDEX IF NOT EXISTS notifications_inbox_idx
  ON public.notifications (account_id, created_at DESC);

-- หาแจ้งเตือนของ entity หนึ่ง ๆ ไว้ลบตอนเรื่องถูกยกเลิก
CREATE INDEX IF NOT EXISTS notifications_entity_idx
  ON public.notifications (entity_type, entity_id)
  WHERE entity_type IS NOT NULL;

-- --- ปิดหมวดที่ไม่อยากรับ ------------------------------------
-- ไม่มีแถว = รับทุกหมวด ผู้ใช้ที่ไม่เคยตั้งค่าจึงไม่ต้อง backfill
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  account_id uuid NOT NULL,
  category_key text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  line boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (account_id, category_key),
  CONSTRAINT notification_preferences_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  CONSTRAINT notification_preferences_category_key_fkey
    FOREIGN KEY (category_key) REFERENCES public.line_notification_categories(key) ON UPDATE CASCADE
);

-- --- realtime -------------------------------------------------
-- กระดิ่งต้องเด้งเองโดยไม่ต้องรีเฟรช ใช้ publication เดิมที่หน้า admin ใช้อยู่
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'notifications'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ------------------------------------------------------------
-- SMOKE
--   -- ต้องได้ 16 หมวด (8 เดิม + 8 ใหม่)
--   SELECT count(*) FROM public.line_notification_categories;
--
--   -- ตารางต้องมีและว่าง
--   SELECT count(*) FROM public.notifications;
--   SELECT count(*) FROM public.notification_preferences;
--
--   -- index ครบ 3 ตัว
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'notifications' AND indexname LIKE 'notifications_%_idx'
--    ORDER BY 1;
--
--   -- อยู่ใน realtime แล้ว
--   SELECT tablename FROM pg_publication_tables
--    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications';
-- ------------------------------------------------------------

-- ROLLBACK:
--   DROP TABLE IF EXISTS public.notification_preferences;
--   DROP TABLE IF EXISTS public.notifications;
--   DELETE FROM public.line_notification_categories
--    WHERE key IN ('document','finance','academic','affairs','activity','library','health');
--   -- เก็บ maintenance ไว้ เพราะ line-targets.ts ใช้อยู่จริงแล้ว
