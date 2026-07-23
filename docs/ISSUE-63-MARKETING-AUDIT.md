# Issue 63 marketing systems audit

## Existing foundations retained

- Consent manager with optional analytics and advertising categories denied by
  default, versioned choices, expiry, and Google Consent Mode signals.
- First-party visitor/session attribution with first-touch and last-non-direct
  UTM, referrer, landing page, GCLID, GBRAID, WBRAID, and FBCLID capture.
- Atomic public quote submission that links attribution without exposing private
  CRM data.
- Revenue, funnel, and ad-spend reporting RPCs and an administrator dashboard.
- Environment-based browser configuration for public GA4 and Meta identifiers.
- GA4 and Meta provider adapters, campaign URL builder, sitemap, robots file,
  canonical metadata, structured data, and launch-readiness checks.

## Gaps corrected by this change

- Successful quote conversion is emitted only after database persistence, not on
  an unconfirmed form submit.
- Stable event IDs and in-page deduplication protect GA4 and Meta conversions from
  duplicate delivery. Meta receives both standard Lead/Contact events and the
  explicit QuoteStarted/QuoteSubmitted custom events requested by issue 63.
- A server-only, administrator-authorized Marketing and SEO Assistant analyzes
  public-page SEO and aggregated marketing performance without sending customer
  identity data to the provider.
- All assistant output is persisted as a draft in an immutable audit trail.
  Administrator approval or rejection is controlled through a guarded RPC and
  never publishes content or changes an advertising account.
- The admin launch checklist now separates automated verification from actions
  requiring the Google/Meta/DNS account owner.
- Environment, deployment, consent, and manual account steps are documented.

## Intentionally manual or deferred

- Google Analytics, Search Console, and Meta accounts must be created, verified,
  and funded by their owner. The repository cannot safely do this automatically.
- Google Search Console has no browser tag in this implementation; DNS ownership
  verification and sitemap submission are account-owner actions.
- AI recommendations never auto-publish. Applying a recommendation remains an
  explicit administrator content-editing task.
- No Conversions API token is accepted in the browser. Server-side Meta CAPI can
  be added later only with a documented deduplication and credential strategy.
- Existing first-party attribution storage remains necessary for quote operations
  and is disclosed on the privacy page. Optional GA4/Meta scripts remain consent
  gated.
