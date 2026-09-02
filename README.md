# DracoinLabs website and careers ATS

Marketing site for [DracoinLabs](https://www.dracoinlabs.com), plus a private recruiting workflow for the Careers page.

Candidates apply at `/careers` and `/careers/apply`. Applications are validated by `/api/apply`, stored in Supabase (PostgreSQL + private Storage), and emailed to recruiting with Resend. Recruiters review applications at `/admin/applications`.

Do not put secrets in this repository. Use environment variables only.

## 1. Create the Supabase project

1. Sign in at [https://supabase.com](https://supabase.com) and create a project.
2. Open **Project Settings → API**.
3. Copy the project URL (`SUPABASE_URL`) and the **service role** key (`SUPABASE_SERVICE_ROLE_KEY`).
4. Never put the service role key in HTML, `js/`, or any other browser-side file. It bypasses Row Level Security.

## 2. Create the PostgreSQL table

In the Supabase SQL Editor, run `supabase/migrations/001_applications.sql`.

That script creates `public.applications` with a UUID primary key, default status `new`, recruiter search indexes, Row Level Security (no public policies), and an optional private Storage bucket named `resumes`.

If the `storage.buckets` insert fails, create the bucket in the Dashboard instead (step 3). The table and indexes are still valid.

## 3. Create the private `resumes` storage bucket

If the SQL did not create it:

1. Open **Storage → New bucket**.
2. Name: `resumes`
3. Public bucket: **off**
4. File size limit: `2 MB` (2097152 bytes)
5. Allowed MIME types (optional extra guard):
   - `application/pdf`
   - `application/msword`
   - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Do not add Storage policies that allow `anon` or `authenticated` to read or write this bucket. The API uses the service role key on the server.

CVs are stored as `{application_id}/{safe_filename}` inside the `resumes` bucket.

## 4. Configure Resend

1. Create an account at [https://resend.com](https://resend.com).
2. Verify the sending domain (for example `dracoinlabs.com`).
3. Create an API key (`RESEND_API_KEY`).
4. Set `RESEND_FROM` to a verified sender, for example `DracoinLabs Careers <careers@dracoinlabs.com>`.
5. Set `CAREERS_EMAIL` to the recruiting inbox that should receive new-application notices.

Until the domain is verified, Resend may only deliver to the Resend account email.

The candidate still sees success if the database record was saved, even when email delivery fails. Check Vercel function logs for `[careers-apply] email-failed` and retry manually from the dashboard if needed.

The API also rejects a second application from the same email address for the same position within 24 hours.

## 5. Required environment variables

Copy `.env.example` to `.env` for local development. `.env` is gitignored.

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=resumes
RESEND_API_KEY=
RESEND_FROM=
CAREERS_EMAIL=
APP_BASE_URL=
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
ALLOWED_ORIGIN=
```

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by Vercel functions |
| `SUPABASE_STORAGE_BUCKET` | Private bucket name (`resumes`) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | Verified From address |
| `CAREERS_EMAIL` | Recruiting inbox |
| `APP_BASE_URL` | Public site origin, no trailing slash, e.g. `https://www.dracoinlabs.com` |
| `ADMIN_USERNAME` | Recruiter dashboard username |
| `ADMIN_PASSWORD` | Recruiter dashboard password |
| `ADMIN_SESSION_SECRET` | Long random string used to sign the HttpOnly session cookie (32+ characters) |
| `ALLOWED_ORIGIN` | Optional extra CORS origin(s), comma-separated |

SMTP variables (`EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`) are no longer used.

## 6. Configure those variables in Vercel

1. Open the Vercel project → **Settings → Environment Variables**.
2. Add every variable from the table above for Production (and Preview if you test preview deploys).
3. Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_PASSWORD`, or `ADMIN_SESSION_SECRET` with a `NEXT_PUBLIC_` / `VITE_` prefix, and do not reference them from `js/`.
4. Redeploy after saving variables so serverless functions receive them.

## 7. Run locally

Requirements: Node.js 18+ and the Vercel CLI.

```bash
npm install
npx vercel login
copy .env.example .env
```

Fill `.env` with real values, then:

```bash
npx vercel dev
```

The site is typically at `http://localhost:3000`. Open `/careers` and `/careers/apply?position=senior-solana-rust-engineer`.

The apply form and recruiter dashboard need the API, so `file://` browsing will not submit applications or load candidates.

## 8. Test an application

1. Open `/careers/apply?position=senior-solana-rust-engineer`.
2. Complete required fields and attach a PDF/DOC/DOCX resume of 2 MB or less.
3. Submit. The button should show **Submitting...** and then **Application Submitted Successfully**.
4. Confirm a row in Supabase **Table Editor → applications**.
5. Confirm a file under **Storage → resumes → {application id}/**.
6. Confirm the recruiting inbox received **New DracoinLabs Application — {position} — {name}**.
7. Sign in at `/admin/login` and open the application. Download the CV.

See `docs/TEST_PLAN.md` for invalid input, failure, and security cases.

## 9. Access the recruiter dashboard

1. Go to `/admin/login` (or `/admin/applications`, which redirects if you are not signed in).
2. Sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
3. Search, filter by position/status, and sort newest/oldest.
4. Open a candidate to view details, change status, and download the CV.
5. Sign out when finished.

The dashboard HTML is a shell only. Application data and CVs are served by `/api/admin/*` and require a valid session cookie. Candidates cannot read other applications or CVs.

## 10. Deploy to Vercel

```bash
npm install
npx vercel --prod
```

Or push to the GitHub repository connected to the Vercel project. After the first deploy:

1. Confirm environment variables are set (step 6).
2. Confirm `/careers` and `/careers/apply` load.
3. Submit a test application.
4. Sign in to `/admin/applications`.

Production routing:

- `/careers` → careers listing
- `/careers/apply` → application form
- `/api/apply` → candidate submit API
- `/admin/login` → recruiter sign in
- `/admin/applications` → application list
- `/admin/application?id=` → application detail
