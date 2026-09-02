# DracoinLabs website and careers ATS

Marketing site for [DracoinLabs](https://www.dracoinlabs.com), plus a private recruiting workflow for the Careers page.

Candidates apply at `/careers` and `/careers/apply`. Applications are validated by `/api/apply`, stored in the Vercel Neon Postgres database, and emailed to recruiting through Hostinger SMTP or Resend. Recruiters review applications at `/admin/applications`.

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

## 4. Configure recruiting email (Hostinger or Resend)

The candidate still sees success if the database record was saved, even when email delivery fails. Check Vercel function logs for `[careers-apply] email-failed`.

### Hostinger mailbox (recommended for info@dracoinlabs.com)

In Vercel → **Settings → Environment Variables**, add:

```
CAREERS_EMAIL=info@dracoinlabs.com
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=465
EMAIL_USER=info@dracoinlabs.com
EMAIL_PASSWORD=
EMAIL_FROM=DracoinLabs Careers <info@dracoinlabs.com>
```

`EMAIL_PASSWORD` is the Hostinger mailbox password for `info@dracoinlabs.com`. Redeploy after saving. If port 465 fails, try `EMAIL_PORT=587`.

### Resend (optional)

If Hostinger SMTP is not set, the API can use Resend instead:

1. Create an account at [https://resend.com](https://resend.com).
2. Verify `dracoinlabs.com`.
3. Set `RESEND_API_KEY`, `RESEND_FROM`, and `CAREERS_EMAIL`.

The API also rejects a second application from the same email address for the same position within 24 hours.

## 5. Required environment variables

Copy `.env.example` to `.env` for local development. `.env` is gitignored.

```
DATABASE_URL=
POSTGRES_URL=
CAREERS_EMAIL=
EMAIL_HOST=
EMAIL_PORT=465
EMAIL_USER=
EMAIL_PASSWORD=
EMAIL_FROM=
RESEND_API_KEY=
RESEND_FROM=
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
| `CAREERS_EMAIL` | Recruiting inbox, e.g. `info@dracoinlabs.com` |
| `EMAIL_HOST` | Hostinger SMTP host, `smtp.hostinger.com` |
| `EMAIL_PORT` | `465` (SSL) or `587` (TLS) |
| `EMAIL_USER` | Mailbox username, e.g. `info@dracoinlabs.com` |
| `EMAIL_PASSWORD` | Mailbox password |
| `EMAIL_FROM` | From header, e.g. `DracoinLabs Careers <info@dracoinlabs.com>` |
| `RESEND_API_KEY` | Optional Resend API key if not using SMTP |
| `RESEND_FROM` | Optional Resend From address |
| `APP_BASE_URL` | Public site origin, no trailing slash. Optional on Vercel (production URL is used if unset) |
| `ADMIN_USERNAME` | Recruiter dashboard username |
| `ADMIN_PASSWORD` | Recruiter dashboard password |
| `ADMIN_SESSION_SECRET` | Long random string used to sign the HttpOnly session cookie (32+ characters) |
| `ALLOWED_ORIGIN` | Optional extra CORS origin(s), comma-separated |

`DATABASE_URL` / `POSTGRES_URL` are required for **Submit Application**. Resend and admin variables are required for email and the recruiter dashboard, not for saving the application.

## 6. Configure those variables in Vercel

1. Confirm the Neon integration already added `DATABASE_URL` or `POSTGRES_URL`.
2. Add Hostinger SMTP variables so applications reach `info@dracoinlabs.com`.
3. Add admin variables if you want `/admin/applications`.
4. Do not expose `DATABASE_URL`, `EMAIL_PASSWORD`, `RESEND_API_KEY`, `ADMIN_PASSWORD`, or `ADMIN_SESSION_SECRET` in browser JavaScript.
5. Redeploy after saving variables.

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
5. Confirm the recruiting inbox received the notice **with the CV attached**.
6. Sign in at `/admin/login` (after `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` are set in Vercel) and open the application.

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
