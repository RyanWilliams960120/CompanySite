# Careers ATS test plan

Use `npx vercel dev` with a configured `.env`, or a Preview/Production deploy. Do not commit credentials, test resumes that contain real personal data, or production service-role keys to git.

## Candidate application

### Valid application

1. Open `/careers/apply?position=senior-solana-rust-engineer`.
2. Fill name, email, LinkedIn, years of experience, and a PDF resume under 2 MB.
3. Leave GitHub and Portfolio empty.
4. Submit once.
5. Expect **Application Submitted Successfully** without a full page reload.
6. Expect a row in `applications` with `status = new` and `resume_storage_path` like `{uuid}/...`.
7. Expect a private object in the `resumes` bucket.
8. Expect a recruiter email with application id and a dashboard link.

### Missing required fields

Submit with empty name, email, LinkedIn, experience, or resume. Expect inline field errors and no database row.

### Invalid email

Enter `not-an-email`. Expect a validation error and no database row.

### Invalid URL

Enter `linkedin.com/in/jane` (no protocol) or `javascript:alert(1)`. Expect a LinkedIn URL error. Repeat with an invalid GitHub or Portfolio URL while other fields are valid.

### Optional GitHub and Portfolio

Submit a valid application with both blank. Expect `github` and `portfolio` stored as null. Submit again later (after the duplicate window, or with another email) with valid `https://` URLs and expect those values saved.

### Missing CV

Submit without a file. Expect “Please attach your resume or CV.” and no row.

### Invalid CV type

Upload a `.txt`, `.png`, or a renamed zip that is not a real PDF/DOC/DOCX. Expect a resume type error. Confirm no Storage object and no database row.

### Oversized CV

Upload a PDF larger than 2 MB. Expect a size error. Confirm no Storage object and no database row.

### Duplicate submission

Submit a valid application, then immediately submit again for the same email and position. Expect HTTP 409 and the message that an application was already submitted recently. Confirm only one database row from the first success (client also blocks double-clicks while **Submitting...** is shown).

### Double-click / in-flight submit

Click **Submit Application** twice quickly on a valid form. Expect the button to disable, label **Submitting...**, and a single request/row.

## Persistence and notification failures

### Database failure

Temporarily point `SUPABASE_URL` at an invalid host, or rename the table. Submit a valid application. Expect a generic failure message (not the success panel). If a Storage object was created, it should be deleted.

### Storage failure

Use a wrong `SUPABASE_STORAGE_BUCKET` name. Expect a generic failure message and no `applications` row.

### Email failure

Set an invalid `RESEND_API_KEY` or `RESEND_FROM` while Supabase is correct. Submit a valid application. Expect the success panel and a saved database row. Expect `[careers-apply] email-failed {application id}` in function logs. Do not delete the application.

## Recruiter dashboard and isolation

### Unauthorized admin access

1. Sign out (or use a private window).
2. Open `/admin/applications` — expect redirect to `/admin/login`.
3. `GET /api/admin/applications` — expect `401`.
4. `GET /api/admin/resume?id={any uuid}` — expect `401` and no file bytes.
5. `PATCH /api/admin/applications` — expect `401`.

### Candidate attempting to access another candidate's CV

Using a known application UUID from a previous test:

1. Without the recruiter cookie, request `/api/admin/resume?id={uuid}`.
2. Expect `401`/`404` JSON, not the CV.
3. Request `/api/admin/applications?id={uuid}` without the cookie. Expect `401`.
4. Confirm the Storage object URL is not public (opening the raw Supabase object URL without the service role should fail).

### Authorized recruiter flow

1. Sign in at `/admin/login` with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
2. Wrong password should fail and not set a session.
3. List, search by name/email, filter by position and status, sort newest/oldest.
4. Open an application and confirm candidate, position, contact, links, experience, compensation, availability, cover letter, CV download, status, and created date.
5. Change status through `new` → `screening` → `interview` → `rejected` (and others). Expect the row to update and `updated_at` to change.
6. Download the CV. Expect the original validated type (PDF/DOC/DOCX), not an HTML error page.

### Rate limiting

Submit more than 8 apply requests in an hour from the same IP (including invalid ones). Expect HTTP 429. Repeat rapid failed logins to `/api/admin/login` and expect a lockout message.
