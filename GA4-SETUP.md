# Project 318 GA4 activation

The site now contains a consent-aware Google Analytics 4 provider. It remains disabled until a valid public measurement ID is configured.

## Vercel configuration

Add this environment variable separately in Preview and Production:

`PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX`

Use the measurement ID from the correct GA4 web data stream. Do not use a Measurement Protocol API secret or any private Google credential.

## Behavior

- GA4 does not load before analytics consent is granted.
- Rejecting optional storage leaves GA4 disabled.
- Withdrawing analytics consent prevents future Project 318 events from being sent.
- Advertising signals and ad personalization signals are disabled in the GA4 configuration.
- Page views, quote interactions, phone clicks, email clicks, directions, downloads, CTA clicks, and scroll depth use the existing Project 318 analytics event framework.

## Production verification

1. Configure the Production environment variable.
2. Deploy the matching application commit.
3. Open the site in a private browser window.
4. Reject optional storage and verify no `gtag/js` request is made.
5. Reset Privacy settings, accept analytics, and verify the GA4 script loads.
6. Confirm `page_view` and a test CTA event in GA4 DebugView or Realtime.
7. Do not include test customer information in analytics event properties.

## Owner dashboard reporting

The private owner dashboard can read aggregate GA4 reports through the Google Analytics Data API. Configure these server-only Production variables in Vercel:

- `GA4_PROPERTY_ID` — the numeric GA4 property ID, not the `G-` measurement ID.
- `GOOGLE_ANALYTICS_CLIENT_EMAIL` — the dedicated service-account email granted Viewer access to this GA4 property.
- `GOOGLE_ANALYTICS_PRIVATE_KEY` — the service-account JSON private key value. Store it only as an encrypted Vercel environment variable and never commit the JSON key file.

The service identity needs only Viewer access at the property level. It does not need a Google Cloud project IAM role. The owner dashboard endpoint requires an authenticated Project 318 administrator session, uses the `analytics.readonly` scope, returns aggregate reporting data, and does not expose credentials to the browser.

If Google Analytics does not accept a service identity, use owner OAuth instead. Configure `GOOGLE_ANALYTICS_OAUTH_CLIENT_ID`, `GOOGLE_ANALYTICS_OAUTH_CLIENT_SECRET`, and `GOOGLE_ANALYTICS_OAUTH_REFRESH_TOKEN` as encrypted Production variables. The OAuth grant must request only `analytics.readonly` and offline access. When complete OAuth credentials are present they take precedence over the service-account variables.

## Project-scoped Google reporting

The server also supports a Google workload identity provider restricted to this Vercel project's Production environment. Set the private Production variable `GOOGLE_ANALYTICS_WORKLOAD_PROVIDER` to the Google resource path starting with `projects/`. Set `GOOGLE_ANALYTICS_CLIENT_EMAIL` to the dedicated Analytics Viewer and `GA4_PROPERTY_ID` to the GA4 property number. These identifiers contain no private keys. The authenticated reporting endpoint exchanges Vercel's request identity for an Analytics-only credential that lasts ten minutes. Federation takes priority when configured.

Google's trust condition must match the Vercel project ID and Production environment. Bind impersonation on the dedicated Analytics Viewer service account only. Retire unused OAuth grants and old keys. Confirm the dashboard renders a dated report as an administrator and that an anonymous request is denied.
