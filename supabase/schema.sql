-- ============================================================
-- Database Schema - asia-bot
-- Contains extensions, tables, constraints, indexes, realtime setup,
-- and security-related database objects only.
-- Storage bucket setup lives in supabase/storage.sql.
--
-- HOW THIS FILE IS MAINTAINED
-- supabase/migrations/NNNN_*.sql is the source of truth. This file is a
-- snapshot of the resulting state, kept so you can read the whole schema in
-- one place. Do not hand-edit it to introduce a change — write a migration,
-- then update this snapshot.
--
-- This revision was reconstructed from migrations 0001-0006 and 0009 (all
-- applied to production) and verified column-by-column against the live
-- database via PostgREST introspection. It is NOT a pg_dump. Replace it with
-- a real dump once 0007 and 0008 have run:
--   pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-privileges
--
-- Not yet reflected here, because those migrations are still pending:
--   0007 - COMMENT ON the deprecated tables (feedbacks, room_bookings,
--          teacher_applications)
--   0008 - republish admins to supabase_realtime without password_hash
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- Types
-- No custom enum/type definitions are required yet. Existing status values
-- are enforced with CHECK constraints to preserve current business logic.

-- Domains
-- No custom domains are required yet.

-- Tables and Constraints

CREATE TABLE IF NOT EXISTS public.students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id text NOT NULL UNIQUE,
  student_phone text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  program text NOT NULL DEFAULT 'ปวช'::text,
  entry_year text NOT NULL,
  nickname text,
  department text,
  uid text UNIQUE,
  card_status text NOT NULL DEFAULT 'inactive'::text CHECK (card_status = ANY (ARRAY['active'::text, 'inactive'::text, 'lost'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  photo_url text,
  line_user_id text,
  google_email text,
  google_id text,
  google_name text,
  google_avatar_url text,
  -- Added by 0001 (central identity) and 0006 (Student 360 core fields).
  -- student_status is the person's status; card_status above is the RFID card.
  account_id uuid,
  birth_date date,
  gender text CHECK (gender IS NULL OR gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])),
  national_id text,
  address text,
  student_status text NOT NULL DEFAULT 'studying'::text CHECK (student_status = ANY (ARRAY['studying'::text, 'on_leave'::text, 'transferred'::text, 'graduated'::text, 'resigned'::text, 'expelled'::text])),
  class_group_id uuid,
  advisor_teacher_id uuid,
  -- FKs for these three are declared at the end of the file, under
  -- "Deferred foreign keys", because their targets are created later.
  CONSTRAINT students_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  admin_id text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin'::text CHECK (role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'staff'::text])),
  first_name text,
  last_name text,
  nickname text,
  email text,
  phone text,
  entry_year text,
  department text,
  avatar text,
  admin_status text NOT NULL DEFAULT 'active'::text CHECK (admin_status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_at timestamp with time zone DEFAULT now(),
  username_changed_at timestamp with time zone,
  linked_student_id text,
  google_id text UNIQUE,
  google_email text UNIQUE,
  account_id uuid, -- 0001 — FK declared under "Deferred foreign keys"
  CONSTRAINT admins_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.line_notification_categories (
  key text NOT NULL,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT line_notification_categories_pkey PRIMARY KEY (key)
);
CREATE TABLE IF NOT EXISTS public.line_notification_channels (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  group_id text NOT NULL UNIQUE,
  name text NOT NULL,
  category_key text NOT NULL DEFAULT 'admin'::text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  last_seen_at timestamp with time zone,
  created_by text,
  updated_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT line_notification_channels_pkey PRIMARY KEY (id),
  CONSTRAINT line_notification_channels_category_key_fkey FOREIGN KEY (category_key) REFERENCES public.line_notification_categories(key) ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS public.login_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  log_time timestamp with time zone DEFAULT now(),
  student_id_attempt text,
  status text,
  reason text,
  ip_address text,
  user_agent text,
  platform text,
  language text,
  screen text,
  timezone text,
  referrer text,
  page_url text,
  touch_device boolean,
  CONSTRAINT login_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  log_time timestamp with time zone DEFAULT now(),
  admin_id_attempt text,
  status text,
  reason text,
  ip_address text,
  user_agent text,
  platform text,
  language text,
  screen text,
  timezone text,
  referrer text,
  page_url text,
  touch_device boolean,
  CONSTRAINT admin_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id text NOT NULL,
  location text NOT NULL DEFAULT 'school'::text CHECK (location = ANY (ARRAY['school'::text, 'library'::text, 'meeting'::text])),
  checkin_time timestamp with time zone,
  checkout_time timestamp with time zone,
  duration text,
  uid text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id)
);
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type = ANY (ARRAY['comment'::text, 'report'::text])),
  name text,
  student_id text,
  email text,
  contact text,
  category text,
  message text NOT NULL,
  report_url text,
  image_urls text[],
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'resolved'::text, 'rejected'::text])),
  admin_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tag text,
  stock integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  price numeric NOT NULL,
  images text[],
  unit text DEFAULT 'ชิ้น'::text,
  category text,
  colors text[],
  color_stock jsonb,
  cost numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  order_id text NOT NULL DEFAULT ('ORD-'::text || upper(substr(md5((random())::text), 1, 8))) UNIQUE,
  student_id text NOT NULL,
  student_name text NOT NULL,
  items_json jsonb NOT NULL,
  total numeric NOT NULL,
  pi_id text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'refunded'::text, 'delivered'::text])),
  delivery_mode text DEFAULT 'pickup'::text CHECK (delivery_mode = ANY (ARRAY['pickup'::text, 'delivery'::text])),
  delivery_loc text,
  delivery_slot text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.pay_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  log_ts timestamp with time zone DEFAULT now(),
  order_id text,
  student_id text,
  total numeric,
  pi_id text,
  stripe_status text,
  status text,
  note text,
  CONSTRAINT pay_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  capacity integer NOT NULL DEFAULT 10,
  location text,
  image_url text,
  amenities text[],
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'maintenance'::text, 'inactive'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rooms_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.time_slots (
  id integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  label text NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  CONSTRAINT time_slots_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL,
  slot_id integer NOT NULL,
  booking_date date NOT NULL,
  student_id text NOT NULL,
  student_name text NOT NULL,
  student_phone text,
  purpose text NOT NULL,
  attendees integer DEFAULT 1,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])),
  admin_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT bookings_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.time_slots(id)
);
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  poster_url text,
  demo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  primary_color text,
  bg_image_url text,
  logo_url text,
  bg_size text DEFAULT 'cover'::text,
  mascot_url text,
  mascot_msg_welcome text,
  mascot_msg_thanks text,
  bg_color text,
  bg_overlay text,
  bg_repeat text DEFAULT 'no-repeat'::text,
  custom_fields jsonb,
  storage_folder text,
  project_date text,
  CONSTRAINT projects_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid,
  gender text,
  evaluator text,
  name text,
  emoji integer CHECK (emoji >= 1 AND emoji <= 3),
  creative integer CHECK (creative >= 1 AND creative <= 5),
  content integer CHECK (content >= 1 AND content <= 5),
  presentation integer CHECK (presentation >= 1 AND presentation <= 5),
  usability integer CHECK (usability >= 1 AND usability <= 5),
  overall integer CHECK (overall >= 1 AND overall <= 5),
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT evaluations_pkey PRIMARY KEY (id),
  CONSTRAINT evaluations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE IF NOT EXISTS public.entry_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text,
  action text NOT NULL CHECK (action = ANY (ARRAY['in'::text, 'out'::text])),
  scanned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT entry_logs_pkey PRIMARY KEY (id),
  CONSTRAINT entry_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id)
);
CREATE TABLE IF NOT EXISTS public.class_groups (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  program text,
  grade integer,
  section integer,
  department text,
  color text DEFAULT '#6366f1'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT class_groups_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.class_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_group_id uuid NOT NULL,
  room_name text NOT NULL,
  subject text,
  teacher text,
  day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT class_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT class_schedules_class_group_id_fkey FOREIGN KEY (class_group_id) REFERENCES public.class_groups(id)
);
CREATE TABLE IF NOT EXISTS public.class_schedule_overrides (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  override_date date NOT NULL,
  class_group_id uuid NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  room_name text,
  subject text,
  teacher text,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT class_schedule_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT class_schedule_overrides_class_group_id_fkey FOREIGN KEY (class_group_id) REFERENCES public.class_groups(id)
);
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  nickname text,
  subject text,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'approved'::text, 'rejected'::text, 'active'::text, 'inactive'::text])),
  email text,
  department text,
  color text,
  reason text,
  desired_username text,
  linked_admin_id text,
  admin_note text,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  desired_password_hash text,
  account_id uuid, -- 0001 — this is what lets teachers log in for the first time
  CONSTRAINT teachers_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.change_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  student_id text NOT NULL,
  requested_changes jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  admin_note text,
  reviewed_by text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT change_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.student_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text,
  uid text NOT NULL UNIQUE,
  card_status text NOT NULL DEFAULT 'active'::text CHECK (card_status = ANY (ARRAY['active'::text, 'inactive'::text, 'lost'::text])),
  card_type text NOT NULL DEFAULT 'mifare'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_cards_pkey PRIMARY KEY (id),
  CONSTRAINT student_cards_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id)
);
CREATE TABLE IF NOT EXISTS public.rfid_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  uid text NOT NULL UNIQUE,
  card_type text NOT NULL DEFAULT 'mifare'::text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'lost'::text])),
  issued_at timestamp with time zone DEFAULT now(),
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rfid_cards_pkey PRIMARY KEY (id),
  CONSTRAINT rfid_cards_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id)
);
CREATE TABLE IF NOT EXISTS public.rfid_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  device_key text NOT NULL,
  name text,
  location text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rfid_devices_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text,
  uid text NOT NULL,
  location text NOT NULL,
  check_in timestamp with time zone,
  check_out timestamp with time zone,
  duration_minutes integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id)
);
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type = ANY (ARRAY['comment'::text, 'report'::text])),
  name text,
  contact text,
  category text NOT NULL,
  page text,
  message text NOT NULL,
  image_urls text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feedbacks_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.room_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  booker_name text NOT NULL,
  booker_phone text,
  purpose text NOT NULL,
  date date NOT NULL,
  time_start time without time zone NOT NULL,
  time_end time without time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])),
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT room_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT room_bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id)
);
CREATE TABLE IF NOT EXISTS public.qq_stores (
  id integer NOT NULL,
  name text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  color1 text NOT NULL,
  color2 text NOT NULL,
  CONSTRAINT qq_stores_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.qq_menu_items (
  id integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  store_id integer,
  name text NOT NULL,
  category text DEFAULT 'ทั่วไป'::text,
  price numeric NOT NULL,
  image text DEFAULT ''::text,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT qq_menu_items_pkey PRIMARY KEY (id),
  CONSTRAINT qq_menu_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.qq_stores(id)
);
CREATE TABLE IF NOT EXISTS public.qq_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  table_num text NOT NULL,
  customer_name text DEFAULT '-'::text,
  total numeric NOT NULL,
  notes text DEFAULT '-'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT qq_orders_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.qq_order_items (
  id integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  order_id uuid,
  store_id integer NOT NULL,
  item_name text NOT NULL,
  price numeric NOT NULL,
  quantity integer NOT NULL,
  image text DEFAULT ''::text,
  CONSTRAINT qq_order_items_pkey PRIMARY KEY (id),
  CONSTRAINT qq_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.qq_orders(id)
);
CREATE TABLE IF NOT EXISTS public.qq_store_order_status (
  id integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  order_id uuid,
  store_id integer NOT NULL,
  status text DEFAULT 'pending'::text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT qq_store_order_status_pkey PRIMARY KEY (id),
  CONSTRAINT qq_store_order_status_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.qq_orders(id)
);
CREATE TABLE IF NOT EXISTS public.qman_categories (
  id integer NOT NULL,
  name text NOT NULL,
  icon text NOT NULL,
  color_from text NOT NULL,
  color_to text NOT NULL,
  CONSTRAINT qman_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.qman_shops (
  id integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  category_id integer,
  name text NOT NULL,
  branch text NOT NULL,
  logo_url text DEFAULT ''::text,
  map_url text DEFAULT ''::text,
  price_per_booking numeric DEFAULT 0,
  badge text DEFAULT ''::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT qman_shops_pkey PRIMARY KEY (id),
  CONSTRAINT qman_shops_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.qman_categories(id)
);
CREATE TABLE IF NOT EXISTS public.qman_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  wallet_balance numeric DEFAULT 500,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT qman_users_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.qman_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  queue_number text NOT NULL,
  user_id uuid,
  shop_id integer,
  shop_name text NOT NULL,
  shop_branch text NOT NULL,
  shop_logo text DEFAULT ''::text,
  shop_map text DEFAULT ''::text,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  booking_date date NOT NULL,
  booking_time time without time zone NOT NULL,
  notes text DEFAULT ''::text,
  price numeric NOT NULL,
  status text DEFAULT 'รอรับบริการ'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT qman_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT qman_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.qman_users(id),
  CONSTRAINT qman_bookings_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.qman_shops(id)
);
CREATE TABLE IF NOT EXISTS public.teacher_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  department text,
  subject text,
  reason text NOT NULL,
  desired_username text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'approved'::text, 'rejected'::text])),
  admin_note text,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teacher_applications_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.name_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  old_first_name text NOT NULL,
  old_last_name text NOT NULL,
  new_first_name text NOT NULL,
  new_last_name text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  admin_note text,
  reviewed_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT name_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT name_change_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id)
);
CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_conversations_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text,
  channel text NOT NULL,
  user_id text,
  user_role text,
  user_message text NOT NULL,
  tools_called jsonb DEFAULT '[]'::jsonb,
  response text,
  latency_ms integer,
  error text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.equipment_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asset_code text,
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'ชิ้น'::text,
  total_quantity integer NOT NULL DEFAULT 1 CHECK (total_quantity >= 0),
  available_quantity integer NOT NULL DEFAULT 1 CHECK (available_quantity >= 0),
  image_url text,
  description text,
  active boolean NOT NULL DEFAULT true,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  department text,
  CONSTRAINT equipment_items_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.equipment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_code text NOT NULL,
  equipment_item_id uuid NOT NULL,
  student_id text,
  department text NOT NULL,
  requester_name text NOT NULL,
  requester_phone text,
  quantity integer NOT NULL CHECK (quantity > 0),
  purpose text,
  borrow_date date NOT NULL,
  due_date date NOT NULL,
  returned_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'picked_up'::text, 'rejected'::text, 'cancelled'::text, 'returned'::text])),
  admin_note text,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  delivery_mode text NOT NULL DEFAULT 'pickup'::text CHECK (delivery_mode = ANY (ARRAY['pickup'::text, 'delivery'::text])),
  delivery_loc text,
  time_slot text,
  picked_up_at timestamp with time zone,
  CONSTRAINT equipment_requests_pkey PRIMARY KEY (id),
  CONSTRAINT equipment_requests_equipment_item_id_fkey FOREIGN KEY (equipment_item_id) REFERENCES public.equipment_items(id)
);

-- ============================================================
-- Phase 1 foundation (supabase/migrations/0001, 0003, 0004, 0005)
-- Central identity, role-based access control, sessions, and audit trail.
-- user_accounts is the login subject; admins/teachers/students are profiles
-- that hang off it via a nullable account_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  -- login is the username / student_id / email used to sign in.
  login text NOT NULL,
  password_hash text,
  google_id text,
  google_email text,
  -- Which profile table this account primarily maps to.
  subject_type text NOT NULL CHECK (subject_type = ANY (ARRAY['admin'::text, 'teacher'::text, 'student'::text, 'parent'::text, 'alumni'::text])),
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])),
  last_login_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_accounts_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_login_lower_key
CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_google_id_key
CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_google_email_key
CREATE INDEX IF NOT EXISTS user_accounts_subject_type_idx
CREATE UNIQUE INDEX IF NOT EXISTS admins_account_id_key
CREATE UNIQUE INDEX IF NOT EXISTS teachers_account_id_key
CREATE UNIQUE INDEX IF NOT EXISTS students_account_id_key

CREATE TABLE IF NOT EXISTS public.roles (
  key text NOT NULL,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (key)
);
CREATE TABLE IF NOT EXISTS public.permissions (
  key text NOT NULL,
  label text NOT NULL,
  module text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (key)
);
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_key text NOT NULL,
  permission_key text NOT NULL,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_key, permission_key),
  CONSTRAINT role_permissions_role_key_fkey
    FOREIGN KEY (role_key) REFERENCES public.roles(key) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_key_fkey
    FOREIGN KEY (permission_key) REFERENCES public.permissions(key) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  role_key text NOT NULL,
  -- scope_type/scope_id narrow a role to one object. ADVISOR scoped to a
  -- class_group is what makes "ครูที่ปรึกษาเห็นเฉพาะนักเรียนในห้องตัวเอง"
  -- possible without another schema change in Phase 6.
  scope_type text CHECK (scope_type IS NULL OR scope_type = ANY (ARRAY['class_group'::text, 'department'::text, 'room'::text])),
  scope_id text,
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_role_key_fkey
    FOREIGN KEY (role_key) REFERENCES public.roles(key) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT user_roles_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES public.user_accounts(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_unique_grant
CREATE INDEX IF NOT EXISTS user_roles_account_id_idx ON public.user_roles (account_id);

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  -- SHA-256 of the token. Never store the token itself.
  token_hash text NOT NULL,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  ip_address text,
  user_agent text,
  CONSTRAINT auth_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT auth_sessions_token_hash_key UNIQUE (token_hash),
  CONSTRAINT auth_sessions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS auth_sessions_account_id_idx ON public.auth_sessions (account_id);
CREATE INDEX IF NOT EXISTS auth_sessions_active_idx

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Nullable: break-glass env-superadmin actions have no account row, and we
  -- would rather record the action with actor_label than drop it entirely.
  actor_account_id uuid,
  actor_label text,
  actor_role text,
  -- Dotted verb, e.g. 'product.create', 'student.update', 'role.grant'.
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_account_id_fkey
    FOREIGN KEY (actor_account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
CREATE INDEX IF NOT EXISTS audit_logs_action_idx


-- ============================================================
-- Deferred foreign keys
-- Declared here rather than inline because each target table is created
-- later in this file. Mirrors how migrations 0001 and 0006 added them.
-- ============================================================
ALTER TABLE public.admins
  DROP CONSTRAINT IF EXISTS admins_account_id_fkey,
  ADD CONSTRAINT admins_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.teachers
  DROP CONSTRAINT IF EXISTS teachers_account_id_fkey,
  ADD CONSTRAINT teachers_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_account_id_fkey,
  ADD CONSTRAINT students_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS students_class_group_id_fkey,
  ADD CONSTRAINT students_class_group_id_fkey
  FOREIGN KEY (class_group_id) REFERENCES public.class_groups(id) ON DELETE SET NULL,
  DROP CONSTRAINT IF EXISTS students_advisor_teacher_id_fkey,
  ADD CONSTRAINT students_advisor_teacher_id_fkey
  FOREIGN KEY (advisor_teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Functions
-- No custom SQL functions are required yet.

-- Triggers
-- No custom SQL triggers are required yet.

-- Views
-- No views are required yet.

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS line_notification_channels_one_default_per_category
  ON public.line_notification_channels (category_key)
  WHERE is_active = true AND is_default = true;

-- Enable RLS
-- RLS is intentionally not enabled in this refactor because the existing
-- application relies on API routes and service-role operations. Enabling RLS
-- should be handled in focused migrations with route-by-route tests.

-- Policies
-- No public table RLS policies are created in this refactor.

-- Grants
-- Default Supabase grants are preserved.

-- Enable Supabase Realtime for admin pages that need immediate cross-admin updates.
DO $$
DECLARE
  realtime_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH realtime_table IN ARRAY ARRAY[
      'students',
      'admins',
      'login_logs',
      'admin_logs',
      'attendance',
      'attendance_logs',
      'entry_logs',
      'feedback',
      'feedbacks',
      'products',
      'orders',
      'pay_logs',
      'rooms',
      'time_slots',
      'bookings',
      'room_bookings',
      'projects',
      'evaluations',
      'class_groups',
      'class_schedules',
      'class_schedule_overrides',
      'teachers',
      'teacher_applications',
      'change_requests',
      'name_change_requests',
      'student_cards',
      'rfid_cards',
      'rfid_devices',
      'equipment_items',
      'equipment_requests',
      'line_notification_categories',
      'line_notification_channels'
    ]
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = realtime_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', realtime_table);
      END IF;
    END LOOP;
  END IF;
END $$;
