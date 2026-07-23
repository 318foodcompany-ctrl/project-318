# Marketing launch checklist

Project 318 ships tracking and assistant infrastructure disabled by default. No
Google, Meta, or AI account is created or configured by this repository.

## Deployment order

1. Review and apply `supabase/marketing-ai-assistant.sql` in staging.
2. Confirm an authenticated administrator can create a draft and review it.
3. Configure the server-only AI variables documented in `VERCEL-ENVIRONMENT.md`.
4. Add the public GA4 and Meta identifiers to the intended Vercel environment.
5. Redeploy, accept analytics/advertising consent in a test browser, and verify
   events before enabling campaigns.

Do not run `supabase/marketing-ai-assistant-rollback.sql` during a normal
deployment. It deliberately refuses to remove the audit table when records exist.

## Account-owner actions

- **Google Analytics:** create/select the GA4 web stream, copy its `G-...`
  measurement ID, verify Realtime, and mark approved conversion events.
- **Google Search Console:** verify `www.318foodco.com` using an account-owner DNS
  change, submit `https://www.318foodco.com/sitemap.xml`, and review indexing.
- **Meta Events Manager:** create/select the Pixel, copy its numeric ID, and use
  Test Events to verify PageView, Contact, Lead, QuoteStarted, and QuoteSubmitted.
- **Consent:** obtain business/legal approval for the privacy and consent text.
  Analytics and advertising remain denied until the visitor chooses them.
- **Campaign:** verify the destination, UTM source/medium/campaign/content, budget,
  audience, and conversion destination. The application never launches ads.
- **AI provider:** select an approved JSON-compatible provider and model, fund the
  account if required, and store its key only in Vercel server variables.

## Verification

- Repeated events with the same event ID are delivered once per page session.
- A quote conversion fires only after Supabase returns the saved quote ID.
- Declined consent prevents GA4 and Meta providers from loading.
- First-party attribution continues to capture campaign context independently of
  optional advertising tags, as described on the privacy page.
- AI results enter `marketing_ai_audit` as `draft`; approval changes review state
  only and never publishes website content automatically.
- Anonymous and non-administrator requests to the assistant fail closed.
