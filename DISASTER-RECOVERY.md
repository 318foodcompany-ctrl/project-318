# Project 318 disaster recovery

## Priorities

1. Protect customer, event, accounting, consent, and audit data.
2. Stop unsafe writes or outbound messages.
3. Restore service from a known-good commit and verified backup.
4. Preserve evidence and document every action.

## Immediate containment

- Disable the affected Vercel deployment or route traffic to the last known-good deployment.
- Disable the follow-up scheduler before investigating duplicate or incorrect messaging.
- Rotate exposed secrets immediately in the provider, then update only the correct Vercel environment.
- Revoke compromised Supabase sessions and remove unauthorized administrator metadata.
- Do not delete suspicious rows. Preserve logs, timestamps, request IDs, and provider references.

## Incident categories

### Website or API outage

- Check Vercel deployment health and function logs.
- Verify `/api/runtime-config` references the expected environment.
- Roll traffic back to the last known-good deployment without running database rollbacks.
- Test public lead submission in safe provider/test mode.

### Database outage or bad migration

- Stop application writes and automation.
- Capture the exact SQL error and migration checksum.
- Prefer a forward corrective migration.
- Restore from backup only when corruption/data loss is confirmed and approved.
- Never run destructive rollback files against accounting, CRM, proposal, or activity data without a reviewed export and recovery plan.

### Email automation incident

- Disable the scheduler and affected rules.
- Inspect `follow_up_messages`, idempotency keys, provider references, and consent evidence.
- Messages stuck in `processing` become reclaimable after 15 minutes; do not manually duplicate them.
- Resume with one controlled test recipient before enabling the schedule.

### Portal or credential exposure

- Revoke affected portal tokens.
- Rotate service-role/cron/provider secrets if exposed.
- Review portal and API access logs for unauthorized customer IDs or document paths.
- Notify affected parties according to legal and contractual requirements.

## Recovery acceptance

- Approved commit deployed.
- Database integrity/security queries pass.
- Anonymous access denied.
- Administrator access verified with a fresh JWT.
- Lead, booking, invoice, payment, proposal, portal, upload, and follow-up smoke checks pass.
- Incident timeline, root cause, records affected, rotations, and preventive actions documented.
