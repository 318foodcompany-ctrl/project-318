# Project 318 Production Launch Runbook

Use this checklist after the approved application commit and required Supabase migrations are deployed to production.

## 1. Configuration

- Confirm the production deployment uses the production Supabase project only.
- Confirm the Supabase public URL and anonymous key load from `/api/runtime-config`.
- Add the production GA4 Measurement ID when available.
- Add the production Meta Pixel ID when available.
- Sign in to the administrator dashboard and run the Launch Readiness check.

## 2. Database migrations

Apply the approved migrations in this order if they have not already been applied:

1. `supabase/baseline-schema.sql`
2. `supabase/website-settings.sql`
3. `supabase/booking-calendar.sql`
4. `supabase/quote-internal-notes.sql`
5. `supabase/customer-crm.sql`
6. `supabase/customer-crm-status-fix.sql`
7. `supabase/invoicing-payments.sql`
8. `supabase/marketing-attribution.sql`
9. `supabase/marketing-funnel-reporting.sql`
10. `supabase/marketing-spend-roas.sql`
11. `supabase/website-settings-admin-hardening.sql`
12. `supabase/migrations/20260722190000_admin_rls_hardening.sql`
13. `supabase/migrations/20260722200000_website_images_storage.sql`

Both timestamped migrations require `public.crm_is_admin()` from `customer-crm.sql`. Apply them before deploying the release so direct database access and website uploads enforce administrator permissions.

Do not run rollback files during a normal deployment.

## 3. Automated public smoke test

Run the GitHub Actions workflow named **Project 318 Production Smoke Test** and leave the default production URL selected.

The workflow verifies:

- homepage and public navigation pages
- catering and corporate conversion links
- contact information
- quote builder availability
- privacy policy
- sitemap and crawler rules
- runtime configuration endpoint

The same check can be run locally with:

```bash
node scripts/public-launch-smoke.js
```

To test a preview deployment:

```bash
PROJECT318_BASE_URL=https://your-preview-url.example node scripts/public-launch-smoke.js
```

## 4. Live customer-flow test

- Submit one clearly marked production smoke-test quote.
- Confirm the success message appears and no browser errors occur.
- Confirm the quote appears in Quote Management.
- Confirm a customer record is linked or created correctly.
- Move the quote through Contacted and Proposal Sent.
- Create a booking from the quote and confirm duplicate booking protection.
- Create an invoice and record a small test payment only when production payment testing is approved.
- Confirm marketing source information appears on the quote when using a tagged campaign URL.
- Remove or clearly close all smoke-test records after validation.

## 5. Mobile and desktop review

Review the homepage, catering page, corporate page, gallery, contact page, quote builder, login, and administrator dashboard at common mobile and desktop widths.

Check for:

- horizontal scrolling
- clipped buttons or forms
- unreadable text
- broken images
- incorrect phone or email links
- missing navigation
- console errors

## 6. Launch decision

Launch is approved only when:

- the production workflow passes
- the Launch Readiness dashboard has no blocked items
- quote submission and administrator retrieval work
- production migrations are confirmed
- required tracking IDs are either configured or intentionally deferred
- smoke-test records are removed

Record the deployed commit SHA and launch date in the release notes or deployment log.
