# DracoinLabs website and careers ATS

Marketing site for [DracoinLabs](https://www.dracoinlabs.com), plus a private recruiting workflow for the Careers page.

Candidates apply at `/careers` and `/careers/apply`. Applications are validated by `/api/apply`, stored in the Vercel Neon Postgres database, and emailed to recruiting with Resend. Recruiters review applications at `/admin/applications`.

Do not put secrets in this repository. Use environment variables only.

## 1. Create the Neon database on Vercel

1. In the Vercel project, open **Storage** (or **Integrations**) and create a **Neon** database.
2. Connect it to the `companysite` project for Production (and Preview if you use preview deploys).
3. Vercel will inject `DATABASE_URL` and/or `POSTGRES_URL`. You do not paste the password into the website code.
4. Redeploy after connecting the database so serverless functions receive the URL.

The apply API creates the `applications` table automatically on the first successful submit.

## 2. PostgreSQL table

Optional: run `supabase/migrations/001_applications.sql` in the Neon SQL Editor if you want the table before the first application.

The table stores candidate fields plus the CV as `resume_bytes` (private, not a public file URL). Default status is `new`.

## 3. CV storage

CVs are stored in Postgres (`resume_bytes`), not in a public bucket. Recruiters download them only through `/api/admin/resume` after signing in.

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
DATABASE_URL=
POSTGRES_URL=
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
| `DATABASE_URL` | Neon connection string (usually injected by the Vercel Neon integration) |
| `POSTGRES_URL` | Alternate Neon URL if `DATABASE_URL` is not set |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | Verified From address |
| `CAREERS_EMAIL` | Recruiting inbox |
| `APP_BASE_URL` | Public site origin, no trailing slash. Optional on Vercel (production URL is used if unset) |
| `ADMIN_USERNAME` | Recruiter dashboard username |
| `ADMIN_PASSWORD` | Recruiter dashboard password |
| `ADMIN_SESSION_SECRET` | Long random string used to sign the HttpOnly session cookie (32+ characters) |
| `ALLOWED_ORIGIN` | Optional extra CORS origin(s), comma-separated |

`DATABASE_URL` / `POSTGRES_URL` are required for **Submit Application**. Resend and admin variables are required for email and the recruiter dashboard, not for saving the application.

## 6. Configure those variables in Vercel

1. Confirm the Neon integration already added `DATABASE_URL` or `POSTGRES_URL`.
2. Add Resend and admin variables under **Settings → Environment Variables** if you want notifications and `/admin/applications`.
3. Do not expose `DATABASE_URL`, `RESEND_API_KEY`, `ADMIN_PASSWORD`, or `ADMIN_SESSION_SECRET` in browser JavaScript.
4. Redeploy after saving variables.

## 7. Run locally

Requirements: Node.js 18+ and the Vercel CLI.

```bash
npm install
npx vercel login
copy .env.example .env
```

Pull env from Vercel with `npx vercel env pull .env`, or paste `DATABASE_URL` from the Neon store, then:

```bash
npx vercel dev
```

The site is typically at `http://localhost:3000`. Open `/careers` and `/careers/apply?position=senior-solana-rust-engineer`.

The apply form and recruiter dashboard need the API, so `file://` browsing will not submit applications or load candidates.

## 8. Test an application

1. Open `/careers/apply?position=senior-solana-rust-engineer`.
2. Complete required fields and attach a PDF/DOC/DOCX resume of 2 MB or less.
3. Submit. The button should show **Submitting...** and then **Application Submitted Successfully**.
4. Confirm a row in the Neon table `applications`.
5. Confirm the recruiting inbox received **New DracoinLabs Application — {position} — {name}** if Resend is configured.
6. Sign in at `/admin/login` and open the application. Download the CV.

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

Or push to the GitHub repository connected to the Vercel project. After deploy:

1. Confirm Neon is connected and `DATABASE_URL` is present.
2. Confirm `/careers` and `/careers/apply` load.
3. Submit a test application.
4. Sign in to `/admin/applications` if admin env vars are set.

Production routing:

- `/careers` → careers listing
- `/careers/apply` → application form
- `/api/apply` → candidate submit API
- `/admin/login` → recruiter sign in
- `/admin/applications` → application list
- `/admin/application?id=` → application detail
