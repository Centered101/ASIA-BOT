-- แยก storage bucket รูปคุรุภัณฑ์ออกจากรูปสินค้าสหกรณ์ (product-images)
-- Migration นี้เป็นแบบ additive รันซ้ำได้อย่างปลอดภัย

insert into storage.buckets (id, name, public)
values ('equipment-images', 'equipment-images', true)
on conflict (id) do nothing;
