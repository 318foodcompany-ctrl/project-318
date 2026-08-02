# Final Manual Action Checklist

Only the account owner or an authenticated external-service administrator can complete these items.

- [ ] Review and approve the draft integration PR; record the approved commit SHA. Do not merge until every staging gate passes.
- [ ] Provide or confirm a disposable staging Supabase project and separately scoped test credentials; never provide production credentials for automated testing.
- [ ] Back up production, confirm PITR/retention, and perform a documented staging restore rehearsal.
- [ ] Apply the authoritative migration sequence to disposable staging and approve the captured validations before authorizing production migration.
- [ ] Confirm the production Supabase project reference, Auth URLs, administrator account/role, RLS matrix, and private/public storage policies.
- [ ] Enter production environment variables in the hosting account using `PRODUCTION-ENVIRONMENT-CHECKLIST.md`; verify secrets are server-only.
- [ ] Verify the Resend domain, SPF/DKIM, transactional sender, marketing sender, monitored reply-to, API key, and production webhook signing secret.
- [ ] Create the Resend webhook subscriptions and validate signed delivery, bounce, complaint, unsubscribe, open, and click events with provider-approved test events.
- [ ] Create/configure the production OpenAI project key, model, spend/rate limits, and data-handling policy; approve one draft-only generation.
- [ ] Configure the authenticated scheduler with `FOLLOW_UP_CRON_SECRET`, but leave it disabled until the launch gate authorizes activation.
- [ ] Approve business phone, email, lead-response wording, notification mailbox, canonical public URL, administrator URL, GA4 ID, Meta Pixel ID, and consent behavior.
- [ ] Complete authenticated staging UI checks for CRM, proposals, portal, bookings, invoices/payments, uploads, marketing AI, campaigns, templates, sequences, reporting, and launch readiness.
- [ ] Review `/preview/3d-home.html` separately and decide whether to pursue it later; do not replace or link it from the production homepage in this release.
- [ ] Authorize the immutable production deployment and production migrations during a staffed rollback window.
- [ ] Complete and sign off the post-deployment smoke test and first-24-hour monitoring checkpoints.
