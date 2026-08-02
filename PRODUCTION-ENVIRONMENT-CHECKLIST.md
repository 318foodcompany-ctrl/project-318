# Production Environment Checklist

This is the authoritative variable inventory. Configure values separately for Preview/Staging and Production. Never copy production secrets into local tests or expose server-only values through `/api/runtime-config`.

| Variable | Class / launch role | Format and safe test value | Verification / absent behavior |
|---|---|---|---|
| `PUBLIC_SUPABASE_URL` | Browser-safe; core required | HTTPS Supabase origin; staging project URL | `/api/runtime-config` returns it; app fails closed if absent |
| `PUBLIC_SUPABASE_ANON_KEY` | Browser-safe; core required | Matching public anon JWT | Public/admin clients cannot initialize if absent |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret; core automation | Matching service-role JWT; never use a fake production value | Server writes, portal uploads, PDFs, runner/webhook fail closed |
| `TRANSACTIONAL_EMAIL_PROVIDER` | Server; transactional email | Production `resend`; staging `test` | `test` renders without delivery; absent returns honest unconfigured state |
| `TRANSACTIONAL_EMAIL_FROM` | Server; transactional email | Verified `Name <mailbox@domain>` | Delivery disabled when live provider lacks sender |
| `RESEND_API_KEY` | Server secret; email | Separate Resend key per environment; omit in test mode | Live delivery disabled when absent |
| `LEAD_NOTIFICATION_TO` | Server; core lead operations | Monitored email; staging sink only | Owner notification disabled/honestly reported |
| `BUSINESS_PHONE` | Server copy; core | E.164 or approved display number | Confirmation uses configured/fallback contact copy |
| `BUSINESS_EMAIL` | Server copy; core | Monitored address | Confirmation uses configured/fallback contact copy |
| `LEAD_RESPONSE_EXPECTATION` | Optional copy | Approved promise or unset | No unapproved timing promise is shown |
| `LEAD_RATE_LIMIT_SECRET` | Server secret; core abuse protection | Unique 32+ random characters | Lead intake fails closed |
| `LEAD_RATE_LIMIT_MAX` | Server; optional tuning | Positive integer; staging `20` | Safe default applies |
| `LEAD_RATE_LIMIT_WINDOW_SECONDS` | Server; optional tuning | Positive integer; staging `900` | Safe default applies |
| `FOLLOW_UP_CRON_SECRET` | Server secret; scheduler required | Unique 32+ random characters | Runner rejects all requests |
| `EMAIL_WEBHOOK_SECRET` | Server secret; marketing email | Resend/Svix `whsec_â€¦` | Provider events are rejected/not recorded |
| `MARKETING_EMAIL_FROM` | Server; marketing email | Verified marketing sender | Marketing delivery disabled |
| `MARKETING_EMAIL_REPLY_TO` | Server; optional | Monitored email | Replies use provider/default sender behavior |
| `AI_PROVIDER` | Server; AI | Production `openai`; staging `test` | AI generation disabled when absent; `test` is deterministic/no network |
| `AI_MODEL` | Server; AI | Approved model identifier | Live AI disabled when absent |
| `OPENAI_API_KEY` | Server secret; AI | OpenAI project key; omit in test mode | Live AI disabled; key never reaches browser |
| `AI_REQUEST_TIMEOUT_MS` | Server; optional AI tuning | `3000`â€“`60000`; test `10000` | Bounded default applies |
| `AI_MAX_OUTPUT_TOKENS` | Server; optional AI tuning | `300`â€“`5000`; test `1200` | Bounded default applies |
| `MARKETING_AI_API_URL` | Server; legacy SEO assistant | Approved HTTPS endpoint | Legacy assistant disabled |
| `MARKETING_AI_API_KEY` | Server secret; legacy SEO assistant | Provider key | Legacy assistant disabled |
| `MARKETING_AI_MODEL` | Server; legacy SEO assistant | Provider model name | Legacy assistant disabled |
| `PUBLIC_GA4_MEASUREMENT_ID` | Browser-safe; optional analytics | `G-â€¦` or unset in staging | GA4 remains off; consent still required |
| `PUBLIC_META_PIXEL_ID` | Browser-safe; optional analytics | Numeric ID or unset in staging | Pixel remains off; consent still required |
| `PUBLIC_SITE_URL` | Server/public origin; core marketing links | Canonical HTTPS origin | Unsubscribe links cannot be safely generated |
| `ADMIN_BASE_URL` | Server origin; core email links | HTTPS admin/public deployment origin | Admin links in email disabled/fallback |

Credential-dependent tests use only disposable staging values: `CRM_TEST_SUPABASE_URL`, `CRM_TEST_ANON_KEY`, `CRM_TEST_ADMIN_TOKEN`, `CRM_TEST_SERVICE_ROLE_KEY`, `INVOICE_TEST_SUPABASE_URL`, `INVOICE_TEST_ANON_KEY`, `INVOICE_TEST_ADMIN_TOKEN`, and `INVOICE_TEST_SERVICE_ROLE_KEY`. `PROJECT318_BASE_URL` is optional for remote smoke testing. Confirm all public variables are the only values returned by `/api/runtime-config`, inspect built browser assets for secret names/values, and redeploy after environment changes.

## Staging-only validation variables

These values never belong in Production. The automated suites use the `CRM_TEST_*` and `INVOICE_TEST_*` names; the `STAGING_*` names are operator inputs for migration and browser smoke testing.

| Variable | Classification | Purpose |
|---|---|---|
| `STAGING_SUPABASE_URL` | Staging-only operator value; public-safe URL | Positively identify the disposable project before migration |
| `STAGING_SUPABASE_ANON_KEY` | Staging-only browser-safe key | Anonymous/public RLS and UI testing |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | Staging-only server secret | Migration/server workflow setup; never expose to browser |
| `STAGING_ADMIN_EMAIL` / `STAGING_ADMIN_PASSWORD` | Staging-only secrets | Obtain a fresh administrator JWT with `app_metadata.role=admin` |
| `STAGING_TEST_USER_EMAIL` / `STAGING_TEST_USER_PASSWORD` | Staging-only secrets | Verify ordinary authenticated denial |
| `CRM_TEST_SUPABASE_URL` / `CRM_TEST_ANON_KEY` | Staging-only test inputs | CRM and Release 4 database suites |
| `CRM_TEST_ADMIN_TOKEN` / `CRM_TEST_SERVICE_ROLE_KEY` | Staging-only secrets | Administrator/service validation; rotate after use |
| `INVOICE_TEST_SUPABASE_URL` / `INVOICE_TEST_ANON_KEY` | Staging-only test inputs | Invoice integrity and concurrency suites |
| `INVOICE_TEST_ADMIN_TOKEN` / `INVOICE_TEST_SERVICE_ROLE_KEY` | Staging-only secrets | Invoice administrator/service validation; rotate after use |
| `PROJECT318_BASE_URL` | Optional staging/local test input | Remote public-route smoke-test origin |
| `VERCEL_ENV` | Platform-provided, environment-specific | Prevents AI test mode from operating in Production; do not set manually |

Production-only values are the live variants of Supabase, Resend, OpenAI, sender, webhook, scheduler, site/admin URL, business contact, and optional analytics settings in the main table. Production values must be created and scoped in the hosting/provider accounts; they must never be copied into staging or committed.
