-- Project 318 first-party marketing attribution foundation.
-- Apply after invoicing-payments.sql. This migration is non-destructive and
-- safe to rerun. It records attribution only when a public quote is submitted.
begin;

create extension if not exists pgcrypto;

create table if not exists public.marketing_visitors (
  id uuid primary key,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint marketing_visitors_seen_order check (last_seen_at >= first_seen_at)
);

create table if not exists public.marketing_sessions (
  id uuid primary key,
  visitor_id uuid not null references public.marketing_visitors(id) on delete restrict,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  landing_path text not null default '/',
  referrer_host text not null default '',
  created_at timestamptz not null default now(),
  constraint marketing_sessions_seen_order check (last_seen_at >= started_at),
  constraint marketing_sessions_landing_path_length check (length(landing_path) <= 1000),
  constraint marketing_sessions_referrer_host_length check (length(referrer_host) <= 255)
);

create table if not exists public.marketing_touchpoints (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.marketing_visitors(id) on delete restrict,
  session_id uuid not null references public.marketing_sessions(id) on delete restrict,
  touch_role text not null check (touch_role in ('first', 'last_non_direct')),
  occurred_at timestamptz not null,
  source text not null default 'direct',
  medium text not null default '(none)',
  campaign text not null default '',
  campaign_id text not null default '',
  term text not null default '',
  content text not null default '',
  landing_path text not null default '/',
  referrer_host text not null default '',
  gclid text not null default '',
  gbraid text not null default '',
  wbraid text not null default '',
  fbclid text not null default '',
  created_at timestamptz not null default now(),
  constraint marketing_touchpoints_source_length check (length(source) <= 255),
  constraint marketing_touchpoints_medium_length check (length(medium) <= 255),
  constraint marketing_touchpoints_campaign_length check (length(campaign) <= 500),
  constraint marketing_touchpoints_campaign_id_length check (length(campaign_id) <= 255),
  constraint marketing_touchpoints_term_length check (length(term) <= 500),
  constraint marketing_touchpoints_content_length check (length(content) <= 500),
  constraint marketing_touchpoints_landing_path_length check (length(landing_path) <= 1000),
  constraint marketing_touchpoints_referrer_host_length check (length(referrer_host) <= 255),
  constraint marketing_touchpoints_click_id_lengths check (
    length(gclid) <= 500 and length(gbraid) <= 500 and
    length(wbraid) <= 500 and length(fbclid) <= 500
  ),
  unique (session_id, touch_role)
);

alter table public.leads add column if not exists marketing_session_id uuid;
alter table public.leads add column if not exists marketing_first_touchpoint_id uuid;
alter table public.leads add column if not exists marketing_last_touchpoint_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_marketing_session_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads add constraint leads_marketing_session_id_fkey
      foreign key (marketing_session_id) references public.marketing_sessions(id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_marketing_first_touchpoint_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads add constraint leads_marketing_first_touchpoint_id_fkey
      foreign key (marketing_first_touchpoint_id) references public.marketing_touchpoints(id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_marketing_last_touchpoint_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads add constraint leads_marketing_last_touchpoint_id_fkey
      foreign key (marketing_last_touchpoint_id) references public.marketing_touchpoints(id) on delete restrict;
  end if;
end;
$$;

create index if not exists marketing_sessions_visitor_started_idx
  on public.marketing_sessions(visitor_id, started_at desc);
create index if not exists marketing_touchpoints_source_campaign_idx
  on public.marketing_touchpoints(source, campaign, occurred_at desc);
create index if not exists leads_marketing_session_idx
  on public.leads(marketing_session_id) where marketing_session_id is not null;
create index if not exists leads_marketing_first_touch_idx
  on public.leads(marketing_first_touchpoint_id) where marketing_first_touchpoint_id is not null;
create index if not exists leads_marketing_last_touch_idx
  on public.leads(marketing_last_touchpoint_id) where marketing_last_touchpoint_id is not null;

create or replace function public.marketing_safe_uuid(p_value text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
begin
  return nullif(btrim(coalesce(p_value, '')), '')::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.marketing_safe_timestamp(
  p_value text,
  p_fallback timestamptz
)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare v_result timestamptz;
begin
  v_result := nullif(btrim(coalesce(p_value, '')), '')::timestamptz;
  if v_result > now() + interval '5 minutes' or v_result < now() - interval '90 days' then
    return p_fallback;
  end if;
  return v_result;
exception when invalid_datetime_format or datetime_field_overflow then
  return p_fallback;
end;
$$;

create or replace function public.marketing_clean_text(p_value text, p_max integer)
returns text
language sql
immutable
security invoker
set search_path = public
as $$ select left(btrim(coalesce(p_value, '')), greatest(p_max, 0)); $$;

revoke all on function public.marketing_safe_uuid(text) from public, anon, authenticated;
revoke all on function public.marketing_safe_timestamp(text,timestamptz) from public, anon, authenticated;
revoke all on function public.marketing_clean_text(text,integer) from public, anon, authenticated;

create or replace function public.marketing_store_touchpoint(
  p_visitor_id uuid,
  p_session_id uuid,
  p_role text,
  p_touch jsonb,
  p_fallback_time timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  insert into public.marketing_touchpoints(
    visitor_id, session_id, touch_role, occurred_at, source, medium,
    campaign, campaign_id, term, content, landing_path, referrer_host,
    gclid, gbraid, wbraid, fbclid
  ) values (
    p_visitor_id, p_session_id, p_role,
    public.marketing_safe_timestamp(p_touch ->> 'occurred_at', p_fallback_time),
    coalesce(nullif(public.marketing_clean_text(p_touch ->> 'source', 255), ''), 'direct'),
    coalesce(nullif(public.marketing_clean_text(p_touch ->> 'medium', 255), ''), '(none)'),
    public.marketing_clean_text(p_touch ->> 'campaign', 500),
    public.marketing_clean_text(p_touch ->> 'campaign_id', 255),
    public.marketing_clean_text(p_touch ->> 'term', 500),
    public.marketing_clean_text(p_touch ->> 'content', 500),
    coalesce(nullif(public.marketing_clean_text(p_touch ->> 'landing_path', 1000), ''), '/'),
    public.marketing_clean_text(p_touch ->> 'referrer_host', 255),
    public.marketing_clean_text(p_touch ->> 'gclid', 500),
    public.marketing_clean_text(p_touch ->> 'gbraid', 500),
    public.marketing_clean_text(p_touch ->> 'wbraid', 500),
    public.marketing_clean_text(p_touch ->> 'fbclid', 500)
  )
  on conflict (session_id, touch_role) do update set
    source = case when p_role = 'last_non_direct' then excluded.source else public.marketing_touchpoints.source end,
    medium = case when p_role = 'last_non_direct' then excluded.medium else public.marketing_touchpoints.medium end,
    campaign = case when p_role = 'last_non_direct' then excluded.campaign else public.marketing_touchpoints.campaign end,
    campaign_id = case when p_role = 'last_non_direct' then excluded.campaign_id else public.marketing_touchpoints.campaign_id end,
    term = case when p_role = 'last_non_direct' then excluded.term else public.marketing_touchpoints.term end,
    content = case when p_role = 'last_non_direct' then excluded.content else public.marketing_touchpoints.content end,
    landing_path = case when p_role = 'last_non_direct' then excluded.landing_path else public.marketing_touchpoints.landing_path end,
    referrer_host = case when p_role = 'last_non_direct' then excluded.referrer_host else public.marketing_touchpoints.referrer_host end,
    gclid = case when p_role = 'last_non_direct' then excluded.gclid else public.marketing_touchpoints.gclid end,
    gbraid = case when p_role = 'last_non_direct' then excluded.gbraid else public.marketing_touchpoints.gbraid end,
    wbraid = case when p_role = 'last_non_direct' then excluded.wbraid else public.marketing_touchpoints.wbraid end,
    fbclid = case when p_role = 'last_non_direct' then excluded.fbclid else public.marketing_touchpoints.fbclid end,
    occurred_at = case when p_role = 'last_non_direct' then excluded.occurred_at else public.marketing_touchpoints.occurred_at end
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.marketing_store_touchpoint(uuid,uuid,text,jsonb,timestamptz)
  from public, anon, authenticated;

create or replace function public.marketing_attach_quote_attribution(
  p_quote_id bigint,
  p_attribution jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_visitor_id uuid := public.marketing_safe_uuid(p_attribution ->> 'visitor_id');
  v_session_id uuid := public.marketing_safe_uuid(p_attribution ->> 'session_id');
  v_now timestamptz := now();
  v_started timestamptz := public.marketing_safe_timestamp(p_attribution ->> 'session_started_at', now());
  v_first jsonb := coalesce(p_attribution -> 'first_touch', '{}'::jsonb);
  v_last jsonb := coalesce(p_attribution -> 'last_non_direct_touch', '{}'::jsonb);
  v_first_id uuid;
  v_last_id uuid;
begin
  if v_visitor_id is null or v_session_id is null then return; end if;

  insert into public.marketing_visitors(id, first_seen_at, last_seen_at)
  values(v_visitor_id, v_started, v_now)
  on conflict (id) do update set last_seen_at = greatest(public.marketing_visitors.last_seen_at, excluded.last_seen_at);

  insert into public.marketing_sessions(id, visitor_id, started_at, last_seen_at, landing_path, referrer_host)
  values(
    v_session_id, v_visitor_id, v_started, v_now,
    coalesce(nullif(public.marketing_clean_text(p_attribution ->> 'landing_path', 1000), ''), '/'),
    public.marketing_clean_text(p_attribution ->> 'referrer_host', 255)
  )
  on conflict (id) do update set
    last_seen_at = greatest(public.marketing_sessions.last_seen_at, excluded.last_seen_at)
  where public.marketing_sessions.visitor_id = excluded.visitor_id;

  if not found then return; end if;

  v_first_id := public.marketing_store_touchpoint(v_visitor_id, v_session_id, 'first', v_first, v_started);
  v_last_id := public.marketing_store_touchpoint(
    v_visitor_id, v_session_id, 'last_non_direct',
    case when jsonb_typeof(v_last) = 'object' and v_last <> '{}'::jsonb then v_last else v_first end,
    v_started
  );

  update public.leads set
    marketing_session_id = v_session_id,
    marketing_first_touchpoint_id = v_first_id,
    marketing_last_touchpoint_id = v_last_id
  where id = p_quote_id
    and marketing_session_id is null;
end;
$$;

revoke all on function public.marketing_attach_quote_attribution(bigint,jsonb)
  from public, anon, authenticated;

create or replace function public.submit_quote_with_attribution(
  p_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_event_date date,
  p_guests integer,
  p_menu text,
  p_event_type text,
  p_budget numeric,
  p_notes text,
  p_attribution jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_quote_id bigint;
begin
  v_quote_id := public.submit_quote_with_customer(
    p_name, p_company, p_email, p_phone, p_event_date, p_guests,
    p_menu, p_event_type, p_budget, p_notes
  );
  perform public.marketing_attach_quote_attribution(v_quote_id, coalesce(p_attribution, '{}'::jsonb));
  return v_quote_id;
end;
$$;

revoke all on function public.submit_quote_with_attribution(text,text,text,text,date,integer,text,text,numeric,text,jsonb) from public;
grant execute on function public.submit_quote_with_attribution(text,text,text,text,date,integer,text,text,numeric,text,jsonb) to anon, authenticated;

-- Attribution is attached immediately after quote creation. Do not create a
-- misleading second CRM "quote updated" activity for that internal-only write.
create or replace function public.crm_record_quote_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.customer_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.customer_activities(customer_id, activity_type, title, quote_id)
    values(new.customer_id, 'quote_created', 'Quote #' || new.id || ' created', new.id);
  elsif new.status is distinct from old.status then
    insert into public.customer_activities(customer_id, activity_type, title, details, quote_id)
    values(new.customer_id, 'quote_status_changed', 'Quote #' || new.id || ' status changed', coalesce(old.status, '') || ' -> ' || coalesce(new.status, ''), new.id);
  elsif new.internal_notes is distinct from old.internal_notes then
    insert into public.customer_activities(customer_id, activity_type, title, quote_id)
    values(new.customer_id, 'internal_note_added', 'Internal quote note updated', new.id);
  elsif row(new.name, new.company, new.email, new.phone, new.event_date, new.guests,
            new.menu, new.event_type, new.budget, new.notes, new.customer_id)
        is not distinct from
        row(old.name, old.company, old.email, old.phone, old.event_date, old.guests,
            old.menu, old.event_type, old.budget, old.notes, old.customer_id) then
    return new;
  else
    insert into public.customer_activities(customer_id, activity_type, title, quote_id)
    values(new.customer_id, 'quote_updated', 'Quote #' || new.id || ' updated', new.id);
  end if;
  return new;
end;
$$;

create or replace function public.marketing_quote_attribution(p_quote_id bigint)
returns table (
  quote_id bigint,
  first_source text, first_medium text, first_campaign text, first_landing_path text,
  last_source text, last_medium text, last_campaign text, last_landing_path text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.crm_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  select l.id, f.source, f.medium, f.campaign, f.landing_path,
    x.source, x.medium, x.campaign, x.landing_path
  from public.leads l
  left join public.marketing_touchpoints f on f.id = l.marketing_first_touchpoint_id
  left join public.marketing_touchpoints x on x.id = l.marketing_last_touchpoint_id
  where l.id = p_quote_id;
end;
$$;

revoke all on function public.marketing_quote_attribution(bigint) from public, anon;
grant execute on function public.marketing_quote_attribution(bigint) to authenticated;

create or replace function public.marketing_revenue_attribution(
  p_start date,
  p_end date,
  p_model text default 'last_non_direct'
)
returns table (source text, medium text, campaign text, revenue numeric, payment_count bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.crm_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_model not in ('first', 'last_non_direct') then
    raise exception 'Unsupported attribution model';
  end if;
  return query
  select
    coalesce(t.source, 'unattributed'), coalesce(t.medium, '(none)'), coalesce(t.campaign, ''),
    coalesce(sum(case when p.entry_type in ('payment','deposit') then p.amount else -p.amount end), 0),
    count(*)
  from public.payments p
  join public.invoices i on i.id = p.invoice_id
  left join public.leads l on l.id = i.quote_id
  left join public.marketing_touchpoints t on t.id = case
    when p_model = 'first' then l.marketing_first_touchpoint_id
    else l.marketing_last_touchpoint_id end
  where p.payment_date >= p_start and p.payment_date <= p_end
  group by coalesce(t.source, 'unattributed'), coalesce(t.medium, '(none)'), coalesce(t.campaign, '')
  order by 4 desc;
end;
$$;

revoke all on function public.marketing_revenue_attribution(date,date,text) from public, anon;
grant execute on function public.marketing_revenue_attribution(date,date,text) to authenticated;

alter table public.marketing_visitors enable row level security;
alter table public.marketing_sessions enable row level security;
alter table public.marketing_touchpoints enable row level security;

drop policy if exists "Marketing administrators can read visitors" on public.marketing_visitors;
create policy "Marketing administrators can read visitors" on public.marketing_visitors
for select to authenticated using (public.crm_is_admin());
drop policy if exists "Marketing administrators can read sessions" on public.marketing_sessions;
create policy "Marketing administrators can read sessions" on public.marketing_sessions
for select to authenticated using (public.crm_is_admin());
drop policy if exists "Marketing administrators can read touchpoints" on public.marketing_touchpoints;
create policy "Marketing administrators can read touchpoints" on public.marketing_touchpoints
for select to authenticated using (public.crm_is_admin());

revoke all on public.marketing_visitors, public.marketing_sessions, public.marketing_touchpoints from anon, authenticated;
grant select on public.marketing_visitors, public.marketing_sessions, public.marketing_touchpoints to authenticated;

comment on table public.marketing_visitors is 'First-party anonymous visitor identifiers for converted quote journeys.';
comment on table public.marketing_sessions is 'First-party sessions persisted when a quote is submitted.';
comment on table public.marketing_touchpoints is 'Permanent first and last non-direct attribution for converted quote journeys.';
comment on column public.leads.marketing_first_touchpoint_id is 'Immutable original acquisition touchpoint for this quote.';
comment on column public.leads.marketing_last_touchpoint_id is 'Last non-direct touchpoint present when this quote was submitted.';

commit;
