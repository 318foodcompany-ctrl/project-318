-- Project 318 Release 5: approval-feedback learning signals.
-- Additive only. Records administrator feedback; it never changes the Business Brain automatically.
begin;

do $$
begin
  if to_regclass('public.marketing_ai_tasks') is null
     or to_regclass('public.marketing_ai_approval_audit') is null
     or to_regprocedure('public.crm_is_admin()') is null then
    raise exception 'Release 5 AI Marketing Autopilot foundation is required';
  end if;
end $$;

create table if not exists public.marketing_ai_feedback_signals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.marketing_ai_tasks(id) on delete set null,
  ai_content_id uuid references public.marketing_ai_content(id) on delete set null,
  content_type text not null check (length(content_type) between 1 and 100),
  signal_type text not null check (signal_type in ('approved','edited','rejected','regenerated')),
  before_output jsonb not null default '{}'::jsonb check (jsonb_typeof(before_output)='object'),
  after_output jsonb not null default '{}'::jsonb check (jsonb_typeof(after_output)='object'),
  reason text not null default '' check (length(reason) <= 1000),
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists marketing_ai_feedback_signals_type_idx
  on public.marketing_ai_feedback_signals(content_type,signal_type,created_at desc);

alter table public.marketing_ai_feedback_signals enable row level security;
drop policy if exists "Release 5 administrators read feedback signals" on public.marketing_ai_feedback_signals;
create policy "Release 5 administrators read feedback signals" on public.marketing_ai_feedback_signals
for select to authenticated using (public.crm_is_admin());

revoke all on public.marketing_ai_feedback_signals from public,anon,authenticated;
grant select on public.marketing_ai_feedback_signals to authenticated;
grant insert on public.marketing_ai_feedback_signals to service_role;

create or replace function public.marketing_ai_feedback_summary(p_days integer default 90)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'period_days',least(greatest(coalesce(p_days,90),7),365),
    'by_content_type',coalesce((
      select jsonb_object_agg(content_type,stats)
      from (
        select content_type,jsonb_build_object(
          'approved',count(*) filter (where signal_type='approved'),
          'edited',count(*) filter (where signal_type='edited'),
          'rejected',count(*) filter (where signal_type='rejected'),
          'regenerated',count(*) filter (where signal_type='regenerated')
        ) stats
        from public.marketing_ai_feedback_signals
        where created_at >= now()-least(greatest(coalesce(p_days,90),7),365)*interval '1 day'
        group by content_type
      ) x
    ),'{}'::jsonb),
    'recent_reasons',coalesce((
      select jsonb_agg(jsonb_build_object('content_type',content_type,'signal_type',signal_type,'reason',reason,'created_at',created_at) order by created_at desc)
      from (
        select content_type,signal_type,reason,created_at
        from public.marketing_ai_feedback_signals
        where reason<>'' and created_at >= now()-least(greatest(coalesce(p_days,90),7),365)*interval '1 day'
        order by created_at desc limit 25
      ) r
    ),'[]'::jsonb)
  )
$$;
revoke all on function public.marketing_ai_feedback_summary(integer) from public,anon,authenticated;
grant execute on function public.marketing_ai_feedback_summary(integer) to service_role;

commit;
