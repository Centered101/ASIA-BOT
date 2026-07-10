-- Create the first superadmin account.
-- Change username/password/name before running this in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO public.admins (
  admin_id,
  username,
  password_hash,
  role,
  admin_status,
  first_name,
  last_name,
  nickname,
  email,
  phone,
  created_at
)
SELECT
  'ADM-' || floor(extract(epoch from now()) * 1000)::bigint::text,
  lower('admin'),
  crypt('Admin123456', gen_salt('bf', 12)),
  'superadmin',
  'active',
  'Admin',
  NULL,
  'Admin',
  NULL,
  NULL,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.admins
);
