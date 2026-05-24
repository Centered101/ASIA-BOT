-- ══════════════════════════════════════════════════════════════
--  ASIA-BOT — Full Supabase Schema
--  ผู้พัฒนา: Centered101  |  2026
--  รัน 1 ครั้งใน Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  1. STUDENTS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists students (
  id              uuid primary key default uuid_generate_v4(),
  student_id      text not null unique,
  student_phone   text not null,
  first_name      text not null,
  last_name       text not null,
  program         text not null default 'ปวช',   -- ปวช | ปวส
  entry_year      text not null,
  nickname        text,
  department      text,
  uid             text unique,                   -- RFID card UID
  card_status     text not null default 'inactive' check (card_status in ('active','inactive','lost')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index on students (student_id);
create index on students (uid);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  2. ADMINS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists admins (
  id           uuid primary key default uuid_generate_v4(),
  admin_id     text not null unique,
  username     text not null unique,
  password_hash text not null,                    -- SHA-256 hex
  role         text not null default 'admin' check (role in ('superadmin','admin','staff')),
  first_name   text,
  last_name    text,
  nickname     text,
  email        text,
  phone        text,
  entry_year   text,
  department   text,
  avatar       text,                              -- emoji or url
  admin_status text not null default 'active' check (admin_status in ('active','inactive')),
  created_at   timestamptz default now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  3. LOGIN LOGS (students)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists login_logs (
  id                  uuid primary key default uuid_generate_v4(),
  log_time            timestamptz default now(),
  student_id_attempt  text,
  status              text,    -- success | failed | error
  reason              text,
  ip_address          text,
  user_agent          text,
  platform            text,
  language            text,
  screen              text,
  timezone            text,
  referrer            text,
  page_url            text,
  touch_device        boolean
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  4. ADMIN LOGS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists admin_logs (
  id                 uuid primary key default uuid_generate_v4(),
  log_time           timestamptz default now(),
  admin_id_attempt   text,
  status             text,
  reason             text,
  ip_address         text,
  user_agent         text,
  platform           text,
  language           text,
  screen             text,
  timezone           text,
  referrer           text,
  page_url           text,
  touch_device       boolean
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  5. ATTENDANCE (RFID check-in/check-out)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists attendance (
  id            uuid primary key default uuid_generate_v4(),
  student_id    text not null references students(student_id) on delete cascade,
  location      text not null default 'school' check (location in ('school','library','meeting')),
  checkin_time  timestamptz,
  checkout_time timestamptz,
  duration      text,
  uid           text,
  date          date not null default current_date,
  created_at    timestamptz default now()
);
create index on attendance (student_id, date);
create index on attendance (date, location);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  6. FEEDBACK (แสดงความคิดเห็น + รายงานปัญหา)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists feedback (
  id          uuid primary key default uuid_generate_v4(),
  type        text not null check (type in ('comment','report')),  -- แสดงความคิดเห็น | รายงานปัญหา
  name        text,
  student_id  text,
  email       text,
  contact     text,
  category    text,
  message     text not null,
  report_url  text,
  image_urls  text[],          -- Supabase Storage public URLs
  status      text not null default 'pending' check (status in ('pending','in_progress','resolved')),
  admin_note  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  7. PROJECT EVALUATIONS (project-1 … project-7)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists project_evaluations (
  id           uuid primary key default uuid_generate_v4(),
  project_num  int not null check (project_num between 1 and 7),
  gender       text,
  evaluator    text,    -- นักเรียน | ครู | บุคคลภายนอก
  name         text,
  emoji        text,
  creative     int check (creative between 1 and 5),
  content      int check (content between 1 and 5),
  presentation int check (presentation between 1 and 5),
  usability    int check (usability between 1 and 5),
  overall      int check (overall between 1 and 5),
  comments     text,
  created_at   timestamptz default now()
);
create index on project_evaluations (project_num);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  8. SHOP — PRODUCTS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists products (
  id         uuid primary key default uuid_generate_v4(),
  tag        text,           -- emoji tag
  stock      int not null default 0,
  name       text not null,
  price      numeric(10,2) not null,
  images     text[],         -- array of image URLs
  unit       text default 'ชิ้น',
  category   text,
  cost       numeric(10,2),  -- ต้นทุน (ซ่อนจาก frontend)
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  9. SHOP — ORDERS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists orders (
  id             uuid primary key default uuid_generate_v4(),
  order_id       text not null unique default ('ORD-' || upper(substr(md5(random()::text),1,8))),
  student_id     text not null,
  student_name   text not null,
  items_json     jsonb not null,   -- [{id, name, qty, price}]
  total          numeric(10,2) not null,
  pi_id          text,             -- Stripe PaymentIntent ID
  status         text not null default 'pending' check (status in ('pending','paid','cancelled','refunded')),
  delivery_mode  text default 'pickup' check (delivery_mode in ('pickup','delivery')),
  delivery_loc   text,
  delivery_slot  text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index on orders (student_id);
create index on orders (status);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  10. SHOP — PAYMENT LOGS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists pay_logs (
  id             uuid primary key default uuid_generate_v4(),
  log_ts         timestamptz default now(),
  order_id       text,
  student_id     text,
  total          numeric(10,2),
  pi_id          text,
  stripe_status  text,
  status         text,
  note           text
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  11. ROOMS + TIME SLOTS + BOOKINGS (Roomly)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists rooms (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  capacity    int  not null default 10,
  location    text,
  image_url   text,
  amenities   text[],
  status      text not null default 'active' check (status in ('active','maintenance','inactive')),
  created_at  timestamptz default now()
);

create table if not exists time_slots (
  id         serial primary key,
  label      text not null,
  start_time time not null,
  end_time   time not null
);

insert into time_slots (label, start_time, end_time) values
  ('08:00 - 10:00', '08:00', '10:00'),
  ('10:00 - 12:00', '10:00', '12:00'),
  ('13:00 - 15:00', '13:00', '15:00'),
  ('15:00 - 17:00', '15:00', '17:00')
on conflict do nothing;

create table if not exists bookings (
  id            uuid primary key default uuid_generate_v4(),
  room_id       uuid not null references rooms(id) on delete cascade,
  slot_id       int  not null references time_slots(id),
  booking_date  date not null,
  student_id    text not null,
  student_name  text not null,
  student_phone text,
  purpose       text not null,
  attendees     int  default 1,
  status        text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  admin_note    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (room_id, slot_id, booking_date)
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  Triggers — auto updated_at
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace trigger students_updated_at   before update on students  for each row execute function set_updated_at();
create or replace trigger feedback_updated_at   before update on feedback  for each row execute function set_updated_at();
create or replace trigger orders_updated_at     before update on orders    for each row execute function set_updated_at();
create or replace trigger bookings_updated_at   before update on bookings  for each row execute function set_updated_at();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  RLS (Row Level Security)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
alter table students          enable row level security;
alter table admins            enable row level security;
alter table login_logs        enable row level security;
alter table admin_logs        enable row level security;
alter table attendance        enable row level security;
alter table feedback          enable row level security;
alter table project_evaluations enable row level security;
alter table products          enable row level security;
alter table orders            enable row level security;
alter table pay_logs          enable row level security;
alter table rooms             enable row level security;
alter table time_slots        enable row level security;
alter table bookings          enable row level security;

-- Drop all existing public-schema policies before recreating (idempotent)
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Drop storage.objects policies too
drop policy if exists "feedback_img_upload" on storage.objects;
drop policy if exists "feedback_img_read"   on storage.objects;
drop policy if exists "product_img_read"    on storage.objects;
drop policy if exists "product_img_admin"   on storage.objects;
drop policy if exists "project_img_read"    on storage.objects;
drop policy if exists "project_img_admin"   on storage.objects;
drop policy if exists "student_avatar_read"   on storage.objects;
drop policy if exists "student_avatar_upload" on storage.objects;
drop policy if exists "student_avatar_svc"    on storage.objects;
drop policy if exists "admin_avatar_read"     on storage.objects;
drop policy if exists "admin_avatar_svc"      on storage.objects;

-- Public reads
create policy "students_read"      on students          for select using (true);
create policy "products_read"      on products          for select using (active = true);
create policy "rooms_read"         on rooms             for select using (true);
create policy "slots_read"         on time_slots        for select using (true);
create policy "bookings_read"      on bookings          for select using (true);
create policy "feedback_read"      on feedback          for select using (true);
create policy "proj_read"          on project_evaluations for select using (true);

-- Public inserts
create policy "feedback_insert"    on feedback          for insert with check (true);
create policy "proj_insert"        on project_evaluations for insert with check (true);
create policy "bookings_insert"    on bookings          for insert with check (true);
create policy "login_log_insert"   on login_logs        for insert with check (true);
create policy "admin_log_insert"   on admin_logs        for insert with check (true);
create policy "attendance_insert"  on attendance        for insert with check (true);
create policy "students_insert"    on students          for insert with check (true);
create policy "orders_insert"      on orders            for insert with check (true);
create policy "pay_log_insert"     on pay_logs          for insert with check (true);

-- Service role (admin API) manages everything
create policy "svc_students"   on students    for all using (auth.role() = 'service_role');
create policy "svc_admins"     on admins      for all using (auth.role() = 'service_role');
create policy "svc_attendance" on attendance  for all using (auth.role() = 'service_role');
create policy "svc_feedback"   on feedback    for all using (auth.role() = 'service_role');
create policy "svc_orders"     on orders      for all using (auth.role() = 'service_role');
create policy "svc_products"   on products    for all using (auth.role() = 'service_role');
create policy "svc_rooms"      on rooms       for all using (auth.role() = 'service_role');
create policy "svc_bookings"   on bookings    for all using (auth.role() = 'service_role');
create policy "svc_login_logs" on login_logs  for all using (auth.role() = 'service_role');
create policy "svc_admin_logs" on admin_logs  for all using (auth.role() = 'service_role');
create policy "svc_pay_logs"   on pay_logs    for all using (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  Supabase Storage Buckets (รัน manual ใน Storage tab หรือ ที่นี่)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
insert into storage.buckets (id, name, public) values
  ('feedback-images',  'feedback-images',  true),
  ('product-images',   'product-images',   true),
  ('project-images',   'project-images',   true),
  ('student-avatars',  'student-avatars',  true),
  ('avatars',          'avatars',          true)
on conflict do nothing;

create policy "feedback_img_upload" on storage.objects for insert with check (bucket_id = 'feedback-images');
create policy "feedback_img_read"   on storage.objects for select using (bucket_id = 'feedback-images');
create policy "product_img_read"    on storage.objects for select using (bucket_id = 'product-images');
create policy "product_img_admin"   on storage.objects for all using (bucket_id = 'product-images' and auth.role() = 'service_role');
create policy "project_img_read"    on storage.objects for select using (bucket_id = 'project-images');
create policy "project_img_admin"   on storage.objects for all using (bucket_id = 'project-images' and auth.role() = 'service_role');
create policy "student_avatar_read"   on storage.objects for select using (bucket_id = 'student-avatars');
create policy "student_avatar_upload" on storage.objects for insert with check (bucket_id = 'student-avatars');
create policy "student_avatar_svc"    on storage.objects for all using (bucket_id = 'student-avatars' and auth.role() = 'service_role');
create policy "admin_avatar_read"     on storage.objects for select using (bucket_id = 'avatars');
create policy "admin_avatar_svc"      on storage.objects for all using (bucket_id = 'avatars' and auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  12. CLASS GROUPS (กลุ่มเรียน)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists class_groups (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,            -- "ปวช.1/1", "ปวส.2/3"
  program     text,                     -- ปวช | ปวส
  grade       int,                      -- 1 | 2 | 3
  section     int,                      -- หมู่
  department  text,
  color       text default '#6366f1',
  created_at  timestamptz default now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  13. CLASS SCHEDULES (ตารางเรียน)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists class_schedules (
  id              uuid primary key default uuid_generate_v4(),
  class_group_id  uuid not null references class_groups(id) on delete cascade,
  room_name       text not null,
  subject         text,
  teacher         text,
  day_of_week     int  not null check (day_of_week between 1 and 7),  -- 1=จันทร์..7=อาทิตย์
  start_time      time not null,
  end_time        time not null,
  created_at      timestamptz default now()
);

create index on class_schedules (class_group_id);
create index on class_schedules (day_of_week, start_time, end_time);

alter table class_groups    enable row level security;
alter table class_schedules enable row level security;

create policy "class_groups_read"    on class_groups    for select using (true);
create policy "class_schedules_read" on class_schedules for select using (true);
create policy "svc_class_groups"     on class_groups    for all using (auth.role() = 'service_role');
create policy "svc_class_schedules"  on class_schedules for all using (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  14. TEACHERS (ครูผู้สอน)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists teachers (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  nickname    text,
  subject     text,        -- วิชาที่สอนหลัก
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz default now()
);

alter table teachers enable row level security;
create policy "teachers_read" on teachers for select using (true);
create policy "svc_teachers"  on teachers for all using (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  15. CLASS SCHEDULE OVERRIDES (แก้ตารางเฉพาะวัน)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists class_schedule_overrides (
  id              uuid primary key default uuid_generate_v4(),
  override_date   date not null,                              -- วันที่จริงที่เปลี่ยน
  class_group_id  uuid not null references class_groups(id) on delete cascade,
  start_time      time not null,                              -- ต้องตรงกับ class_schedules.start_time
  end_time        time not null,
  room_name       text,                                       -- null = ยกเลิกเรียน
  subject         text,
  teacher         text,
  note            text,                                       -- เหตุผล เช่น "ซ่อมห้อง", "ครูลา"
  created_at      timestamptz default now(),
  unique(override_date, class_group_id, start_time)          -- 1 override ต่อ 1 คาบต่อ 1 วัน
);

create index on class_schedule_overrides (override_date);
create index on class_schedule_overrides (class_group_id);

alter table class_schedule_overrides enable row level security;
create policy "overrides_read" on class_schedule_overrides for select using (true);
create policy "svc_overrides"  on class_schedule_overrides for all using (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  Seed: ห้อง sample
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
insert into rooms (name, description, capacity, location, amenities) values
  ('ห้องประชุม A', 'ห้องประชุมขนาดใหญ่', 20, 'อาคาร 1 ชั้น 2', array['projector','whiteboard','ac','wifi']),
  ('ห้องสมุด', 'ห้องอ่านหนังสือเงียบ', 30, 'อาคาร 2 ชั้น 1', array['wifi','ac']),
  ('ห้อง Lab คอมพิวเตอร์', 'มีคอมพิวเตอร์ 20 เครื่อง', 20, 'อาคาร 3 ชั้น 1', array['computer','projector','ac','wifi']),
  ('ห้องเรียน B201', 'ห้องเรียนขนาดกลาง', 40, 'อาคาร 2 ชั้น 2', array['projector','whiteboard','ac'])
on conflict do nothing;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  Seed: สินค้า sample
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
insert into products (tag, name, price, stock, unit, category, cost) values
  ('🍜', 'มาม่า', 6, 100, 'ซอง', 'อาหาร', 3.5),
  ('🥛', 'นมกล่อง', 12, 80, 'กล่อง', 'เครื่องดื่ม', 7),
  ('✏️', 'ดินสอ', 5, 200, 'แท่ง', 'เครื่องเขียน', 2),
  ('📓', 'สมุด 50 แผ่น', 20, 150, 'เล่ม', 'เครื่องเขียน', 12)
on conflict do nothing;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  16. CHANGE REQUESTS (นักเรียนขอแก้ไขข้อมูล)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists change_requests (
  id                uuid primary key default uuid_generate_v4(),
  student_id        text not null,
  requested_changes jsonb not null,
  status            text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note        text,
  reviewed_by       text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create or replace trigger cr_updated_at before update on change_requests
  for each row execute function set_updated_at();

alter table change_requests enable row level security;
create policy "cr_read"   on change_requests for select using (true);
create policy "cr_insert" on change_requests for insert with check (true);
create policy "svc_cr"    on change_requests for all using (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  17. NAME CHANGE REQUESTS (นักเรียนขอเปลี่ยนชื่อ)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create table if not exists name_change_requests (
  id             uuid primary key default uuid_generate_v4(),
  student_id     text not null,
  old_first_name text not null,
  old_last_name  text not null,
  new_first_name text not null,
  new_last_name  text not null,
  reason         text,
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note     text,
  reviewed_by    text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create or replace trigger ncr_updated_at before update on name_change_requests
  for each row execute function set_updated_at();

alter table name_change_requests enable row level security;
create policy "ncr_read"   on name_change_requests for select using (true);
create policy "ncr_insert" on name_change_requests for insert with check (true);
create policy "svc_ncr"    on name_change_requests for all using (auth.role() = 'service_role');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--  Migrations (รันหลังจาก schema เริ่มต้น)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE students DROP COLUMN IF EXISTS student_status;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS storage_folder text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_date text;
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;
-- ALTER TABLE admins ADD COLUMN IF NOT EXISTS linked_student_id text;
-- ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
-- ALTER TABLE feedback ADD CONSTRAINT feedback_status_check
--   CHECK (status IN ('pending','in_progress','resolved','rejected'));
-- ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
-- ALTER TABLE orders ADD CONSTRAINT orders_status_check
--   CHECK (status IN ('pending','paid','cancelled','refunded','delivered'));
-- ALTER TABLE students DROP COLUMN IF EXISTS parent_name;
-- ALTER TABLE students DROP COLUMN IF EXISTS parent_phone;
-- ALTER TABLE students DROP COLUMN IF EXISTS parent_line;
