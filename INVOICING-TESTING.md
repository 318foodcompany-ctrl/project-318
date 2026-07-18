# Project 318 invoicing and payment validation

## Deployment order

1. Review the draft PR and final migration diff.
2. Apply `supabase/invoicing-payments.sql` to the production Supabase project exactly once after approval. The migration is designed to be safely rerunnable, but a production rerun is not part of normal deployment.
3. Deploy the matching application commit.
4. Sign out and back in so the administrator JWT contains `app_metadata.role = admin`.
5. Run the complete smoke test below.
6. Do not run `supabase/invoicing-payments-rollback.sql` unless disabling the feature is explicitly approved. It preserves all accounting data.

No invoices are backfilled automatically. Existing quotes and bookings remain eligible for deliberate invoice creation from their admin detail screens.

## Automated validation

Run all JavaScript syntax and repository tests:

```text
node --check js/*.js
node tests/booking-time.test.js
node tests/crm-client.test.js
node tests/crm-integration.test.js
node tests/crm-migration.test.js
node tests/crm-status-migration.test.js
node tests/crm-utils.test.js
node tests/invoice-client.test.js
node tests/invoice-integration.test.js
node tests/invoice-migration.test.js
node tests/invoice-utils.test.js
node tests/quote-status.test.js
git diff --check
```

Apply the CRM, booking, and invoice migrations to a disposable Supabase project, then run `tests/invoicing-integrity.sql`.

Database and concurrency tests require disposable-project credentials:

```text
INVOICE_TEST_SUPABASE_URL=https://project.supabase.co
INVOICE_TEST_ANON_KEY=...
INVOICE_TEST_ADMIN_TOKEN=...
INVOICE_TEST_SERVICE_ROLE_KEY=...
node --test tests/invoice-database.integration.test.js
node --test tests/invoice-concurrency.integration.test.js
```

Never use production credentials for automated integration tests.

## Production smoke test

- Confirm the Invoices panel loads for an administrator and anonymous REST reads of `invoices`, `invoice_line_items`, and `payments` are denied.
- Confirm direct authenticated writes to the accounting tables are denied.
- Create a manual draft, select an existing customer, and add multiple taxable/non-taxable lines.
- Verify server totals for subtotal, fixed discount, allocated taxable discount, tax, total, and required deposit.
- Edit the draft and verify optimistic concurrency rejects a stale version.
- Issue the draft and verify the number matches `318-YYYY-000001` formatting.
- Issue two invoices concurrently in a controlled test and verify unique sequential numbers.
- Create an invoice from a quote; verify a second active invoice is rejected and the existing invoice opens.
- Create an invoice from a booking linked to that quote; verify the same source relationship cannot create a duplicate.
- Record a deposit and verify Partially Paid status, paid amount, balance, and one CRM timeline event.
- Attempt an overpayment and verify no payment, total, or activity mutation occurs.
- Record the remaining payment and verify Paid status and zero balance.
- Reverse a payment with a reason and verify an append-only reversal, restored balance, and one timeline event.
- Attempt to edit or delete a payment directly and verify rejection.
- Create a past-due unpaid invoice and verify Overdue status and filtering.
- Verify customer Total Invoiced, Total Paid, Outstanding, invoice list, and payment activity.
- Void an unpaid issued invoice and verify history remains visible.
- Void a draft and verify no invoice number is consumed.
- Verify a paid invoice cannot be voided until payments are reversed/refunded.
- Verify Quote Management, Booking Calendar, Customers, content editors, photo manager, authentication, and the public quote form still work.
- Sign out and verify all invoice and payment access is denied.
- Remove only the uniquely identified smoke-test records after every test passes. Use a service-role cleanup in the SQL editor because administrator payment history is intentionally immutable.

## Manual QA

- Test invoice search, every status filter, overdue-only, all sort choices, and pagination.
- Test desktop, tablet, and mobile layouts.
- Test keyboard navigation, focus return, modal close behavior, labels, live status messages, and empty/error/loading states.
- Test customer picker selection and source-prefilled invoices.
- Confirm issued invoice fields are read-only while payment controls remain available.
- Confirm malformed, negative, zero, excessive, and high-precision amounts are rejected or server-rounded correctly.
- Confirm refreshing after every write shows the persisted database values rather than stale client estimates.
