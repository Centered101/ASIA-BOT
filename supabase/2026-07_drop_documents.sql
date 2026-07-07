-- ลบระบบเอกสาร PDF (admin tab + agent tool + LINE PDF upload ถูกลบออกจากโค้ดแล้ว)
-- รันสคริปต์นี้ใน Supabase SQL Editor เพื่อลบตารางที่เกี่ยวข้อง

DROP TABLE IF EXISTS public.pdf_chunks CASCADE;
DROP TABLE IF EXISTS public.pdf_documents CASCADE;

-- Storage bucket "pdf-documents" ต้องลบเองผ่าน Supabase Dashboard > Storage
-- (SQL Editor ลบ storage bucket/objects ไม่ได้โดยตรง)
