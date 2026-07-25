-- Release 4 rollback. Refuses to remove business or compliance records.
begin;
do $$
begin
  if exists(select 1 from public.marketing_campaigns)
     or exists(select 1 from public.marketing_ai_content)
     or exists(select 1 from public.marketing_email_templates)
     or exists(select 1 from public.marketing_email_enrollments)
     or exists(select 1 from public.marketing_suppressions)
     or exists(select 1 from public.marketing_consent_audit)
     or exists(select 1 from public.marketing_email_events) then
    raise exception 'Rollback refused: Release 4 contains business or compliance records';
  end if;
end $$;
drop function if exists public.marketing_campaign_report(date,date,uuid);
drop function if exists public.marketing_campaign_report(date,date,uuid,uuid,text,text,text);
drop function if exists public.marketing_cancel_enrollment(uuid);
drop function if exists public.marketing_reorder_step(uuid,integer);
drop function if exists public.marketing_validate_claim(uuid);
drop trigger if exists marketing_lead_enrollment on public.leads;
drop trigger if exists marketing_proposal_enrollment on public.proposals;
drop trigger if exists marketing_booking_enrollment on public.bookings;
drop function if exists public.marketing_event_enrollment();
drop function if exists public.marketing_schedule_time_enrollments();
drop function if exists public.marketing_enroll_customer(uuid,uuid,text,bigint,uuid,bigint);
drop function if exists public.marketing_unsubscribe(text,text,uuid);
drop function if exists public.marketing_create_unsubscribe_token(uuid,integer);
drop function if exists public.marketing_is_suppressed(text,uuid);
drop function if exists public.marketing_has_consent(uuid);
drop table if exists public.marketing_email_events;
drop table if exists public.marketing_consent_audit;
drop table if exists public.marketing_unsubscribe_tokens;
drop table if exists public.marketing_suppressions;
drop table if exists public.marketing_email_enrollments;
drop table if exists public.marketing_email_sequence_steps;
drop table if exists public.marketing_email_sequences;
drop table if exists public.marketing_email_templates;
drop table if exists public.marketing_ai_content;
drop table if exists public.marketing_campaigns;
alter table public.follow_up_messages drop column if exists campaign_id;
alter table public.follow_up_messages drop column if exists template_id;
alter table public.follow_up_messages drop column if exists enrollment_id;
alter table public.follow_up_messages drop column if exists classification;
alter table public.follow_up_messages drop column if exists html_body;
alter table public.follow_up_messages drop column if exists retry_count;
alter table public.follow_up_messages drop column if exists max_retries;
alter table public.follow_up_messages drop column if exists last_attempt_at;
drop function if exists public.marketing_touch_updated_at();
commit;
