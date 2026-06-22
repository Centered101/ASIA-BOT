-- ============================================================
-- QQ Food Ordering System - Supabase Schema
-- Tables prefixed with qq_ to separate from main project
-- ============================================================

-- Stores
CREATE TABLE IF NOT EXISTS qq_stores (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  color1 TEXT NOT NULL,
  color2 TEXT NOT NULL
);

-- Menu Items
CREATE TABLE IF NOT EXISTS qq_menu_items (
  id SERIAL PRIMARY KEY,
  store_id INT REFERENCES qq_stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'ทั่วไป',
  price NUMERIC NOT NULL,
  image TEXT DEFAULT '',
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS qq_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_num TEXT NOT NULL,
  customer_name TEXT DEFAULT '-',
  total NUMERIC NOT NULL,
  notes TEXT DEFAULT '-',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items
CREATE TABLE IF NOT EXISTS qq_order_items (
  id SERIAL PRIMARY KEY,
  order_id UUID REFERENCES qq_orders(id) ON DELETE CASCADE,
  store_id INT NOT NULL,
  item_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity INT NOT NULL,
  image TEXT DEFAULT ''
);

-- Per-store order status (pending -> preparing -> delivered)
CREATE TABLE IF NOT EXISTS qq_store_order_status (
  id SERIAL PRIMARY KEY,
  order_id UUID REFERENCES qq_orders(id) ON DELETE CASCADE,
  store_id INT NOT NULL,
  status TEXT DEFAULT 'pending',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, store_id)
);

-- Enable RLS (permissive for demo)
ALTER TABLE qq_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE qq_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qq_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE qq_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE qq_store_order_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qq allow all" ON qq_stores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qq allow all" ON qq_menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qq allow all" ON qq_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qq allow all" ON qq_order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "qq allow all" ON qq_store_order_status FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO qq_stores (id, name, icon, color, color1, color2) VALUES
  (1, 'ร้านข้าว',          '🍚', 'orange', '#f97316', '#ea580c'),
  (2, 'ร้านน้ำ',           '🧃', 'blue',   '#3b82f6', '#2563eb'),
  (3, 'ร้านก๋วยเตี๋ยว',   '🍜', 'red',    '#ef4444', '#dc2626'),
  (4, 'ร้านไก่และขนม',    '🍗', 'yellow', '#eab308', '#ca8a04')
ON CONFLICT (id) DO NOTHING;

-- ร้านข้าว
INSERT INTO qq_menu_items (store_id, name, category, price, image, is_available) VALUES
  (1, 'ข้าวผัดไข่',       'ข้าวผัด', 40,  '🍳', true),
  (1, 'ข้าวหมูแดง',       'ข้าว',    45,  '🍖', true),
  (1, 'ข้าวกะเพราไก่',   'ข้าวผัด', 40,  '🌶️', true),
  (1, 'ข้าวต้มปลา',       'ข้าวต้ม', 35,  '🐟', true),
  (1, 'ข้าวมันไก่',       'ข้าว',    45,  '🍗', true)
ON CONFLICT DO NOTHING;

-- ร้านน้ำ
INSERT INTO qq_menu_items (store_id, name, category, price, image, is_available) VALUES
  (2, 'น้ำมะนาว',          'น้ำดื่ม',  25, '🍋', true),
  (2, 'ชานม',              'ชา',       30, '🧋', true),
  (2, 'กาแฟเย็น',         'กาแฟ',    35, '☕', true),
  (2, 'น้ำส้ม',           'น้ำผลไม้', 25, '🍊', true),
  (2, 'น้ำเก๊กฮวย',       'ชา',       20, '🌼', true)
ON CONFLICT DO NOTHING;

-- ร้านก๋วยเตี๋ยว
INSERT INTO qq_menu_items (store_id, name, category, price, image, is_available) VALUES
  (3, 'ก๋วยเตี๋ยวหมู',    'เส้น',   40, '🍜', true),
  (3, 'ก๋วยเตี๋ยวไก่',   'เส้น',   40, '🍜', true),
  (3, 'บะหมี่หมูแดง',    'เส้น',   45, '🍝', true),
  (3, 'เส้นใหญ่ผัดซีอิ๊ว','ผัด',   40, '🍜', true),
  (3, 'ต้มยำหมู',         'น้ำ',    50, '🥣', true)
ON CONFLICT DO NOTHING;

-- ร้านไก่และขนม
INSERT INTO qq_menu_items (store_id, name, category, price, image, is_available) VALUES
  (4, 'ไก่ทอด',           'ไก่',   35, '🍗', true),
  (4, 'ไก่ย่าง',          'ไก่',   40, '🍗', true),
  (4, 'ขนมปัง',           'ขนม',  20, '🍞', true),
  (4, 'โดนัท',            'ขนม',  25, '🍩', true),
  (4, 'เค้ก',             'ขนม',  45, '🎂', true)
ON CONFLICT DO NOTHING;
