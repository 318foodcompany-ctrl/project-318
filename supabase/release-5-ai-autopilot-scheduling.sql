-- Project 318 Release 5: time-zone aware schedule calculation for AI Marketing Autopilot.
begin;

alter table public.marketing_ai_automation_settings
  add column if not exists timezone_name text not null default 'America/Chicago'
  check (length(btrim(timezone_name)) between 1 and 100);

create or replace function public.marketing_ai_next_run(
  p_cadence text,
  p_interval_minutes integer,
  p_day_of_week integer,
  p_day_of_month integer,
  p_preferred_hour integer,
  p_timezone_name text,
  p_after timestamptz default now()
)
returns timestamptz
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  zone text:=coalesce(nullif(btrim(p_timezone_name),''),'America/Chicago');
  local_now timestamp;
  candidate timestamp;
  days_ahead integer;
  next_month timestamp;
begin
  begin
    local_now:=p_after at time zone zone;
  exception when invalid_parameter_value then
    zone:='America/Chicago';
    local_now:=p_after at time zone zone;
  end;

  if p_cadence='custom_interval' then
    return p_after + make_interval(mins=>least(greatest(coalesce(p_interval_minutes,60),60),525600));
  elsif p_cadence='daily' then
    candidate:=date_trunc('day',local_now)+make_interval(hours=>least(greatest(coalesce(p_preferred_hour,8),0),23));
    if candidate<=local_now then candidate:=candidate+interval '1 day'; end if;
  elsif p_cadence='weekly' then
    days_ahead:=(least(greatest(coalesce(p_day_of_week,1),0),6)-extract(dow from local_now)::integer+7)%7;
    candidate:=date_trunc('day',local_now)+make_interval(days=>days_ahead,hours=>least(greatest(coalesce(p_preferred_hour,8),0),23));
    if candidate<=local_now then candidate:=candidate+interval '7 days'; end if;
  elsif p_cadence='monthly' then
    candidate:=make_date(extract(year from local_now)::integer,extract(month from local_now)::integer,least(greatest(coalesce(p_day_of_month,1),1),28))
      +make_interval(hours=>least(greatest(coalesce(p_preferred_hour,8),0),23));
    if candidate<=local_now then
      next_month:=date_trunc('month',local_now)+interval '1 month';
      candidate:=make_date(extract(year from next_month)::integer,extract(month from next_month)::integer,least(greatest(coalesce(p_day_of_month,1),1),28))
        +make_interval(hours=>least(greatest(coalesce(p_preferred_hour,8),0),23));
    end if;
  else
    raise exception 'Unsupported cadence';
  end if;
  return candidate at time zone zone;
end $$;

revoke all on function public.marketing_ai_next_run(text,integer,integer,integer,integer,text,timestamptz) from public,anon;
grant execute on function public.marketing_ai_next_run(text,integer,integer,integer,integer,text,timestamptz) to authenticated,service_role;

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
      update public.marketing_ai_automation_settings set enabled=false where id=s.id;
      continue;
    end if;

    for i in 1..s.items_per_run loop
      insert into public.marketing_ai_tasks(
        automation_setting_id,content_type,status,scheduled_for,generation_input,priority,created_by
      ) values(
        s.id,s.automation_type,'queued',now(),
        jsonb_build_object(
          'content_type',s.automation_type,'campaign_goal',s.campaign_goal,
          'target_audience',s.target_audience,'tone',s.tone,
          'important_details',s.custom_instructions,'autopilot',true,'sequence_number',i
        ),50,s.created_by
      );
      queued:=queued+1;
    end loop;

    due_time:=public.marketing_ai_next_run(
      s.cadence,s.interval_minutes,s.day_of_week,s.day_of_month,s.preferred_hour,s.timezone_name,now()
    );
    update public.marketing_ai_automation_settings
    set last_run_at=now(),next_run_at=due_time where id=s.id;
  end loop;
  return queued;
end $$;
revoke all on function public.marketing_ai_queue_due_automation() from public,anon,authenticated;
grant execute on function public.marketing_ai_queue_due_automation() to service_role;

commit;