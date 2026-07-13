-- ============================================================
-- Storage Buckets — asia-bot
-- รันใน Supabase SQL Editor ของโปรเจกต์ใหม่ (สร้าง bucket ที่โค้ดต้องใช้)
-- ทุก bucket เป็น public (อ่านไฟล์ผ่าน getPublicUrl ได้)
-- อัปโหลดทำผ่าน API route ด้วย service key จึงไม่ต้องมี insert policy
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('student-avatars', 'student-avatars', true),  -- รูปนักเรียน (upload-photo)
  ('avatars',         'avatars',         true),  -- รูปโปรไฟล์ admin (upload-avatar)
  ('equipment-images','equipment-images',true),  -- รูปครุภัณฑ์ (upload-equipment)
  ('project-images',  'project-images',  true),  -- รูปโปรเจกต์ (upload-project)
  ('product-images',  'product-images',  true),  -- รูปสินค้าสหกรณ์ (upload)
  ('feedback',        'feedback',        true)   -- รูปแนบ feedback (feedback/upload)
ON CONFLICT (id) DO NOTHING;

-- อนุญาตอ่านไฟล์แบบ public (เผื่อ client อ่านผ่าน SDK)
DROP POLICY IF EXISTS "asia-bot public read" ON storage.objects;
CREATE POLICY "asia-bot public read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN (
      'student-avatars','avatars','equipment-images',
      'project-images','product-images','feedback'
    )
  );
