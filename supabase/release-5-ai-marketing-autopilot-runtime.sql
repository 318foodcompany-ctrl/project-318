Exit code: 0
Wall time: 0.7 seconds
Output:
-- Release 5 runtime helpers. Apply immediately after release-5-ai-marketing-autopilot.sql.
begin;

-- PostgreSQL cannot change a table-returning function's OUT columns through
-- CREATE OR REPLACE. The base migration intentionally installs the initial
-- five-column helper, so replace it explicitly with the owner-aware version.
drop function if exists public.marketing_ai_claim_due_task(integer);

create or replace function public.marketing_ai_claim_due_task(p_claim_minutes integer default 15)
returns table(
  id uuid,
  automation_setting_id uuid,
  content_type text,
  generation_input jsonb,
  attempt_count integer,
  created_by uuid
)
language plpgsql
security definer
set search_path=public
as $$
declare v_task public.marketing_ai_tasks;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  update public.marketing_ai_tasks
  set status='queued',claimed_at=null,claim_expires_at=null
  where status='claimed' and claim_expires_at < now();

  select * into v_task
  from public.marketing_ai_tasks t
  where t.status in ('queued','failed')
    and t.scheduled_for <= now()
    and t.attempt_count < 10
  order by t.priority desc,t.scheduled_for asc
  for update skip locked
  limit 1;

  if not found then return; end if;

  update public.marketing_ai_tasks
  set status='claimed',claimed_at=now(),claim_expires_at=now()+least(greatest(coalesce(p_claim_minutes,15),5),60)*interval '1 minute',
      attempt_count=attempt_count+1,error_code='',error_message=''
  where marketing_ai_tasks.id=v_task.id;

  return query
  select t.id,t.automation_setting_id,t.content_type,t.generation_input,t.attempt_count,t.created_by
  from public.marketing_ai_tasks t where t.id=v_task.id;
end $$;
revoke all on function public.marketing_ai_claim_due_task(integer) from public,anon,authenticated;
grant execute on function public.marketing_ai_claim_due_task(integer) to service_role;

create or replace function public.marketing_ai_queue_due_automation()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare s public.marketing_ai_automation_settings; i integer; queued integer:=0; due_time timestamptz;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  for s in
    select * from public.marketing_ai_automation_settings
    where enabled and next_run_at is not null and next_run_at <= now()
    for update skip locked
  loop
    if s.created_by is null then
      update public.marketing_ai_automation_settings
      set enabled=false
      where id=s.id;
      continue;
    end if;

    for i in 1..s.items_per_run loop
      insert into public.marketing_ai_tasks(
        automation_setting_id,content_type,status,scheduled_for,generation_input,priority,created_by
      ) values(
        s.id,s.automation_type,'queued',now(),
        jsonb_build_object(
          'content_type',s.automation_type,
          'campaign_goal',s.campaign_goal,
          'target_audience',s.target_audience,
          'tone',s.tone,
          'important_details',s.custom_instructions,
          'autopilot',true,
          'sequence_number',i
        ),
        50,s.created_by
      );
      queued:=queued+1;
    end loop;

    due_time:=case s.cadence
      when 'daily' then now()+interval '1 day'
      when 'weekly' then now()+interval '7 days'
      when 'monthly' then now()+interval '1 month'
      else now()+make_interval(mins=>s.interval_minutes)
    end;

    update public.marketing_ai_automation_settings
    set last_run_at=now(),next_run_at=due_time
    where marketing_ai_automation_settings.id=s.id;
  end loop;
  return queued;
end $$;
revoke all on function public.marketing_ai_queue_due_automation() from public,anon,authenticated;
grant execute on function public.marketing_ai_queue_due_automation() to service_role;

commit;

