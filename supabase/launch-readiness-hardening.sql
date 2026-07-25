-- Project 318 launch-readiness hardening.
-- Apply after release-3-sales-platform.sql. Non-destructive and safe to rerun.
begin;

do $$
begin
  if to_regclass('public.follow_up_messages') is null
     or to_regprocedure('public.crm_is_admin()') is null then
    raise exception 'Release 3 and CRM migrations must be applied first';
  end if;
end $$;

alter table public.follow_up_messages drop constraint if exists follow_up_messages_status_check;
alter table public.follow_up_messages add column if not exists processing_started_at timestamptz;
alter table public.follow_up_messages add constraint follow_up_messages_status_check
  check (status in ('queued','processing','sent','failed','cancelled','suppressed'));

create or replace function public.sales_claim_due_followups(p_limit integer default 25)
returns setof public.follow_up_messages
language plpgsql
security definer
set search_path=public
as $$
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'Service role required' using errcode='42501';
  end if;
  update public.follow_up_messages set status='queued',processing_started_at=null
  where status='processing' and processing_started_at<now()-interval '15 minutes';
  return query
  with claims as (
    select id from public.follow_up_messages
    where status='queued' and scheduled_for<=now()
    order by scheduled_for,id
    for update skip locked
    limit least(greatest(coalesce(p_limit,25),1),100)
  )
  update public.follow_up_messages m
  set status='processing',processing_started_at=now()
  from claims
  where m.id=claims.id
  returning m.*;
end $$;

revoke all on function public.sales_claim_due_followups(integer) from public,anon,authenticated;
grant execute on function public.sales_claim_due_followups(integer) to service_role;

-- Sales opportunities preserve the pipeline audit chain. Archive/lose them instead of deleting them.
revoke delete on public.sales_opportunities from authenticated;

commit;
