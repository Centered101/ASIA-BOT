-- ============================================================
-- Qman Queue Management System — TABLES (structure only)
-- Tables prefixed with qman_ to separate from main asia-bot project
-- Run this FIRST, then 02_seed.sql
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
