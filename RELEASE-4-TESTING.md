# Release 4 testing and activation

Use only the Project 318 staging Supabase project and a Preview deployment. Do not use real recipients or Production provider credentials.

## Automated validation

Run targeted tests while developing:

```text
node --test tests/release-4-ai-marketing.test.js
```

At completion run JavaScript syntax validation, `git diff --check`, and the complete test suite once. Credential-dependent database tests must identify themselves as skipped when staging credentials are unavailable.

The Release 4 database integration suite reuses the existing isolated-staging
variables `CRM_TEST_SUPABASE_URL`, `CRM_TEST_ANON_KEY`, and
`CRM_TEST_ADMIN_TOKEN`. Never point these variables at Production.

## Staging migration

1. Confirm Preview runtime configuration references only staging.
2. Back up staging.
3. Apply `supabase/release-4-ai-marketing.sql`.
4. Confirm every Release 4 table has RLS enabled.
5. Confirm anonymous and ordinary authenticated users cannot access any management table.
6. Confirm `marketing_unsubscribe` is the only anonymous Release 4 RPC.
7. Confirm zero existing customers were enrolled and zero messages were queued by migration.
8. Rerun the migration to validate idempotency.
9. Do not run the rollback unless an approved staging rollback test uses an empty Release 4 dataset.

## AI checklist

- Set `AI_PROVIDER=test` and leave live provider credentials unset.
- Generate every supported content type and tone.
- Confirm structured output, edit, copy, duplicate, tags, archive, and draft persistence.
- Confirm regeneration creates a new draft.
- Confirm ordinary authenticated and anonymous requests receive 403/401.
- Confirm missing configuration, timeout, oversized input, and invalid output fail safely.
- Confirm no API key or raw provider error appears in the browser or logs.
- Generate an executive summary manually and verify the analyzed period is visible in the saved input.

## Campaign and template checklist

- Create, edit, duplicate, preview, pause, resume, cancel, complete, and archive a campaign.
- Build an email with every block type.
- Test every variable with complete and missing sample data.
- Verify HTML escaping, safe URLs, desktop preview, mobile preview, and plain text.
- In non-production provider test mode, render a test email and confirm no real network delivery occurs.

## Sequence checklist

- Create each trigger type.
- Add, reorder, and remove steps.
- Test immediate, one-hour, four-hour, day-based, and custom delays.
- Test proposal-viewed/not-viewed, proposal-not-approved, booked/not-booked, corporate, repeat-customer, event-date, consent, and suppression conditions.
- Pause/resume a sequence and cancel an enrollment.
- Confirm pause/cancellation is rechecked before send.
- Confirm the migration did not enroll existing customers.

## Consent and unsubscribe checklist

- Enroll a consenting, unsuppressed staging customer.
- Reject enrollment without consent.
- Reject an actively suppressed customer.
- Use global and campaign unsubscribe links in a signed-out browser.
- Reject malformed, expired, and reused tokens.
- Confirm customer IDs are absent from URLs.
- Confirm existing consent rows remain unchanged and a new audit event is appended.
- Confirm transactional messages remain eligible.

## Queue and provider events

- Run the worker with test provider mode.
- Confirm atomic claim, one send per idempotency key, retry delay, maximum attempts, and 15-minute stuck-job recovery.
- Pause the campaign after claim and confirm the send is suppressed.
- Replay a valid webhook and confirm one event.
- Reject invalid signatures and stale timestamps.
- Replay the same event and confirm no duplicate.
- Verify bounce and complaint suppressions.
- Verify delivered, opened, clicked, deferred, failed, and unsubscribe reporting.

## Reporting

- Filter by date, campaign, sequence, audience, source tag, and campaign status.
- Reconcile scheduled, sent, delivered, opened, clicked, bounced, complained, unsubscribed, and failed counts.
- Confirm leads and bookings are counted only through explicit campaign enrollments.
- Confirm revenue is labeled directly attributed and matches linked payment records.
- Confirm unavailable values remain zero rather than inferred.

## Regression and accessibility

- Quote and contact submissions.
- CRM, proposals, portal, bookings, invoices, payments, CMS, gallery, FAQ, testimonials, and event pages.
- Follow-up transactional behavior.
- Mobile admin layout at 320, 768, and desktop widths.
- Keyboard-only tab navigation, block controls, forms, status announcements, focus states, loading, empty, and error states.
- Browser console and network panel contain no secrets or unexpected Production requests.

## Production activation

Only after staging approval:

1. Back up Production and record the approved commit and migration checksum.
2. Confirm environment scope and sender/domain verification.
3. Apply the forward migration once.
4. Deploy the approved commit.
5. Configure the signed webhook and scheduler.
6. Start with AI and email provider test modes where supported.
7. Enable one internal campaign and one consenting internal recipient.
8. Reconcile events, suppression, and reporting before broader activation.
9. Never run the rollback during a successful release.
