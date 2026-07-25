-- Non-destructive rollback for Release 1.
-- This disables the new server RPCs and policies but intentionally preserves
-- all lead, consent, idempotency, rate-limit, and email-delivery evidence.
begin;

revoke all on function public.submit_release1_lead(
  uuid,text,text,integer,integer,text,text,text,text,text,date,integer,text,text,numeric,text,jsonb,boolean,text,text,text
) from public, anon, authenticated, service_role;
revoke all on function public.record_lead_email_delivery(bigint,text,text,text,text,text)
  from public, anon, authenticated, service_role;

drop policy if exists "CRM administrators can read submission receipts"
  on public.lead_submission_idempotency;
drop policy if exists "CRM administrators can read consent history"
  on public.marketing_consent_history;
drop policy if exists "CRM administrators can read email deliveries"
  on public.lead_email_deliveries;

comment on table public.lead_submission_idempotency is
  'Release 1 disabled; retained for accounting and operational evidence.';
comment on table public.marketing_consent_history is
  'Release 1 disabled; retained as consent evidence.';
comment on table public.lead_email_deliveries is
  'Release 1 disabled; retained as delivery evidence.';

commit;
