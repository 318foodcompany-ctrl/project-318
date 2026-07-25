-- Removes only launch-readiness hardening. Refuses while a worker owns messages.
begin;
do $$
begin
  if exists(select 1 from public.follow_up_messages where status='processing') then
    raise exception 'Rollback refused: follow-up messages are currently processing';
  end if;
end $$;
drop function if exists public.sales_claim_due_followups(integer);
alter table public.follow_up_messages drop constraint if exists follow_up_messages_status_check;
alter table public.follow_up_messages add constraint follow_up_messages_status_check
  check (status in ('queued','sent','failed','cancelled','suppressed'));
alter table public.follow_up_messages drop column if exists processing_started_at;
grant delete on public.sales_opportunities to authenticated;
commit;
