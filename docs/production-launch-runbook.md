# Project 318 Production Launch Runbook

This runbook converts Issue #29 into a safe, repeatable launch sequence for `https://www.318foodco.com`.

## 1. Production configuration

Configure these Vercel Production environment variables exactly as named:

- `PUBLIC_SUPABASE_URL` — production Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` — production anonymous public key
- `PUBLIC_GA4_MEASUREMENT_ID` — GA4 ID in the form `G-XXXXXXXXXX`
- `PUBLIC_META_PIXEL_ID` — numeric Meta Pixel ID

Do not place a Supabase service-role key, database password, or other private credential in any `PUBLIC_*` variable.

After saving variables, redeploy the production deployment so `/api/runtime-config` receives the new values.

## 2. Runtime configuration check

Open the production site, then open the browser developer console and run:

```js
window.__APP_CONFIG__
```

Expected result:

- `supabaseUrl` points to the production Supabase project
- `supabaseAnonKey` is present
- `ga4MeasurementId` is present after GA4 is configured
- `metaPixelId` is present after Meta Pixel is configured
- `window.__APP_CONFIG_ERROR__` is absent

Never paste or share the complete anonymous key in screenshots or support messages.

## 3. Supabase migrations

Apply every repository migration to the production Supabase project in chronological order. Record the final applied migration name in Issue #29.

Before continuing, confirm:

- public quote submission works through the approved RPC
- authenticated admin users can read and update CRM records
- anonymous visitors cannot read customer records
- invoice and payment tables have expected row-level security policies
- marketing attribution fields exist

## 4. End-to-end quote test

Use a clearly marked test customer, such as `Launch Test — Delete Me`.

1. Open the public event planner in a private browser window.
2. Select an event type, guest count, menu, add-ons, date, and time.
3. Confirm draft recovery restores only planning choices after refresh.
4. Confirm name, company, email, phone, address, notes, and marketing consent are not restored.
5. Submit the request.
6. Confirm the success message appears and the saved draft is cleared.
7. Sign into the production admin dashboard.
8. Confirm the lead appears once, with the correct source and attribution.
9. Change its status and refresh to confirm persistence.
10. Confirm the event appears on the calendar.
11. Create a test invoice and review totals before deleting or voiding test data.

## 5. Consent and analytics verification

Test in a fresh private browser session.

### Before analytics consent

- GA4 should not send analytics events.
- Meta Pixel should not send marketing events.
- Essential quote functionality should still work.

### After analytics consent

- Verify GA4 Realtime receives a page view and quote-funnel events.
- Verify Meta Events Manager receives the configured events.
- Confirm consent can be changed and revoked.

Do not launch paid traffic until both platforms receive test events reliably.

## 6. Public-site QA

Check desktop and mobile layouts for:

- header navigation and mobile menu
- keyboard focus and skip link
- Home, Catering, Corporate, About, Gallery, Contact, and Plan My Event pages
- phone and email links
- all primary calls to action
- gallery and admin-editable images
- quote validation, Back/Continue controls, review step, error state, and success state
- readable text, no horizontal scrolling, and no overlapping controls

Run the production smoke test and review the launch-readiness dashboard. Resolve every critical warning before launch; document any accepted non-critical warning in Issue #29.

## 7. Marketing launch

Create final campaign links with the campaign URL builder. Use consistent lowercase UTM values, for example:

- `utm_source=facebook`
- `utm_medium=paid_social`
- `utm_campaign=corporate_catering_launch`
- `utm_content=<creative-name>`

Start with a controlled budget. Confirm the first real ad click, landing-page session, quote start, and quote submission are attributed correctly before increasing spend.

## 8. Launch decision

Launch only when all of the following are true:

- production configuration is valid
- migrations are current
- end-to-end quote and CRM flow passes
- consent behavior passes
- GA4 and Meta test events are received
- mobile and desktop QA passes
- no critical launch-readiness warnings remain
- test customer data has been removed or clearly archived

Record the launch date, production deployment, migration version, and verifier name in Issue #29.