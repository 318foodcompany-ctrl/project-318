# Project 318 CRM validation

## Deployment order

1. Review and run `supabase/customer-crm.sql` in the linked Supabase project.
2. Deploy the matching application commit immediately after the migration.
3. Have the administrator sign out and back in so `app_metadata.role = "admin"` is present in the current JWT.
4. Do not run the rollback unless the CRM feature must be fully removed. The rollback preserves quote and booking rows but removes CRM-only records and links.

## Smoke test checklist

- Sign in as an administrator and open **Customers**.
- Confirm existing quotes and bookings were backfilled into customer records.
- Create a customer manually, close the detail panel, search for the customer, and reopen it.
- Edit contact information and internal notes; confirm success feedback and a new timeline entry.
- Archive the customer and confirm it moves from Active to Archived Customers. Restore it afterward.
- Submit a public quote using an existing customer's email or phone. Confirm the quote attaches to that customer without creating a duplicate.
- Submit a public quote for a new person. Confirm one customer and one linked quote are created.
- Open an eligible quote and create a booking. Confirm quote, customer, and booking IDs remain linked.
- Create a booking manually, select an existing customer, save, reopen, edit, and delete it.
- Create a manual booking without selecting a match and confirm a customer is created automatically.
- Confirm booking and quote status changes, internal-note changes, and booking deletion appear newest-first in the customer timeline.
- Sign out and verify Customers cannot be opened and anonymous REST reads of `customers` and `customer_activities` are denied.
- Remove all temporary test records or archive the test customer according to business policy.

## Manual QA checklist

- Search by name, company, formatted/unformatted phone, email, event address, exact quote number, and booking date (`YYYY-MM-DD`).
- Combine search with Active/Archived and sort controls.
- Verify 10, 20, and 50 row pagination and Previous/Next disabled states.
- Check customer detail statistics, quotes, bookings, upcoming events, past events, and timeline.
- Verify primary and secondary phone validation and email validation.
- Confirm duplicate email, phone, and name-plus-company submissions resolve to one customer.
- Confirm empty, loading, success, error, and permission-denied states are readable.
- Test keyboard access to navigation, customer rows, modal controls, customer picker, and form actions.
- Test desktop, tablet, and mobile widths; confirm the modal scrolls and save controls remain reachable.
- Confirm Quote Management, Booking Calendar, photo manager, content editors, and authentication still load.

## Automated checks

Run with the bundled or system Node.js runtime:

```text
node --check js/crm-utils.js
node --check js/crm-service.js
node --check js/admin-customers.js
node --check js/admin-quotes.js
node --check js/admin-bookings.js
node --check js/quote-live.js
node tests/crm-utils.test.js
node tests/crm-migration.test.js
node tests/booking-time.test.js
```
