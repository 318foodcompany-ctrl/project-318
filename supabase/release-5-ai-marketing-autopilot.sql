-- Project 318 Release 5: AI Marketing Autopilot foundation.
-- Additive only. Generates drafts/tasks for administrator approval; never publishes or sends automatically.
begin;

do $$
begin
  if to_regclass('public.marketing_ai_content') is null
     or to_regprocedure('public.crm_is_admin()') is null then
    raise exception 'Release 4 AI marketing and CRM administrator authorization are required';
  end if;
end $$;

create table if not exists public.marketing_ai_brand_brain (
  id smallint primary key default 1 check (id = 1),
  mission text not null default 'Increase profitable catering growth while protecting the 318 Food Co brand, customer trust, and long-term reputation.'
    check (length(mission) <= 4000),
  business_facts jsonb not null default '{}'::jsonb check (jsonb_typeof(business_facts)='object'),
  voice_preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(voice_preferences)='object'),
  growth_priorities jsonb not null default '["qualified_leads","booked_events","revenue","average_order_value","repeat_customers","reviews","organic_visibility","marketing_efficiency"]'::jsonb
    check (jsonb_typeof(growth_priorities)='array'),
  prohibited_claims jsonb not null default '["fabricated reviews","guaranteed outcomes","unverified superlatives","services not actually offered"]'::jsonb
    check (jsonb_typeof(prohibited_claims)='array'),
  seasonal_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(seasonal_rules)='object'),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.marketing_ai_brand_brain(id)
values (1)
on conflict (id) do nothing;

create table if not exists public.marketing_ai_automation_settings (
  id uuid primary key default gen_random_uuid(),
  automation_type text not null unique check (automation_type in (
    'blog_draft','faq_draft','seo_recommendation','facebook_post','instagram_caption',
    'linkedin_post','google_business_post','email_newsletter','promotional_email',
    'landing_page','seasonal_campaign','holiday_campaign','analytics_summary','growth_recommendation'
  )),
  enabled boolean not null default false,
  cadence text not null default 'weekly' check (cadence in ('daily','weekly','monthly','custom_interval')),
  interval_minutes integer check (interval_minutes is null or interval_minutes between 60 and 525600),
  day_of_week smallint check (day_of_week is null or day_of_week between 0 and 6),
  day_of_month smallint check (day_of_month is null or day_of_month between 1 and 28),
  preferred_hour smallint not null default 8 check (preferred_hour between 0 and 23),
  items_per_run integer not null default 1 check (items_per_run between 1 and 20),
  approval_required boolean not null default true check (approval_required = true),
  tone text not null default 'professional' check (tone in ('professional','friendly','corporate','casual','premium','urgent')),
  target_audience text not null default 'Local catering customers and qualified prospects' check (length(target_audience) <= 500),
  campaign_goal text not null default 'Increase qualified catering demand and profitable bookings' check (length(campaign_goal) <= 500),
  custom_instructions text not null default '' check (length(custom_instructions) <= 4000),
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_success_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((cadence='custom_interval' and interval_minutes is not null) or cadence<>'custom_interval')
);

create table if not exists public.marketing_ai_tasks (
  id uuid primary key default gen_random_uuid(),
  automation_setting_id uuid references public.marketing_ai_automation_settings(id) on delete set null,
  content_type text not null,
  status text not null default 'queued' check (status in (
    'queued','claimed','generating','ready_for_approval','approved','rejected','failed','archived'
  )),
  priority smallint not null default 50 check (priority between 1 and 100),
  scheduled_for timestamptz not null default now(),
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  generation_input jsonb not null default '{}'::jsonb check (jsonb_typeof(generation_input)='object'),
  ai_content_id uuid references public.marketing_ai_content(id) on delete set null,
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  error_code text not null default '' check (length(error_code) <= 100),
  error_message text not null default '' check (length(error_message) <= 1000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists marketing_ai_tasks_due_idx
  on public.marketing_ai_tasks(status,scheduled_for,priority desc)
  where status in ('queued','failed');
create index if not exists marketing_ai_tasks_content_idx
  on public.marketing_ai_tasks(content_type,created_at desc);
create index if not exists marketing_ai_tasks_approval_idx
  on public.marketing_ai_tasks(status,created_at desc)
  where status='ready_for_approval';

create table if not exists public.marketing_ai_approval_audit (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.marketing_ai_tasks(id) on delete set null,
  ai_content_id uuid references public.marketing_ai_content(id) on delete set null,
  action text not null check (action in (
    'scheduled','generated','edited','approved','rejected','regenerated','archived','failed'
  )),
  actor_id uuid default auth.uid(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);
create index if not exists marketing_ai_approval_audit_task_idx
  on public.marketing_ai_approval_audit(task_id,created_at desc);

create or replace function public.marketing_ai_autopilot_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  new.updated_at=now();
  if tg_table_name='marketing_ai_automation_settings' then new.updated_by=auth.uid(); end if;
  return new;
end $$;

drop trigger if exists marketing_ai_brand_brain_touch on public.marketing_ai_brand_brain;
create trigger marketing_ai_brand_brain_touch before update on public.marketing_ai_brand_brain
for each row execute function public.marketing_ai_autopilot_touch_updated_at();
drop trigger if exists marketing_ai_automation_settings_touch on public.marketing_ai_automation_settings;
create trigger marketing_ai_automation_settings_touch before update on public.marketing_ai_automation_settings
for each row execute function public.marketing_ai_autopilot_touch_updated_at();
drop trigger if exists marketing_ai_tasks_touch on public.marketing_ai_tasks;
create trigger marketing_ai_tasks_touch before update on public.marketing_ai_tasks
for each row execute function public.marketing_ai_autopilot_touch_updated_at();

create or replace function public.marketing_ai_claim_due_task(p_claim_minutes integer default 15)
returns table(
  id uuid,
  automation_setting_id uuid,
  content_type text,
  generation_input jsonb,
  attempt_count integer
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
  set status='queued', claimed_at=null, claim_expires_at=null
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
  select t.id,t.automation_setting_id,t.content_type,t.generation_input,t.attempt_count
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
    for i in 1..s.items_per_run loop
      insert into public.marketing_ai_tasks(automation_setting_id,content_type,status,scheduled_for,generation_input,priority)
      values(
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
        50
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

alter table public.marketing_ai_brand_brain enable row level security;
alter table public.marketing_ai_automation_settings enable row level security;
alter table public.marketing_ai_tasks enable row level security;
alter table public.marketing_ai_approval_audit enable row level security;

drop policy if exists "Release 5 administrators manage brand brain" on public.marketing_ai_brand_brain;
create policy "Release 5 administrators manage brand brain" on public.marketing_ai_brand_brain
for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
drop policy if exists "Release 5 administrators manage automation settings" on public.marketing_ai_automation_settings;
create policy "Release 5 administrators manage automation settings" on public.marketing_ai_automation_settings
for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
drop policy if exists "Release 5 administrators manage ai tasks" on public.marketing_ai_tasks;
create policy "Release 5 administrators manage ai tasks" on public.marketing_ai_tasks
for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
drop policy if exists "Release 5 administrators read audit" on public.marketing_ai_approval_audit;
create policy "Release 5 administrators read audit" on public.marketing_ai_approval_audit
for select to authenticated using (public.crm_is_admin());

revoke all on public.marketing_ai_brand_brain,public.marketing_ai_automation_settings,public.marketing_ai_tasks,public.marketing_ai_approval_audit from public,anon,authenticated;
grant select,insert,update,delete on public.marketing_ai_brand_brain,public.marketing_ai_automation_settings,public.marketing_ai_tasks to authenticated;
grant select on public.marketing_ai_approval_audit to authenticated;
grant insert on public.marketing_ai_approval_audit to service_role;

commit;
