# Release 4: AI marketing and automated email

Release 4 extends the existing administrator, CRM, consent, email, attribution, and follow-up systems. It does not publish social content, send SMS, enroll existing customers during migration, or make automatic AI calls.

## Architecture

- `marketing_campaigns` owns campaign lifecycle and tags.
- `marketing_ai_content` stores editable AI drafts and usage metadata. AI output never publishes or sends automatically.
- `marketing_email_templates` stores mobile-safe structured blocks and a plain-text fallback.
- `marketing_email_sequences` and `marketing_email_sequence_steps` define triggers, delays, and conditions.
- `marketing_email_enrollments` links a customer to one sequence and trigger occurrence.
- Existing `follow_up_messages` remains the only outbound queue. Release 4 adds campaign, template, enrollment, classification, HTML, retry, and attempt fields.
- `marketing_suppressions`, `marketing_unsubscribe_tokens`, and `marketing_consent_audit` preserve compliance state without deleting Release 1 consent evidence.
- `marketing_email_events` records idempotent provider events.

All management tables use the existing `public.crm_is_admin()` authorization rule. Anonymous access is denied except for the tokenized unsubscribe function.

## Migration

After all approved migrations through Launch Readiness:

1. Back up the staging database.
2. Apply `supabase/release-4-ai-marketing.sql` to staging.
3. Do not run the rollback during a successful deployment.
4. Verify no existing customer was enrolled and no message was queued by the migration.

The rollback refuses to remove Release 4 when business or compliance records exist.

## Environment variables

Server-only:

- `AI_PROVIDER=openai` or `test` outside Production.
- `AI_MODEL` — an approved OpenAI Responses API model.
- `OPENAI_API_KEY` — OpenAI project API key.
- `AI_REQUEST_TIMEOUT_MS` — 3,000–60,000 milliseconds.
- `AI_MAX_OUTPUT_TOKENS` — 300–5,000.
- `SUPABASE_SERVICE_ROLE_KEY`.
- `FOLLOW_UP_CRON_SECRET` — unique value of at least 32 characters.
- `TRANSACTIONAL_EMAIL_PROVIDER=resend` or `test` outside Production.
- `RESEND_API_KEY`.
- `MARKETING_EMAIL_FROM` — verified marketing sender.
- `MARKETING_EMAIL_REPLY_TO` — optional monitored reply address.
- `EMAIL_WEBHOOK_SECRET` — Resend/Svix signing secret beginning with `whsec_`.
- `ADMIN_BASE_URL`.
- `PUBLIC_SITE_URL` — canonical HTTPS public origin used for unsubscribe links.

Only the existing public Supabase URL and anon key may be exposed through browser runtime configuration.

## AI provider

The initial provider uses the OpenAI Responses API with a strict JSON schema. Requests are server-side, bounded, timed out, administrator-authorized, and persisted as drafts. Test mode returns deterministic content without contacting a provider. Provider error bodies, prompts, and credentials are never returned to the browser.

The administrator supplies only campaign facts required for the requested draft. Do not paste customer lists, private CRM notes, credentials, or protected-characteristic targeting into the generation form.

## Email templates and variables

Supported blocks: logo, preheader, headline, text, image, button, divider, testimonial, contact information, social links, and footer.

Supported variables:

`{{customer_name}}`, `{{first_name}}`, `{{company_name}}`, `{{event_date}}`, `{{event_type}}`, `{{proposal_link}}`, `{{portal_link}}`, `{{quote_total}}`, `{{business_phone}}`, `{{business_email}}`, and `{{unsubscribe_link}}`.

Unknown or missing variables render as empty text. The server escapes content and validates image/button URLs. Always review desktop, mobile, and plain-text previews.

## Sequences and queue behavior

Event triggers cover new quotes, proposal status, booking status, and event completion. The authorized runner also schedules time-based proposal, event, and inactivity sequences.

The queue:

- claims atomically through `sales_claim_due_followups`;
- recovers stuck claims after 15 minutes;
- rechecks marketing consent, global/campaign suppression, enrollment state, and campaign pause/cancellation immediately before sending;
- creates a fresh opaque unsubscribe token;
- uses the existing provider idempotency key;
- retries up to the stored maximum with bounded exponential delay;
- never blocks transactional messages on marketing consent.

Existing customers are not automatically enrolled by the migration. An active sequence affects only future qualifying events or explicit administrator enrollment.

## Consent, unsubscribe, and suppression

Marketing messages require affirmative Release 1 consent and no active suppression. One-click unsubscribe:

- requires no login;
- contains an opaque random token, never a customer ID;
- can suppress one campaign or all marketing;
- cancels queued marketing for the selected scope;
- appends a Release 4 consent audit record;
- never deletes historical consent evidence;
- never automatically resubscribes a customer.

Marketing deliveries also include standards-based `List-Unsubscribe` and
`List-Unsubscribe-Post` headers. The header endpoint performs a global
unsubscribe; the preference page additionally offers campaign-specific
suppression when the message belongs to a campaign.

Bounces and complaints create global suppression records. Lifting suppression requires an administrator decision and appropriate consent evidence.

## Provider webhook

Configure Resend to POST to:

`https://YOUR_DOMAIN/api/email-webhook`

Subscribe to sent, delivered, opened, clicked, delayed, bounced, complained, and failed events. Store the matching signing secret as `EMAIL_WEBHOOK_SECRET`. The endpoint uses the raw request body, validates the Svix signature and five-minute timestamp window, deduplicates provider event IDs, and stores only bounded metadata.

Open and click tracking are estimates affected by privacy software, image blocking, and automated link scanning.

Campaign reporting supports date, campaign, sequence, audience, source-tag,
and campaign-status filters. Lead, quote, booking, and revenue results are
counted only through explicit campaign enrollments and linked accounting
records; they are never estimated.

## Scheduler

Invoke `POST /api/follow-up-run` with:

`Authorization: Bearer FOLLOW_UP_CRON_SECRET`

Use one scheduler invocation at a time every 5–15 minutes. The database claim function makes concurrent calls safe, but overlapping schedules add no benefit.

## Known limitations and deferred items

- No SMS.
- No social-network publishing.
- No Google Ads or Meta Ads API.
- No chatbot.
- No bulk enrollment during migration.
- No automated daily AI summary; summaries are administrator-triggered drafts.
- Provider delivery events are recorded only after webhook configuration.
- Open and click measurements are not perfectly accurate.
