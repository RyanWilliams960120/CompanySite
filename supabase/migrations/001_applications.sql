-- DracoinLabs mini ATS — Neon Postgres (Vercel Storage)
-- The apply API also creates this table automatically on first submit.
-- You only need to run this manually if you want to inspect the schema first.

CREATE TABLE IF NOT EXISTS applications (
  id uuid PRIMARY KEY,
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
  resume_bytes bytea NOT NULL,
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
    resume_size > 0 AND resume_size <= 4194304
  )
);

CREATE INDEX IF NOT EXISTS applications_status_idx ON applications (status);
CREATE INDEX IF NOT EXISTS applications_position_idx ON applications (position);
CREATE INDEX IF NOT EXISTS applications_created_at_idx ON applications (created_at DESC);
CREATE INDEX IF NOT EXISTS applications_email_idx ON applications (lower(email));
CREATE INDEX IF NOT EXISTS applications_email_position_created_idx
  ON applications (lower(email), position, created_at DESC);
