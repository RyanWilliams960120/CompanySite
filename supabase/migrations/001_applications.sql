-- DracoinLabs mini ATS
-- Run this in the Supabase SQL Editor (or via the CLI) on the project
-- that backs the careers application system.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  location text,
  linkedin text NOT NULL,
  github text,
  portfolio text,
  experience_years integer NOT NULL,
  employment_type text,
  compensation text,
  availability text,
  cover_letter text,
  resume_filename text NOT NULL,
  resume_content_type text NOT NULL,
  resume_size integer NOT NULL,
  resume_storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT applications_status_check CHECK (status IN (
    'new',
    'screening',
    'assessment',
    'interview',
    'offer',
    'hired',
    'rejected'
  )),
  CONSTRAINT applications_experience_check CHECK (
    experience_years >= 0 AND experience_years <= 50
  ),
  CONSTRAINT applications_resume_size_check CHECK (
    resume_size > 0 AND resume_size <= 2097152
  )
);

CREATE INDEX IF NOT EXISTS applications_status_idx
  ON public.applications (status);

CREATE INDEX IF NOT EXISTS applications_position_idx
  ON public.applications (position);

CREATE INDEX IF NOT EXISTS applications_created_at_idx
  ON public.applications (created_at DESC);

CREATE INDEX IF NOT EXISTS applications_email_idx
  ON public.applications (lower(email));

CREATE INDEX IF NOT EXISTS applications_email_position_created_idx
  ON public.applications (lower(email), position, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_applications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_set_updated_at ON public.applications;
CREATE TRIGGER applications_set_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_applications_updated_at();

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Recreate with no policies so anon/authenticated clients cannot read
-- or write applications. The Vercel API uses the service role key, which
-- bypasses RLS. Do not add public SELECT/INSERT policies.

COMMENT ON TABLE public.applications IS
  'Candidate applications. Access only via the service-role API.';

-- Optional: create the private Storage bucket from SQL.
-- You can also create a private bucket named "resumes" in the Dashboard.
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO UPDATE SET public = false;
