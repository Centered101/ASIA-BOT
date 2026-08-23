-- ============================================================
-- Supabase Storage - asia-bot
-- Contains storage buckets and storage.objects policies only.
-- Buckets are public because the application reads files via public URLs.
-- Uploads are handled by API routes with the service role key, so no client
-- INSERT/UPDATE/DELETE storage policies are created here.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('student-avatars', 'student-avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('equipment-images', 'equipment-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('project-images', 'project-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('feedback', 'feedback', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  -- Phase 3 (supabase/migrations/0014-0015). ไม่รับ svg เหมือน project/product
  -- เพราะสองบัคเก็ตนี้รับรูปจากผู้ใช้ทั่วไป และ svg เปิดตรงจาก public URL
  -- จะข้าม CSP ของ next/image ไปได้
  ('maintenance-photos', 'maintenance-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('asset-images', 'asset-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  -- Phase 6 (0023). รับ pdf ด้วยเพราะเอกสารราชการที่นักเรียนได้มาส่วนใหญ่เป็น pdf
  -- ไม่ใช่รูปถ่าย และโควตา 10MB เพราะสำเนา ปพ. หลายหน้าที่สแกนมาใหญ่กว่ารูปทั่วไป
  --
  -- bucket นี้เป็น public เหมือนตัวอื่นตามที่หัวไฟล์อธิบายไว้ แปลว่าใครถือ URL
  -- ก็เปิดได้ — ยอมรับได้กับรูปโปรไฟล์ แต่สำเนาบัตรประชาชนไม่ใช่เรื่องเดียวกัน
  -- ชื่อไฟล์จึงต้องเดาไม่ได้ (buildStorageImagePath สุ่มต่อท้ายให้อยู่แล้ว) และ
  -- ควรย้ายไป private + signed URL เมื่อไหร่ก็ตามที่มีเวลาแตะชั้น storage
  ('student-documents', 'student-documents', true, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_objects_public_read_asia_bot ON storage.objects;
DROP POLICY IF EXISTS "asia-bot public read" ON storage.objects;
CREATE POLICY storage_objects_public_read_asia_bot
  ON storage.objects
  FOR SELECT
  USING (
    storage.objects.bucket_id IN (
      'student-avatars',
      'avatars',
      'equipment-images',
      'project-images',
      'product-images',
      'feedback',
      'maintenance-photos',
      'asset-images'
    )
  );