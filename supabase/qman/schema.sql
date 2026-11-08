-- ============================================================
-- Qman Queue Management System - Supabase Schema
-- Tables prefixed with qman_ to separate from main project
-- ============================================================

-- Categories
CREATE TABLE IF NOT EXISTS qman_categories (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color_from TEXT NOT NULL,
  color_to TEXT NOT NULL
);

-- Shops
CREATE TABLE IF NOT EXISTS qman_shops (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES qman_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  branch TEXT NOT NULL,
  logo_url TEXT DEFAULT '',
  map_url TEXT DEFAULT '',
  price_per_booking NUMERIC DEFAULT 0,
  badge TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (separate from main project auth)
CREATE TABLE IF NOT EXISTS qman_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  wallet_balance NUMERIC DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS qman_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_number TEXT NOT NULL,
  user_id UUID REFERENCES qman_users(id) ON DELETE SET NULL,
  shop_id INT REFERENCES qman_shops(id) ON DELETE SET NULL,
  shop_name TEXT NOT NULL,
  shop_branch TEXT NOT NULL,
  shop_logo TEXT DEFAULT '',
  shop_map TEXT DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  notes TEXT DEFAULT '',
  price NUMERIC NOT NULL,
  status TEXT DEFAULT 'รอรับบริการ',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (permissive for demo)
ALTER TABLE qman_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE qman_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE qman_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE qman_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qman allow all" ON qman_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qman allow all" ON qman_shops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qman allow all" ON qman_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qman allow all" ON qman_bookings FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO qman_categories (id, name, icon, color_from, color_to) VALUES
  (1, 'ร้านอาหาร',  'fa-utensils',          '#f87171', '#dc2626'),
  (2, 'โรงพยาบาล', 'fa-hospital',           '#60a5fa', '#2563eb'),
  (3, 'ร้านตัดผม', 'fa-cut',                '#c084fc', '#9333ea'),
  (4, 'ธนาคาร',    'fa-building-columns',   '#4ade80', '#16a34a'),
  (5, 'คลินิก',    'fa-clinic-medical',     '#f472b6', '#db2777'),
  (6, 'สปา',       'fa-spa',                '#2dd4bf', '#0d9488')
ON CONFLICT (id) DO NOTHING;

INSERT INTO qman_shops (category_id, name, branch, logo_url, map_url, price_per_booking, badge) VALUES
  -- ร้านอาหาร (1)
  (1, 'ร้านอาหารญี่ปุ่น', 'สาขาเซ็นทรัล',
    'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200&h=200&fit=crop',
    '/qman/images/map/ร้านอาหาร/13.png', 50, 'hot'),
  (1, 'ร้านก๋วยเตี๋ยว', 'สาขาตลาด',
    'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=200&h=200&fit=crop',
    '/qman/images/map/ร้านอาหาร/11.png', 30, 'hot'),
  (1, 'ร้านกาแฟ', 'สาขามหาวิทยาลัย',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&h=200&fit=crop',
    '/qman/images/map/ร้านอาหาร/12.png', 20, 'popular'),
  (1, 'สุกี้ตี๋น้อย', 'สาขาเกษตร-นวมินทร์',
    '/qman/images/LINE_ALBUM_ร้านอาหารดังๆเด้ออออออ_260203_1.jpg',
    '/qman/images/map/ร้านอาหาร/3.png', 250, ''),
  (1, 'ฮอตพอตแมน ชาบูหมาล่าบุฟเฟต์', 'สาขารังสิต',
    '/qman/images/LINE_ALBUM_ร้านอาหารดังๆเด้ออออออ_260203_2.jpg',
    '/qman/images/map/ร้านอาหาร/4.png', 250, ''),
  (1, 'Thai dessert หยกสด', 'Siam Paragon G Floor',
    '/qman/images/LINE_ALBUM_ร้านอาหารดังๆเด้ออออออ_260203_3.jpg',
    '/qman/images/map/ร้านอาหาร/8.png', 250, ''),
  (1, 'YolYOLK', 'Banthat Thong Road',
    '/qman/images/LINE_ALBUM_ร้านอาหารดังๆเด้ออออออ_260203_7.jpg',
    '/qman/images/map/ร้านอาหาร/2.png', 250, ''),
  (1, 'SOURI Banthat Thong', 'รองเมือง เขตปทุมวัน',
    '/qman/images/LINE_ALBUM_ร้านอาหารดังๆเด้ออออออ_260203_8.jpg',
    '/qman/images/map/ร้านอาหาร/1.png', 250, ''),
  (1, 'หม้อแม่จูน', 'สาขานนทบุรี',
    '/qman/images/LINE_ALBUM_ร้านอาหารดังๆเด้ออออออ_260203_9.jpg',
    '/qman/images/map/ร้านอาหาร/5.png', 250, 'hot'),
  -- โรงพยาบาล (2)
  (2, 'โรงพยาบาลรามา', 'สาขาพระราม 2',
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=200&h=200&fit=crop',
    '/qman/images/map/โรงพยาบาล/2.png', 100, ''),
  (2, 'คลินิกหมอครอบครัว', 'สาขาลาดพร้าว',
    'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=200&h=200&fit=crop',
    '/qman/images/map/โรงพยาบาล/1.png', 80, ''),
  -- ร้านตัดผม (3)
  (3, 'ร้านตัดผม Premium', 'สาขาสยาม',
    'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=200&h=200&fit=crop',
    '/qman/images/map/ร้านตัดผม/2.png', 200, 'popular'),
  (3, 'ร้านตัดผมชาย', 'สาขาถนนข้าว',
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=200&h=200&fit=crop',
    '/qman/images/map/ร้านตัดผม/1.png', 60, ''),
  -- ธนาคาร (4)
  (4, 'ธนาคารกสิกร', 'สาขาศรีนครินทร์',
    'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=200&h=200&fit=crop',
    '/qman/images/map/ธนาคาร/2.png', 0, ''),
  (4, 'ธนาคารไทยพาณิชย์', 'สาขาสุขุมวิท',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200&h=200&fit=crop',
    '/qman/images/map/ธนาคาร/1.png', 0, ''),
  -- คลินิก (5)
  (5, 'คลินิกผิวหนัง', 'สาขาอารีย์',
    'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=200&h=200&fit=crop',
    '/qman/images/map/คลินิก/2.png', 150, 'hot'),
  (5, 'คลินิกทันตกรรม', 'สาขาลาดพร้าว',
    'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=200&h=200&fit=crop',
    '/qman/images/map/คลินิก/1.png', 120, ''),
  -- สปา (6)
  (6, 'Let''s Relax Spa', 'สาขาเซ็นทรัล',
    'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&h=200&fit=crop',
    '/qman/images/map/สปา/2.png', 300, 'popular'),
  (6, 'Healthland Spa', 'สาขาสาทร',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200&h=200&fit=crop',
    '/qman/images/map/สปา/1.png', 250, '')
ON CONFLICT DO NOTHING;

-- NOTE: Run GET /api/qman/seed to create the demo user (example@email.com / 555)
-- This handles bcrypt hashing at runtime.
