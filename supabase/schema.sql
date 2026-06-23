-- ================================================================
-- ASIA-BOT Supabase Schema
-- ================================================================

-- Students table
create table if not exists public.students (
  id              uuid primary key default gen_random_uuid(),
  student_id      text unique not null,
  student_phone   text not null,
  first_name      text not null,
  last_name       text not null,
  program         text not null default 'ปวช' check (program in ('ปวช', 'ปวส')),
  entry_year      text not null,
  nickname        text,
  department      text,
  uid             text unique,
  card_status     text not null default 'inactive' check (card_status in ('active', 'inactive', 'lost')),
  photo_url       text,
  line_user_id    text,
  google_email    text,
  google_id       text,
  google_name     text,
  google_avatar_url text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Student RFID cards table
create table if not exists public.student_cards (
  id          uuid primary key default gen_random_uuid(),
  student_id  text references public.students(student_id) on delete cascade,
  uid         text unique not null,
  card_status text not null default 'active' check (card_status in ('active', 'inactive', 'lost')),
  card_type   text not null default 'mifare',
  created_at  timestamptz not null default now()
);

create index if not exists idx_student_cards_student_id on public.student_cards (student_id);

-- Production RFID cards table
create table if not exists public.rfid_cards (
  id          uuid primary key default gen_random_uuid(),
  student_id  text not null references public.students(student_id) on delete cascade,
  uid         text not null unique,
  card_type   text not null default 'mifare',
  status      text not null default 'active' check (status in ('active', 'inactive', 'lost')),
  issued_at   timestamptz default now(),
  revoked_at  timestamptz,
  created_at  timestamptz default now()
);

create index if not exists idx_rfid_cards_student_id on public.rfid_cards (student_id);
create index if not exists idx_rfid_cards_status on public.rfid_cards (status);

-- RFID devices table
create table if not exists public.rfid_devices (
  id          uuid primary key default gen_random_uuid(),
  device_id   text unique not null,
  device_key  text not null,
  name        text,
  location    text,
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz default now()
);

-- RFID attendance sessions table
create table if not exists public.attendance_logs (
  id               uuid primary key default gen_random_uuid(),
  student_id       text references public.students(student_id),
  uid              text not null,
  location         text not null,
  check_in         timestamptz,
  check_out        timestamptz,
  duration_minutes int,
  created_at       timestamptz default now()
);

create index if not exists idx_attendance_logs_open
  on public.attendance_logs (student_id, uid, location, check_out);

create index if not exists idx_attendance_logs_created_at
  on public.attendance_logs (created_at desc);

-- Projects table
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  project_date text,
  poster_url  text,
  demo_url    text,
  created_at  timestamptz not null default now()
);

-- Evaluations table
create table if not exists public.evaluations (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete cascade,
  gender        text,
  evaluator     text,
  name          text,
  emoji         integer check (emoji between 1 and 3),
  creative      integer check (creative between 1 and 5),
  content       integer check (content between 1 and 5),
  presentation  integer check (presentation between 1 and 5),
  usability     integer check (usability between 1 and 5),
  overall       integer check (overall between 1 and 5),
  comments      text,
  created_at    timestamptz not null default now()
);

-- Rooms table
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  capacity    integer not null default 10,
  location    text,
  image_url   text,
  amenities   text[],
  status      text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  created_at  timestamptz default now()
);

-- Entry logs table
create table if not exists public.entry_logs (
  id          uuid primary key default gen_random_uuid(),
  student_id  text references public.students(student_id) on delete set null,
  action      text not null check (action in ('in', 'out')),
  scanned_at  timestamptz not null default now()
);

-- Login logs table
create table if not exists public.login_logs (
  id                uuid primary key default gen_random_uuid(),
  student_id_attempt text not null,
  status            text not null check (status in ('success', 'failed')),
  reason            text,
  ip_address        text,
  user_agent        text,
  created_at        timestamptz not null default now()
);

-- Feedback table
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('comment', 'report')),
  name        text,
  student_id  text references public.students(student_id) on delete set null,
  email       text,
  contact     text,
  category    text,
  report_url  text,
  message     text not null,
  image_urls  text[],
  status      text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved', 'rejected')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Time slots table (ช่วงเวลาจองห้อง)
create sequence if not exists time_slots_id_seq;
create table if not exists public.time_slots (
  id         integer primary key default nextval('time_slots_id_seq'),
  label      text not null,
  start_time time not null,
  end_time   time not null
);

-- ================================================================
-- Teachers (รวมข้อมูลครูผู้สอน + ใบสมัครเป็นครู)
-- ================================================================
-- status values:
--   pending / reviewing / approved / rejected  = ใบสมัครจาก /become-teacher
--   active / inactive                          = ครูที่ admin เพิ่มโดยตรง หรืออนุมัติแล้ว
--
-- Migration จากตารางเก่า (มี name, active):
-- alter table public.teachers rename column name to full_name;
-- alter table public.teachers add column if not exists status text not null default 'active'
--   check (status in ('pending','reviewing','approved','rejected','active','inactive'));
-- alter table public.teachers add column if not exists email text;
-- alter table public.teachers add column if not exists department text;
-- alter table public.teachers add column if not exists color text;
-- alter table public.teachers add column if not exists reason text;
-- alter table public.teachers add column if not exists desired_username text;
-- alter table public.teachers add column if not exists linked_admin_id text;
-- alter table public.teachers add column if not exists admin_note text;
-- alter table public.teachers add column if not exists reviewed_by text;
-- alter table public.teachers add column if not exists reviewed_at timestamptz;
-- alter table public.teachers add column if not exists updated_at timestamptz default now();
-- update public.teachers set status = case when active then 'active' else 'inactive' end;
-- alter table public.teachers drop column if exists active;
create table if not exists public.teachers (
  id                  uuid        primary key default gen_random_uuid(),

  -- ข้อมูลส่วนตัว
  full_name           text        not null,
  nickname            text,
  email               text,
  phone               text,
  department          text,

  -- วิชาและการสอน (สำหรับระบบตารางเรียน)
  subject             text,         -- วิชาหลักที่แสดงในตาราง
  color               text,         -- สีใน timetable เช่น "#4f46e5" (optional)

  -- สถานะ
  status              text        not null default 'active'
                      check (status in ('pending', 'reviewing', 'approved', 'rejected', 'active', 'inactive')),

  -- ข้อมูลการสมัคร (null = เพิ่มโดย admin โดยตรง ไม่ผ่านการสมัคร)
  reason              text,
  desired_username    text,

  -- บัญชี Admin ที่สร้างหลังอนุมัติ
  linked_admin_id     text,

  -- Admin review
  admin_note          text,
  reviewed_by         text,         -- admin_id ของผู้ตรวจสอบ
  reviewed_at         timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_teachers_status     on public.teachers (status);
create index if not exists idx_teachers_department on public.teachers (department);

-- ================================================================
-- Migration: ถ้ามีข้อมูลเก่าในตาราง teachers (ชื่อ name) หรือ teacher_applications
-- ================================================================
-- INSERT INTO public.teachers (full_name, nickname, subject, phone, status)
--   SELECT name, nickname, subject, phone, CASE WHEN active THEN 'active' ELSE 'inactive' END
--   FROM public.teachers_old;  -- ก็อปข้อมูลเก่า (ถ้ามี)

-- ================================================================
-- Class Groups (กลุ่มเรียน)
-- ================================================================
create table if not exists public.class_groups (
  id          uuid    primary key default gen_random_uuid(),
  name        text    not null,
  program     text    check (program in ('ปวช', 'ปวส')),
  grade       integer,              -- ชั้นปี เช่น 1, 2, 3
  section     integer,              -- ห้อง/กลุ่ม เช่น 1, 2
  department  text,
  color       text    default '#6366f1',
  created_at  timestamptz default now()
);

-- ================================================================
-- Class Schedules (ตารางสอน)
-- ================================================================
create table if not exists public.class_schedules (
  id             uuid    primary key default gen_random_uuid(),
  class_group_id uuid    not null references public.class_groups(id) on delete cascade,
  room_name      text    not null,
  subject        text,
  teacher        text,
  day_of_week    integer not null check (day_of_week between 1 and 7),
  start_time     time    not null,
  end_time       time    not null,
  created_at     timestamptz default now()
);

create index if not exists idx_class_schedules_group on public.class_schedules (class_group_id);
create index if not exists idx_class_schedules_day   on public.class_schedules (day_of_week);

-- ================================================================
-- Class Schedule Overrides (วันพิเศษ / ยกเลิกคาบ)
-- ================================================================
create table if not exists public.class_schedule_overrides (
  id             uuid  primary key default gen_random_uuid(),
  override_date  date  not null,
  class_group_id uuid  not null references public.class_groups(id) on delete cascade,
  start_time     time  not null,
  end_time       time  not null,
  room_name      text,             -- null = ยกเลิกคาบนี้
  subject        text,
  teacher        text,
  note           text,
  created_at     timestamptz default now(),
  unique (override_date, class_group_id, start_time)
);

-- ================================================================
-- Admins table
-- ================================================================
create table if not exists public.admins (
  id           uuid primary key default gen_random_uuid(),
  admin_id     text unique not null,
  username     text unique not null,
  password_hash text not null,
  role         text not null default 'admin' check (role in ('superadmin', 'admin', 'staff')),
  first_name   text,
  last_name    text,
  nickname     text,
  email        text,
  phone        text,
  entry_year   text,
  department   text,
  avatar       text,
  admin_status text not null default 'active' check (admin_status in ('active', 'inactive')),
  linked_student_id text,
  google_id    text unique,               -- Google account ID (สำหรับ login ด้วย Google)
  google_email text unique,               -- Google email ที่ผูกไว้
  created_at   timestamptz default now(),
  username_changed_at timestamptz
);

-- Migration: เพิ่ม google columns ใน admins ที่มีอยู่แล้ว
-- alter table public.admins add column if not exists google_id    text unique;
-- alter table public.admins add column if not exists google_email text unique;

-- ================================================================
-- Products table (สหกรณ์)
-- ================================================================
create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  price      numeric not null,
  cost       numeric,
  stock      integer not null default 0,
  unit       text default 'ชิ้น',
  category   text,
  tag        text,
  images     text[],
  active     boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

-- ================================================================
-- Orders table (คำสั่งซื้อสหกรณ์)
-- ================================================================
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_id        text unique not null default ('ORD-' || upper(substr(md5(random()::text), 1, 8))),
  student_id      text not null references public.students(student_id) on delete restrict,
  student_name    text not null,
  student_photo_url text,
  items_json      jsonb not null,
  total           numeric not null,
  pi_id           text,
  status          text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'refunded', 'delivered')),
  delivery_mode   text default 'pickup' check (delivery_mode in ('pickup', 'delivery')),
  delivery_loc    text,
  delivery_slot   text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_orders_student_id on public.orders (student_id);
create index if not exists idx_orders_status     on public.orders (status);

-- ================================================================
-- Bookings table (จองห้อง)
-- ================================================================
create table if not exists public.bookings (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id),
  slot_id       integer not null references public.time_slots(id),
  booking_date  date not null,
  student_id    text not null references public.students(student_id),
  student_name  text not null,
  student_phone text,
  purpose       text not null,
  attendees     integer default 1,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_bookings_room_date on public.bookings (room_id, booking_date);
create index if not exists idx_bookings_status    on public.bookings (status);
create index if not exists idx_bookings_student   on public.bookings (student_id);

-- ================================================================
-- Change requests table (คำขอแก้ไขข้อมูลนักเรียน)
-- ================================================================
create table if not exists public.change_requests (
  id          uuid primary key default gen_random_uuid(),
  student_id  text not null references public.students(student_id) on delete cascade,
  changes     jsonb not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note  text,
  reviewed_by text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_change_requests_student on public.change_requests (student_id);
create index if not exists idx_change_requests_status  on public.change_requests (status);

-- ================================================================
-- Name change requests table
-- ================================================================
create table if not exists public.name_change_requests (
  id             uuid primary key default gen_random_uuid(),
  student_id     text not null references public.students(student_id) on delete cascade,
  old_first_name text not null,
  old_last_name  text not null,
  new_first_name text not null,
  new_last_name  text not null,
  reason         text,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note     text,
  reviewed_by    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ================================================================
-- Row Level Security (optional — enable for production)
-- ================================================================
-- alter table public.students enable row level security;
-- alter table public.evaluations enable row level security;
-- alter table public.rooms enable row level security;
-- alter table public.entry_logs enable row level security;
-- alter table public.login_logs enable row level security;

-- Public read for evaluations (anyone can evaluate)
-- create policy "allow insert evaluations" on public.evaluations for insert with check (true);
-- create policy "allow read evaluations" on public.evaluations for select using (true);
