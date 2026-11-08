-- ============================================================
-- QQ Food Ordering System — TABLES (structure only)
-- Tables prefixed with qq_ to separate from main asia-bot project
-- Run this FIRST, then 02_seed.sql
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
