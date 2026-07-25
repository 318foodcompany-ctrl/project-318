# Release 3 sales platform validation

## Deployment order (not performed by this pull request)

1. Back up the target database and confirm CRM, booking, and invoicing migrations are present.
2. Apply `supabase/release-3-sales-platform.sql` once in staging.
3. Set `SUPABASE_SERVICE_ROLE_KEY` only in the server deployment environment. Never expose it through runtime config or browser JavaScript.
4. Set a unique random `FOLLOW_UP_CRON_SECRET` of at least 32 characters only in the server environment. Configure the scheduler to send `POST /api/follow-up-run` with `Authorization: Bearer <secret>`.
5. Configure the existing transactional email variables (`RESEND_API_KEY` and verified sender settings) before enabling follow-up rules.
6. Deploy the branch to a staging Preview that uses the staging Supabase project.
7. Assign `app_metadata.role = admin` to the staging administrator and sign in again.

No new browser environment variables are required. `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY` retain their existing environment-specific scopes.

## Authenticated admin smoke test

- Open Sales Platform and confirm all eight metrics load.
- Confirm all seven pipeline stages render and drag a test opportunity through each applicable stage.
- Set priority, expected revenue, follow-up date, assigned staff, a lost reason, and an internal comment.
- Confirm one stage-history and customer-activity entry per move.
- Create a proposal with menu, package, add-on, delivery, setup, discount, tax, and expiration values.
- Confirm server totals match independently calculated totals.
- Save an edited version; verify previous versions and line items remain unchanged.
- Duplicate the proposal and verify it has no quote/booking uniqueness conflict.
- Issue it, download the branded PDF, and verify status/activity updates.
- Create a 30-day portal link. In a signed-out browser, view and approve the proposal.
- Confirm the portal shows only that customer's issued proposals, non-draft invoices, events, payments, documents, and messages.
- Confirm no internal notes, staff-only details, storage paths, or other customer records appear.
- Send a portal question and verify it appears in the CRM activity timeline.
- Create each follow-up rule type. Confirm all begin disabled and only email is available.
- Enable a rule and verify configuration persists. No messages should send without a separate authorized runner.
- Check calendar month/week/day views and kitchen/delivery timestamps.
- Verify dashboard metrics and reports against known staging records.
- Search customers globally, export CSV, archive/restore a customer, and merge two disposable duplicate records.
- Confirm linked quotes, bookings, invoices, proposals, activities, and portal tokens are handled as documented.

## Security and regression checks

- Signed-out users cannot read any Release 3 table.
- A normal authenticated non-admin cannot read or modify Release 3 data or execute admin RPCs.
- Invalid, expired, and revoked portal tokens fail without revealing customer existence.
- Direct writes to proposal versions, line items, proposals, and stage history are denied.
- Proposal PDF denies requests without an admin session or matching portal token.
- Quote Management, Customers, Booking Calendar, Invoices, payments, public quote submission, and website editors still load and save.
- Test desktop, tablet, and mobile widths; keyboard-only operation; focus visibility; labels; live status text; empty/loading/error states.

The rollback is intentionally destructive only when the Release 3 tables are empty.
It refuses to run once sales, proposal, portal, follow-up, document, or message data exists.
