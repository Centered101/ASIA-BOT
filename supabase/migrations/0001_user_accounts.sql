-- ============================================================
-- 0001 — Central identity table
--
-- Today every actor type has its own login story: `admins` has
-- username/password_hash, `students` authenticate with student_id + phone,
-- and `teachers` cannot log in at all (README calls it a display-only table).
-- The roadmap needs REGISTRAR / FINANCE / NURSE / ADVISOR / ... to log in,
-- which is not workable with one auth path per table.
--
-- `user_accounts` becomes the single login subject. admins / teachers /
-- students stay exactly as they are and become PROFILE tables pointing at it
-- through a NULLABLE account_id, so every existing query keeps working
-- untouched. Backfill is a separate migration (0002).
--
-- Additive only. Safe to run twice.
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

-- Case-insensitive uniqueness on login: `admins.username` is already stored
-- lowercased by the app, but student_id and email are not, and we must not
-- allow "Somchai" and "somchai" to be two accounts.
CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_login_lower_key
  ON public.user_accounts (lower(login));

-- Partial unique indexes, not plain UNIQUE: most rows will have NULL here and
-- we only want to prevent two accounts claiming the same Google identity.
CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_google_id_key
  ON public.user_accounts (google_id) WHERE google_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_google_email_key
  ON public.user_accounts (lower(google_email)) WHERE google_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_accounts_subject_type_idx
  ON public.user_accounts (subject_type);

-- Link columns on the existing profile tables. All NULLABLE so that nothing
-- currently in the database becomes invalid the moment this runs.
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS account_id uuid;

-- FKs added separately so re-running is cheap and a pre-existing constraint
-- does not abort the migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admins_account_id_fkey') THEN
    ALTER TABLE public.admins
      ADD CONSTRAINT admins_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_account_id_fkey') THEN
    ALTER TABLE public.teachers
      ADD CONSTRAINT teachers_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_account_id_fkey') THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.user_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- One profile row per account, per table.
CREATE UNIQUE INDEX IF NOT EXISTS admins_account_id_key
  ON public.admins (account_id) WHERE account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teachers_account_id_key
  ON public.teachers (account_id) WHERE account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS students_account_id_key
  ON public.students (account_id) WHERE account_id IS NOT NULL;

COMMENT ON TABLE public.user_accounts IS
  'Central login identity. admins/teachers/students are profile tables linked via their nullable account_id.';

-- ------------------------------------------------------------
-- SMOKE (expect: table exists, 0 rows, and 3 account_id columns)
--   SELECT count(*) FROM public.user_accounts;
--   SELECT table_name FROM information_schema.columns
--    WHERE column_name = 'account_id' AND table_schema = 'public';
-- ------------------------------------------------------------

-- ROLLBACK:
--   ALTER TABLE public.admins   DROP CONSTRAINT IF EXISTS admins_account_id_fkey;
--   ALTER TABLE public.teachers DROP CONSTRAINT IF EXISTS teachers_account_id_fkey;
--   ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_account_id_fkey;
--   DROP INDEX IF EXISTS public.admins_account_id_key;
--   DROP INDEX IF EXISTS public.teachers_account_id_key;
--   DROP INDEX IF EXISTS public.students_account_id_key;
--   ALTER TABLE public.admins   DROP COLUMN IF EXISTS account_id;
--   ALTER TABLE public.teachers DROP COLUMN IF EXISTS account_id;
--   ALTER TABLE public.students DROP COLUMN IF EXISTS account_id;
--   DROP TABLE IF EXISTS public.user_accounts;
