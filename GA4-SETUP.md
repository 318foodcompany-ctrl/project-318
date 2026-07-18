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
