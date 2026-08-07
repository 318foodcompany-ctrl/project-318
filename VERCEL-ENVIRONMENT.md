# Vercel public Supabase configuration

Project 318 loads its browser-safe Supabase configuration from
`/api/runtime-config`. The endpoint reads two Vercel environment variables and
returns only those two public values. It never returns server credentials.

## Required variables

| Variable | Production | Preview | Development |
| --- | --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | `https://qanetxmyoxpqnwsntmqz.supabase.co` | `https://owsxnyxkgzplvrxaijop.supabase.co` | Staging URL or a local Supabase URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Existing production **public anon** key | Project 318 Staging **public anon** key | Matching staging/local **public anon** key |
| `PUBLIC_GA4_MEASUREMENT_ID` | Production GA4 measurement ID | Staging/test GA4 ID or unset | Test ID or unset |
| `PUBLIC_META_PIXEL_ID` | Production Meta Pixel ID | Staging/test Pixel ID or unset | Test ID or unset |

The tracking identifiers are public identifiers, not secrets. Tracking remains
disabled until the visitor grants the applicable consent.

## Server-only Marketing and SEO Assistant variables

| Variable | Production | Preview | Development |
| --- | --- | --- | --- |
| `MARKETING_AI_API_URL` | Approved HTTPS JSON-compatible AI endpoint | Staging endpoint | Local/test endpoint |
| `MARKETING_AI_API_KEY` | Production provider secret | Separate staging secret | Developer test secret |
| `MARKETING_AI_MODEL` | Approved production model name | Staging model name | Test model name |

These variables are read only by `/api/admin-marketing-assistant`. Never prefix
them with `PUBLIC_`, and never add them to browser configuration or Git. The API
fails closed when configuration is absent and independently verifies both the
Supabase session and `crm_is_admin()` before contacting the provider.

Set each value in **Vercel → Project 318 → Settings → Environment Variables**
and select only the environment named in its column. Preview values must not be
copied into Production, and Production values must not be copied into Preview.
Redeploy after changing an environment variable because existing deployments do
not inherit later changes.

Only the public anon key is permitted. Never configure a service-role key,
database password, signed-in access token, refresh token, or other privileged
credential under either public variable.

## Server-only Release 1 lead automation variables

These values are consumed only by `/api/lead-submit`. None are returned by
`/api/runtime-config`, and none may be prefixed into browser configuration.

| Variable | Production | Preview | Development |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service-role JWT | Staging service-role JWT | Staging/local service-role JWT |
| `LEAD_RATE_LIMIT_SECRET` | Unique random secret, at least 32 characters | Different Preview secret | Different local secret |
| `LEAD_RATE_LIMIT_MAX` | `5` recommended | `20` for QA | `50` for automated local QA |
| `LEAD_RATE_LIMIT_WINDOW_SECONDS` | `900` recommended | `900` | `900` |
| `TRANSACTIONAL_EMAIL_PROVIDER` | `resend` after provider approval | `test` or Resend sandbox | `test` |
| `TRANSACTIONAL_EMAIL_FROM` | Verified sender, such as `318 Food Co. <quotes@domain>` | Sandbox sender | Optional in test mode |
| `RESEND_API_KEY` | Production Resend secret | Separate sandbox secret, or unset in test mode | Unset in test mode |
| `LEAD_NOTIFICATION_TO` | Owner notification mailbox | Staging sink mailbox | Test mailbox |
| `ADMIN_BASE_URL` | `https://www.318foodco.com` | Current Preview origin | Local Vercel origin |
| `BUSINESS_PHONE` | Public business phone used in confirmation copy | Test business phone | Test business phone |
| `BUSINESS_EMAIL` | Public business email used in confirmation copy | Test business email | Test business email |
| `LEAD_RESPONSE_EXPECTATION` | Approved promise, or unset | Test wording or unset | Test wording or unset |

`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `LEAD_RATE_LIMIT_SECRET` are
privileged secrets. Scope each value to its matching Vercel environment. Never
place them in HTML, browser JavaScript, `/api/runtime-config`, Git, screenshots,
or support messages.

## Failure behavior

If either required value is missing or the URL is not an HTTPS Supabase project
URL, `/api/runtime-config` returns HTTP 503. The browser does not create a
Supabase client and displays a configuration error instead of falling back to a
different project.

## Local Vercel testing

Use `.env.local` for `vercel dev`; it is excluded by `.gitignore`. Never commit
real values. The checked-in `.env.test.example` remains placeholders only.
