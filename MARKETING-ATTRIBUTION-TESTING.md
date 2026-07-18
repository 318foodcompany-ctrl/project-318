# Project 318 marketing attribution validation

## Deployment order

1. Deploy the reviewed application to a Vercel Preview configured only for staging Supabase.
2. Apply `supabase/marketing-attribution.sql` once to staging after `supabase/invoicing-payments.sql`.
3. Complete the checks below. Do not apply the migration to production until the draft PR passes review and staging validation.
4. Deploy the matching application commit only after the production migration is separately approved and succeeds.

The rollback disables public/reporting RPCs but deliberately retains captured attribution tables and lead links. Accounting attribution must not be destructively removed by an emergency rollback.

## Automated checks

```text
node --check js/marketing-attribution.js
node --check js/quote-live.js
node --check js/admin-quotes.js
node --test tests/marketing-attribution.test.js
node --test tests/marketing-attribution-migration.test.js
```

Run the existing CRM, booking, invoice, quote, runtime configuration, and JavaScript suites as regressions.

## Staging smoke test

- Visit a staging page with test Google UTMs and GCLID, navigate to the quote builder, and submit a quote.
- Confirm one visitor, one session, and first/last touchpoints are linked to the lead.
- Confirm a direct return does not overwrite the last non-direct touch.
- Confirm Quote Management displays attribution.
- Create a booking and invoice from the quote, record a payment, and verify first- and last-touch revenue RPC totals.
- Submit a direct quote and confirm direct attribution.
- Confirm malformed/overlength attribution is rejected or bounded.
- Confirm anonymous users cannot directly access attribution tables.
- Confirm non-admin authenticated users cannot read attribution or reporting RPCs.
- Confirm an administrator can use quote/revenue attribution reports.
- Confirm quote submission creates one `quote_created` activity and no attribution-only `quote_updated` activity.
- Confirm existing quote, booking, invoice, and payment workflows remain unchanged.
- Check mobile behavior, browser console, network requests, and duplicate script loading.

Remove all staging smoke-test records after validation. Do not use production advertising click identifiers.
