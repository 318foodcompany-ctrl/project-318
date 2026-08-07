# Final Production Launch Runbook

This is the single launch authority for the integrated release candidate. Replace `RELEASE_COMMIT` with the final reviewed integration commit recorded in the draft PR. Production launch is an account-owner operation after review; this branch does not deploy, merge, migrate, email, enroll customers, or use production data.

## Release and prerequisites

1. Approve the draft PR and record its immutable commit SHA as `RELEASE_COMMIT`.
2. Confirm a fresh production backup and a tested restore path following `BACKUP-RESTORE.md` and `DISASTER-RECOVERY.md`.
3. Complete every item in `FINAL-MANUAL-ACTION-CHECKLIST.md`.
4. Configure variables exactly as classified in `PRODUCTION-ENVIRONMENT-CHECKLIST.md`; verify only public Supabase/analytics identifiers reach browser code.
5. Apply every migration to disposable staging in the exact order and with the per-step checks in `PRODUCTION-MIGRATION-RUNBOOK.md`. Run all credential-gated suites. Zero failures are required.

## External-service configuration

- Supabase: confirm the production project reference, PITR/backups, Auth site/redirect URLs, administrator identity and `crm_is_admin()` result, private portal document bucket, website image bucket, and the anonymous/authenticated/admin RLS matrix.
- Resend: verify the sending domain, SPF/DKIM, transactional and marketing senders, monitored reply-to, account suppression settings, and a webhook to `https://YOUR_DOMAIN/api/email-webhook` for sent/delivered/opened/clicked/delayed/bounced/complained/failed events.
- OpenAI: create a production project key with suitable spend/rate limits; configure the approved `AI_MODEL`; verify server-only access and one reviewed draft generation. AI output remains a draft.
- Scheduler: invoke `POST /api/follow-up-run` every 5â€“15 minutes with `Authorization: Bearer FOLLOW_UP_CRON_SECRET`; do not create overlapping schedules.

## Staging release gate

Deploy `RELEASE_COMMIT` to a hosting preview environment tied only to disposable staging. Use `AI_PROVIDER=test` and `TRANSACTIONAL_EMAIL_PROVIDER=test`. Validate public quote/contact confirmations, owner notification rendering, HTML/plain text, marketing templates/unsubscribe links, suppression, signed/invalid/duplicate webhook events, scheduler authorization, atomic claim/recovery/cancellation/paused/suppression flows, AI generation/save/edit/duplicate/archive/summary, portal authorization, proposals/PDFs, bookings, invoices/payments, uploads, analytics consent, public/admin route smoke tests, links, and structured data. Confirm no provider delivered a real message.

## Production deployment procedure

1. Freeze changes and re-confirm `RELEASE_COMMIT`, backup timestamp, production project reference, and rollback owner.
2. Apply migrations exactly once in the authoritative order, stopping after any failed validation.
3. Deploy the approved immutable commit with production-scoped variables.
4. Run `PROJECT318_BASE_URL=https://www.318foodco.com node scripts/public-launch-smoke.js` plus the Launch Readiness dashboard.
5. Manually verify home/about/catering/corporate/gallery/FAQ/events/contact/quote/unsubscribe/portal routes, admin login and authorization, core admin workspaces, and provider health. Use clearly marked synthetic records only and remove/close them after approval.
6. Activate the scheduler only after queue, consent, suppression, and sender verification pass. Do not bulk-enroll existing customers.

## Rollback criteria and procedure

Rollback the application for authentication bypass, anonymous private-data exposure, corrupted totals, duplicate financial/email actions, broken quote intake, material route outage, or uncontrolled provider delivery. Disable scheduler and live providers first, preserve logs/evidence, roll the application back to the prior immutable deployment, and restore the database only under the documented restore plan. Do not casually run feature rollback SQL: invoice, sales, and marketing rollbacks guard business/compliance history and are not substitutes for restore. Notify the account owner and record the incident timeline.

## First 24 hours

Monitor deployment/API errors, Supabase auth/database/storage logs, lead acceptance versus honest delivery outcomes, queue claim age/retries/duplicates, Resend delivery/bounce/complaint/webhook rates, unsubscribe processing, OpenAI error/latency/spend, portal/PDF/upload failures, analytics consent behavior, and customer/support reports. Check at launch, +15 minutes, +1 hour, +4 hours, +12 hours, and +24 hours.

## Known limitations and deferred work

Payments are manually recorded; the UI must not claim online card collection. AI content is draft-only. No SMS, social publishing, paid-ad API, chatbot, bulk migration enrollment, or automated daily AI summary is included. Provider event reporting requires a configured webhook, and open/click measurements are approximate. The rejected experimental 3D homepage route was removed; the current approved homepage remains unchanged.
