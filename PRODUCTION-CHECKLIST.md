# Project 318 production checklist

Use this checklist for every production release. Stop when a required check fails.

## Before deployment

- Confirm the approved PR head and expected base commit.
- Confirm the working tree is clean and all required reviews/checks passed.
- Review every forward migration and rollback. Never run a rollback merely to “start over.”
- Take a verified Supabase database backup.
- Confirm Vercel Production variables point only to the production Supabase project.
- Confirm Preview variables point only to staging.
- Confirm no service-role key, access token, database password, cron secret, Resend key, or AI key is present in browser runtime configuration or Git.
- Confirm production administrator accounts have `app_metadata.role = admin`, MFA where available, and no shared credentials.
- Confirm public Auth registration is disabled unless a reviewed feature explicitly requires it.

## Required server environment

- `PUBLIC_SUPABASE_URL` — environment-specific public Supabase URL.
- `PUBLIC_SUPABASE_ANON_KEY` — environment-specific public anonymous key.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never Preview-shared with Production.
- `LEAD_RATE_LIMIT_SECRET` — unique 32+ character server secret.
- `FOLLOW_UP_CRON_SECRET` — unique 32+ character server secret.
- Existing Resend sender/API variables described by Release 1.
- Optional analytics and AI variables only after consent and account-owner approval.

## Migration order for this release stack

1. Apply all previously approved migrations through Release 2.
2. Apply `supabase/release-3-sales-platform.sql`.
3. Apply `supabase/launch-readiness-hardening.sql`.
4. Do not run either rollback during a successful deployment.

Record the date, operator, target project, SQL checksum, and result for every migration.

## Production smoke test

- Public home, catering, corporate, about, gallery, FAQ/event pages, contact, and quote routes load.
- Public quote submission creates exactly one lead and sends expected transactional notifications.
- Anonymous users cannot read CRM, bookings, invoices, proposals, customers, activities, follow-ups, or portal-token tables.
- Administrator login, Customers, Quotes, Booking Calendar, Invoices, Marketing, Conversion Content, and Sales Platform load without console errors.
- Create one clearly labeled test opportunity and proposal; verify totals, PDF, portal approval, and activity history.
- Verify a portal token shows only its customer’s safe fields and expires/revokes correctly.
- Run the follow-up worker in provider test mode; verify one claim and no duplicate delivery.
- Upload one small valid test document and reject mismatched, oversized, and unsupported files.
- Verify keyboard navigation, visible focus, status announcements, mobile layouts, 404, and error recovery.
- Remove test records only after all checks pass and record what was removed.

## Release completion

- Confirm the deployed commit equals the approved commit.
- Confirm monitoring, backups, cron execution, and email-provider health.
- Sign out and sign back in to refresh the administrator JWT after role changes.
- Record known risks and create follow-up issues. Do not hide partial failures.
