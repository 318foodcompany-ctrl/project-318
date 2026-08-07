# Release 5: AI Marketing Autopilot

Release 5 turns the existing Release 4 AI draft generator into a configurable, scheduled marketing work system while preserving explicit administrator control.

## Core rule

AI may analyze approved aggregate internal context, prioritize work, and generate drafts automatically. It may not publish website content, send marketing email, post to social networks, change ad spend, or enroll customers automatically.

Administrator approval is mandatory for every generated task. Publishing is a separate explicit action after approval and is currently implemented only for website blog posts and FAQ items.

## What Release 5 adds

- Business Brain with mission, verified public business facts, voice preferences, growth priorities, prohibited claims, and seasonal rules.
- Selectable automation settings for blogs, FAQs, SEO recommendations, Facebook, Instagram, LinkedIn, Google Business, newsletters, promotional email, landing pages, seasonal campaigns, holiday campaigns, analytics summaries, and growth recommendations.
- Daily, weekly, monthly, or custom-interval scheduling with selectable day, hour, timezone, and items per run.
- Durable AI task queue with atomic service-role claiming and stuck-claim recovery.
- Approval queue with edit, approve, reject, regenerate, archive, and audit history.
- Feedback-learning signals that record approvals, edits, rejections, and regeneration requests without automatically changing the Business Brain.
- Aggregate-only business/content snapshot for analytics, SEO, content-gap, and growth reasoning. It deliberately excludes customer identity, contact information, addresses, and private CRM notes.
- Explicit post-approval publishing connector for blog posts and FAQs.
- Server-rendered public blog index and article routes.
- Dynamic sitemap that includes published blog posts.

## Migrations

Apply only after all Release 4 and launch-readiness migrations, in this order:

1. `supabase/release-5-ai-marketing-autopilot.sql`
2. `supabase/release-5-ai-marketing-autopilot-runtime.sql`
3. `supabase/release-5-ai-autopilot-scheduling.sql`
4. `supabase/release-5-ai-content-publishing.sql`
5. `supabase/release-5-ai-intelligence-context.sql`
6. `supabase/release-5-ai-business-brain-seed.sql`
7. `supabase/release-5-ai-learning.sql`

The Business Brain seed uses verified public facts already present in Project 318's public SEO schema and only populates the default empty brain; it does not overwrite later owner customization.

All migrations are additive. Do not apply them to Production until the current launch candidate is approved and Release 5 has passed isolated staging validation.

## Scheduler

Call `/api/marketing-autopilot-run` on a recurring cadence. The endpoint supports authenticated `GET` or `POST` requests and accepts the first configured secret from:

1. `AI_AUTOPILOT_CRON_SECRET`
2. `CRON_SECRET`
3. `FOLLOW_UP_CRON_SECRET`

The chosen secret must be at least 32 characters and remain server-only. A scheduler can safely call the endpoint every 5–15 minutes; individual automation preferences determine whether any task is actually due.

The scheduler queues due work, claims up to ten tasks per invocation, obtains an aggregate 30-day business/content snapshot, generates through the existing OpenAI provider, stores each result as a Release 4 draft, and marks the task `ready_for_approval`.

It performs zero publication and zero send actions.

## Approval workflow

`ai-autopilot.html` is administrator-only and noindex.

For generated drafts the administrator can edit structured content, approve, reject, regenerate, and review audit history. Approval alone does not publish or send anything.

Approved `blog_draft` and `faq_draft` tasks expose a separate Publish action. Blog publishing creates or updates a `blog_posts` row. FAQ publishing creates a published `faq_items` row. Publication is idempotency-protected by the approval audit.

Approved social, Google Business, email, landing-page, SEO, analytics, and growth drafts remain approved work products until a separately reviewed connector exists.

## Feedback learning

Administrator choices are recorded as structured feedback signals in `marketing_ai_feedback_signals`.

- Approve records a positive signal.
- Edit records the before and after structured draft so future analysis can identify recurring owner preferences.
- Reject and Regenerate can retain the administrator's reason.
- `marketing_ai_feedback_summary()` returns aggregate counts and recent written reasons for service-side learning analysis.

The learning layer deliberately does **not** rewrite the Business Brain or change generation policy automatically. A future preference recommendation must be reviewed before it becomes a persistent Business Brain rule. This prevents a few accidental approvals or edits from silently changing the brand.

## Business intelligence context

`public.marketing_ai_business_snapshot()` returns aggregate counts and totals for recent leads, bookings, invoices, payments, and a content inventory of published blog/FAQ/event topics. It is service-role-only.

The snapshot deliberately excludes customer names, companies, email addresses, phone numbers, physical addresses, customer notes, proposal notes, uploaded documents, and other private CRM text. The AI receives the aggregate snapshot plus the Business Brain; it does not receive raw customer records from the Autopilot scheduler.

This lets analytics and growth drafts distinguish actual internal evidence from suggestions while keeping customer data out of OpenAI prompts.

## Blog SEO

Published blog posts are server-rendered at `/blog` and `/blog/:slug`. Article responses include canonical metadata, description metadata, Open Graph metadata, and BlogPosting structured data. `/sitemap.xml` is dynamically rendered and includes published blog articles.

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
- AI is instructed not to invent pricing, services, guarantees, reviews, rankings, search volume, market data, availability, or promotions.
- Business Brain context contains approved public business facts and preferences, not customer lists or private CRM notes.
- Analytics and growth drafts must separate observed facts from recommendations.
- Feedback learning is explicit and reviewable; it does not autonomously mutate brand policy.
- Marketing consent and suppression behavior from Release 4 is unchanged.
- No social, ad-network, or Google Business publishing connector is included in this release.

## Validation before enabling scheduling

1. Apply all seven Release 5 migrations to isolated staging only.
2. Confirm ordinary authenticated and anonymous users cannot read or mutate Release 5 management tables.
3. Confirm only service role can call the aggregate business snapshot, feedback summary, and task-scheduler RPCs.
4. Confirm administrator access to `ai-autopilot.html`.
5. Save one disabled automation preference and verify its timezone-aware `next_run_at`.
6. Enable one test automation while `AI_PROVIDER=test`.
7. Invoke the scheduler with a staging-only secret.
8. Verify one task reaches `ready_for_approval` and that no website/email/provider action occurs.
9. Inspect the generated input/audit metadata and confirm no customer PII was included.
10. Edit, regenerate, reject, and approve test drafts; verify feedback signals are recorded.
11. Publish one synthetic blog and one synthetic FAQ, verify public rendering, then remove the synthetic records.
12. Verify dynamic sitemap output contains the synthetic blog only while published.
13. Run the complete repository suite.
14. Keep Production untouched until explicit owner approval.

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
