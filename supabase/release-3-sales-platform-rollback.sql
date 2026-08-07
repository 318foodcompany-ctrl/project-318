-- Release 3 rollback. Refuses destructive removal when business records exist.
begin;
do $$
begin
  if exists(select 1 from public.proposals limit 1)
     or exists(select 1 from public.sales_opportunities limit 1)
     or exists(select 1 from public.follow_up_messages limit 1)
     or exists(select 1 from public.customer_portal_messages limit 1)
     or exists(select 1 from public.customer_documents limit 1) then
    raise exception 'Rollback refused: Release 3 business records exist. Preserve/export them before manual rollback.';
  end if;
end $$;
drop function if exists public.sales_merge_customers(uuid,uuid);
drop function if exists public.sales_schedule_due_followups();
drop function if exists public.sales_portal_respond(text,uuid,text,text);
drop function if exists public.sales_portal_snapshot(text);
drop function if exists public.sales_create_portal_token(uuid,timestamptz);
drop function if exists public.sales_set_proposal_status(uuid,text);
drop function if exists public.sales_save_proposal(uuid,uuid,bigint,bigint,uuid,text,date,text,text,numeric,numeric,jsonb);
drop trigger if exists sales_quote_opportunity_sync on public.leads;
drop function if exists public.sales_sync_quote_opportunity();
drop table if exists public.follow_up_messages;
drop table if exists public.follow_up_rules;
drop table if exists public.customer_documents;
drop table if exists public.customer_portal_messages;
drop table if exists public.customer_portal_tokens;
drop table if exists public.proposal_line_items;
drop table if exists public.proposal_versions;
drop table if exists public.proposals;
drop table if exists public.sales_comments;
drop table if exists public.sales_stage_history;
drop table if exists public.sales_opportunities;
alter table public.bookings drop column if exists delivery_departure_at;
alter table public.bookings drop column if exists kitchen_start_at;
alter table public.bookings drop column if exists calendar_color;
commit;
