-- ================================================================
-- ASIA-BOT Supabase Schema
-- ================================================================

-- Students table
create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  student_id    text unique not null,
  first_name    text not null,
  last_name     text not null,
  nickname      text,
  department    text not null,
  program       text not null check (program in ('ปวช', 'ปวส')),
  entry_year    integer not null,
  student_phone text not null,
  student_status text not null default 'active' check (student_status in ('active', 'inactive', 'graduated')),
  card_status   text not null default 'pending' check (card_status in ('pending', 'approved', 'rejected')),
  uid           text,
  parent_name   text,
  parent_phone  text,
  parent_line   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Projects table
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  year        integer not null,
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
  room_name   text not null,
  building    text not null,
  floor       integer not null default 1,
  status      text not null default 'available' check (status in ('available', 'occupied', 'reserved', 'closed')),
  subject     text,
  teacher     text,
  updated_at  timestamptz not null default now()
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

-- Feedbacks table
create table if not exists public.feedbacks (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('comment', 'report')),
  name        text,
  contact     text,
  category    text not null,
  page        text,
  message     text not null,
  image_urls  text[],
  created_at  timestamptz not null default now()
);

-- Room bookings table
create table if not exists public.room_bookings (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  booker_name   text not null,
  booker_phone  text,
  purpose       text not null,
  date          date not null,
  time_start    time not null,
  time_end      time not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note          text,
  created_at    timestamptz not null default now(),
  constraint chk_time_order check (time_end > time_start)
);

create index if not exists idx_room_bookings_room_date on public.room_bookings (room_id, date);

-- ================================================================
-- Seed: Projects (matching PROJECTS in config.ts)
-- ================================================================
insert into public.projects (name, slug, year) values
  ('ตู้กดอเนกประสงค์', 'project-1', 2024),
  ('คุกกี้โปรตีนจิ้งหรีด', 'project-2', 2024),
  ('ไม้เท้าเลเซอร์สตาฟ์', 'project-3', 2024),
  ('รีวิวผู้พิทักษ์', 'project-4', 2025),
  ('ระบบเช็กสถานะห้องเรียนแบบเรียลไทม์', 'project-5', 2026),
  ('พัฒนาท้องถิ่น', 'project-6', 2026)
on conflict (slug) do nothing;

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
