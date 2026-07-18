# Project 318 Meta Pixel setup

The Meta Pixel integration is disabled until a valid public pixel ID is configured.

## Preview validation

1. Create or select the correct Meta Pixel in Meta Events Manager.
2. Add `PUBLIC_META_PIXEL_ID` to the Vercel Preview environment only.
3. Redeploy the Preview deployment.
4. Open the Preview site in a clean browser session.
5. Confirm no request to `connect.facebook.net/en_US/fbevents.js` occurs before a privacy choice is made.
6. Choose Reject optional and confirm Meta does not load.
7. Open Privacy settings, enable Advertising, and save.
8. Confirm the Meta script loads and PageView is emitted.
9. Submit a test quote and confirm a Lead event is emitted.
10. Remove any test quote and associated test records.

## Production activation

1. Confirm the Preview checks pass.
2. Add the same `PUBLIC_META_PIXEL_ID` to the Vercel Production environment.
3. Redeploy Production.
4. Repeat the consent, PageView, Contact, and Lead smoke checks.

## Safety notes

- The pixel ID is public configuration, not a secret.
- The integration does not load before advertising consent.
- Rejecting optional storage keeps Meta disabled.
- No customer names, email addresses, phone numbers, notes, or form values are sent by this provider.
- Standard events are limited to PageView, Lead, and Contact. Other Project 318 events are sent as custom event names with bounded primitive properties.
