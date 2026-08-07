# Release 5: AI Marketing Autopilot

Release 5 turns the existing Release 4 AI draft generator into a configurable, scheduled marketing work system while preserving explicit administrator control.

## Core rule

AI may research from approved internal context, prioritize work, and generate drafts automatically. It may not publish website content, send marketing email, post to social networks, change ad spend, or enroll customers automatically.

Administrator approval is mandatory for every generated task. Publishing is a separate explicit action after approval and is currently implemented only for website blog posts and FAQ items.

## What Release 5 adds

- Business Brain with mission, business facts, voice preferences, growth priorities, prohibited claims, and seasonal rules.
- Selectable automation settings for blogs, FAQs, SEO recommendations, Facebook, Instagram, LinkedIn, Google Business, newsletters, promotional email, landing pages, seasonal campaigns, holiday campaigns, analytics summaries, and growth recommendations.
- Daily, weekly, monthly, or custom-interval scheduling.
- Selectable items per run, preferred hour, weekly day, monthly day, timezone, tone, audience, goal, and per-automation instructions.
- Durable AI task queue with atomic service-role claiming and stuck-claim recovery.
- Approval queue with edit, approve, reject, regenerate, archive, and audit history.
- Explicit post-approval publishing connector for blog posts and FAQs.
- Server-rendered public blog index and article routes.
- Dynamic sitemap that includes published blog posts.

## Migrations

Apply only after all Release 4 and launch-readiness migrations:

1. `supabase/release-5-ai-marketing-autopilot.sql`
2. `supabase/release-5-ai-marketing-autopilot-runtime.sql`
3. `supabase/release-5-ai-autopilot-scheduling.sql`
4. `supabase/release-5-ai-content-publishing.sql`

All migrations are additive. Do not apply them to Production until the current launch candidate is approved and Release 5 has passed isolated staging validation.

## Scheduler

Call `/api/marketing-autopilot-run` on a recurring cadence. The endpoint supports authenticated `GET` or `POST` requests and accepts the first configured secret from:

1. `AI_AUTOPILOT_CRON_SECRET`
2. `CRON_SECRET`
3. `FOLLOW_UP_CRON_SECRET`

The chosen secret must be at least 32 characters and remain server-only. A scheduler can safely call the endpoint every 5–15 minutes; individual automation preferences determine whether any task is actually due.

The scheduler queues due work, claims up to ten tasks per invocation, generates through the existing OpenAI provider, stores each result as a Release 4 draft, and marks the task `ready_for_approval`.

It performs zero publication and zero send actions.

## Approval workflow

`ai-autopilot.html` is administrator-only and noindex.

For generated drafts the administrator can:

- edit structured content;
- approve;
- reject;
- regenerate;
- review audit history.

Approval alone does not publish or send anything.

Approved `blog_draft` and `faq_draft` tasks expose a separate Publish action. Blog publishing creates or updates a `blog_posts` row. FAQ publishing creates a published `faq_items` row. Publication is idempotency-protected by the approval audit.

Approved social, Google Business, email, landing-page, SEO, analytics, and growth drafts remain approved work products until a separately reviewed connector exists.

## Blog SEO

Published blog posts are server-rendered at:

- `/blog`
- `/blog/:slug`

Article responses include canonical metadata, description metadata, Open Graph metadata, and BlogPosting structured data. `/sitemap.xml` is dynamically rendered and includes published blog articles.

## Environment variables

Existing Release 4 variables remain required for live OpenAI generation:

- `AI_PROVIDER=openai`
- `AI_MODEL`
- `OPENAI_API_KEY`
- `AI_REQUEST_TIMEOUT_MS`
- `AI_MAX_OUTPUT_TOKENS`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_SITE_URL`

Scheduler:

- `AI_AUTOPILOT_CRON_SECRET` — recommended dedicated 32+ character secret.

If using a platform scheduler that provides `CRON_SECRET`, the dedicated variable may be omitted. `FOLLOW_UP_CRON_SECRET` remains a final fallback for existing infrastructure.

## Safety and privacy

- OpenAI calls remain server-side.
- Browser code never receives OpenAI, service-role, webhook, or scheduler secrets.
- AI is instructed not to invent pricing, services, guarantees, reviews, rankings, search volume, or market data.
- Business Brain context contains approved business facts and preferences, not customer lists or private CRM notes.
- Analytics and growth drafts must separate observed facts from recommendations.
- Marketing consent and suppression behavior from Release 4 is unchanged.
- No social, ad-network, or Google Business publishing connector is included in this release.

## Validation before enabling scheduling

1. Apply all four Release 5 migrations to isolated staging only.
2. Confirm ordinary authenticated and anonymous users cannot read or mutate Release 5 management tables.
3. Confirm administrator access to `ai-autopilot.html`.
4. Save one disabled automation preference and verify its computed `next_run_at`.
5. Enable one test automation while `AI_PROVIDER=test`.
6. Invoke the scheduler with a staging-only secret.
7. Verify one task reaches `ready_for_approval` and that no website/email/provider action occurs.
8. Edit, regenerate, reject, and approve test drafts.
9. Publish one synthetic blog and one synthetic FAQ, verify public rendering, then remove the synthetic records.
10. Verify dynamic sitemap output contains the synthetic blog only while published.
11. Run the complete repository suite.
12. Keep Production untouched until explicit owner approval.

## Deferred provider connectors

These require provider account/API configuration and separate staging validation before implementation or activation:

- Meta/Facebook publishing
- Instagram publishing
- LinkedIn publishing
- Google Business Profile publishing
- Google Search Console data
- GA4 Data API analysis
- Google Ads API
- Meta Ads API

Release 5 intentionally creates approved drafts for these areas without silently taking external actions.
