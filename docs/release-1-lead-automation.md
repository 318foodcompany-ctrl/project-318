# Release 1 — Lead Capture and Transactional Email

## Purpose

Release 1 makes every public catering request use one secure server endpoint.
It preserves CRM customer matching and marketing attribution, records explicit
email-marketing consent decisions, prevents common retry duplicates and abuse,
and records owner/customer transactional-email outcomes independently.

This release does not send marketing campaigns, SMS, proposals, or payments.

## Architecture

1. `quote-builder.html` and `contact.html` build a normalized request.
2. `js/lead-submission.js` sends JSON to `/api/lead-submit` with a stable
   per-form idempotency key.
3. The server validates size, source, identity fields, honeypot, and credentials.
4. The server hashes the request and network rate-limit key. Raw client IPs and
   user-agent strings are not stored.
5. `submit_release1_lead` serializes the idempotency record, enforces the
   persisted rate limit, calls the existing customer/quote/attribution
   transaction, and appends consent evidence.
6. Only after the lead commits does the server attempt customer and owner email.
7. Each outcome is appended to `lead_email_deliveries` and reflected on the
   lead. An email is `accepted` only when the provider returns an ID.
8. An idempotent retry returns the original lead and does not send email again.

## Database migration

Apply, in review/staging first:

```text
supabase/release-1-lead-automation.sql
```

It must run after `marketing-attribution.sql`. It is additive, transaction
wrapped, and safe to rerun. It does not backfill, delete, or rewrite historical
leads.

The rollback file is:

```text
supabase/release-1-lead-automation-rollback.sql
```

The rollback deliberately preserves tables and evidence. It revokes the Release
1 RPCs and removes new read policies. Dropping consent or delivery history would
destroy compliance and operational evidence and is intentionally unsupported.

## Email provider setup

The provider abstraction currently supports Resend and a non-sending test mode.

Production:

1. Verify a sending domain with Resend.
2. Create a production API key with email-send access only.
3. Configure `TRANSACTIONAL_EMAIL_PROVIDER=resend`.
4. Configure `TRANSACTIONAL_EMAIL_FROM`, `RESEND_API_KEY`, and
   `LEAD_NOTIFICATION_TO`.
5. Set the approved business phone/email and optional response expectation.
6. Submit only synthetic staging requests first and inspect both HTML and plain
   text.

No credentials means the lead is still saved. Delivery is recorded as
`manual_setup`, and the customer sees an honest message that email confirmation
was unavailable.

## Safe test mode

For local or Preview environments only:

```text
TRANSACTIONAL_EMAIL_PROVIDER=test
```

Test mode returns deterministic provider references and sends no network email.
The provider refuses test mode when Vercel/Node identifies the runtime as
Production.

## Transactional versus marketing email

- Customer receipt and owner notification are transactional operational
  messages. They do not depend on marketing consent.
- Catering specials are marketing. They require an explicit consent-history
  record with `granted=true` and must honor later withdrawal/suppression.
- A declined checkbox is also appended as evidence. No Contact submission is
  opted in by default.
- Release 1 does not send specials or create automated sequences.

## Abuse controls

- Hidden honeypot on both forms.
- 32 KB request maximum.
- Server validation and bounded field lengths.
- HMAC network rate-limit key; raw IP is not retained.
- Database-enforced rolling request count.
- UUID idempotency key plus request hash.
- Existing deterministic CRM identity matching prevents customer duplication.

Recommended defaults are five new submissions per 15 minutes per network key.
Preview and automated testing may use a higher limit with a separate secret.
CAPTCHA is deferred; add it only if observed abuse exceeds these controls.

## Admin visibility

Quote detail displays:

- submission source;
- customer confirmation and owner notification state;
- most recent attempt;
- safe provider delivery references;
- safe failure code;
- marketing consent status;
- deduplication and abuse-review state.

Provider payloads, recipient secrets, API keys, and service-role credentials are
never displayed.

## Deployment checklist

1. Review and approve the migration.
2. Apply it to a blank/disposable or staging Supabase project.
3. Configure Preview-only secrets and `TRANSACTIONAL_EMAIL_PROVIDER=test`.
4. Run all tests and submit synthetic guided/contact requests.
5. Confirm customer, lead, attribution, consent, email ledger, and admin states.
6. Confirm repeated idempotency key returns the original lead without new email.
7. Confirm anonymous users cannot read private Release 1 tables.
8. Configure Resend sandbox and test accepted/rejected/timeout paths.
9. Obtain review approval.
10. Apply the migration once to Production.
11. Configure Production-only environment values.
12. Deploy, sign in again, run synthetic production smoke checks, and remove
    synthetic records only under an approved cleanup procedure.

## Known limitations

- Failed email is marked retry-available, but automated retry workers/webhooks
  are deferred.
- Provider “accepted” means accepted by Resend, not final inbox delivery.
- Marketing unsubscribe/suppression and campaigns remain deferred.
- No SMS, CAPTCHA, online payment, or proposal delivery is included.
- The About/Home/Contact loaders publish text only; administrator content cannot
  inject HTML or scripts.
