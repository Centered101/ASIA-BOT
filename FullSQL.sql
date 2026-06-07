-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.students (
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
  CONSTRAINT students_pkey PRIMARY KEY (id)
);
CREATE TABLE public.admins (
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
  CONSTRAINT admins_pkey PRIMARY KEY (id)
);
CREATE TABLE public.login_logs (
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
CREATE TABLE public.admin_logs (
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
CREATE TABLE public.attendance (
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
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type = ANY (ARRAY['comment'::text, 'report'::text])),
  name text,
  student_id text,
  email text,
  contact text,
  category text,
  message text NOT NULL,
  report_url text,
  image_urls ARRAY,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'resolved'::text, 'rejected'::text])),
  admin_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feedback_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tag text,
  stock integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  price numeric NOT NULL,
  images ARRAY,
  unit text DEFAULT 'ชิ้น'::text,
  category text,
  cost numeric,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.orders (
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
CREATE TABLE public.pay_logs (
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
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  capacity integer NOT NULL DEFAULT 10,
  location text,
  image_url text,
  amenities ARRAY,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'maintenance'::text, 'inactive'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rooms_pkey PRIMARY KEY (id)
);
CREATE TABLE public.time_slots (
  id integer NOT NULL DEFAULT nextval('time_slots_id_seq'::regclass),
  label text NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  CONSTRAINT time_slots_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bookings (
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
CREATE TABLE public.projects (
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
CREATE TABLE public.evaluations (
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
CREATE TABLE public.entry_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text,
  action text NOT NULL CHECK (action = ANY (ARRAY['in'::text, 'out'::text])),
  scanned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT entry_logs_pkey PRIMARY KEY (id),
  CONSTRAINT entry_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id)
);
CREATE TABLE public.class_groups (
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
CREATE TABLE public.class_schedules (
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
CREATE TABLE public.class_schedule_overrides (
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
CREATE TABLE public.teachers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  nickname text,
  subject text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teachers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.change_requests (
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
CREATE TABLE public.student_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id text,
  uid text NOT NULL UNIQUE,
  card_status text NOT NULL DEFAULT 'active'::text CHECK (card_status = ANY (ARRAY['active'::text, 'inactive'::text, 'lost'::text])),
  card_type text NOT NULL DEFAULT 'mifare'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_cards_pkey PRIMARY KEY (id),
  CONSTRAINT student_cards_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(student_id)
);
CREATE TABLE public.rfid_cards (
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
CREATE TABLE public.rfid_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  device_key text NOT NULL,
  name text,
  location text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rfid_devices_pkey PRIMARY KEY (id)
);
CREATE TABLE public.attendance_logs (
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
CREATE TABLE public.feedbacks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type = ANY (ARRAY['comment'::text, 'report'::text])),
  name text,
  contact text,
  category text NOT NULL,
  page text,
  message text NOT NULL,
  image_urls ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT feedbacks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.room_bookings (
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