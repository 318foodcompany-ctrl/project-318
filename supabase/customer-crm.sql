-- Project 318 Customer Relationship Management
-- Review and run in Supabase SQL Editor. This migration is non-destructive and
-- safe to rerun. It preserves existing quote and booking records.

begin;

create extension if not exists pgcrypto;

create or replace function public.crm_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null default '',
  last_name text not null default '',
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  secondary_phone text not null default '',
  billing_address text not null default '',
  event_address text not null default '',
  notes text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_identity_required check (
    length(btrim(first_name || last_name || company || email || phone)) > 0
  )
);

create unique index if not exists customers_email_unique
  on public.customers (lower(btrim(email)))
  where length(btrim(email)) > 0;

create unique index if not exists customers_phone_unique
  on public.customers (regexp_replace(phone, '[^0-9]', '', 'g'))
  where length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 7;

create unique index if not exists customers_name_company_unique
  on public.customers (
    lower(btrim(first_name || ' ' || last_name)),
    lower(btrim(company))
  )
  where length(btrim(first_name || last_name)) > 0
    and length(btrim(company)) > 0;

create index if not exists customers_active_name_idx
  on public.customers (archived, lower(last_name), lower(first_name));
create index if not exists customers_company_idx on public.customers (lower(company));
create index if not exists customers_event_address_idx on public.customers (lower(event_address));

alter table public.leads add column if not exists customer_id uuid;
alter table public.bookings add column if not exists customer_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_customer_id_fkey' and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_customer_id_fkey foreign key (customer_id)
      references public.customers(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'bookings_customer_id_fkey' and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_customer_id_fkey foreign key (customer_id)
      references public.customers(id) on delete restrict;
  end if;
end;
$$;

create index if not exists leads_customer_id_idx on public.leads (customer_id);
create index if not exists bookings_customer_id_idx on public.bookings (customer_id);

create table if not exists public.customer_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  activity_type text not null,
  title text not null,
  details text not null default '',
  quote_id bigint references public.leads(id) on delete set null,
  booking_id bigint references public.bookings(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.crm_enforce_admin_customer_link()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role') and not public.crm_is_admin() then
    raise exception 'Administrator access required to link CRM customers' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists crm_protect_lead_customer_link on public.leads;
create trigger crm_protect_lead_customer_link
before insert or update of customer_id on public.leads
for each row when (new.customer_id is not null)
execute function public.crm_enforce_admin_customer_link();

drop trigger if exists crm_protect_booking_customer_link on public.bookings;
create trigger crm_protect_booking_customer_link
before insert or update of customer_id on public.bookings
for each row execute function public.crm_enforce_admin_customer_link();

create index if not exists customer_activities_customer_created_idx
  on public.customer_activities (customer_id, created_at desc);
create index if not exists customer_activities_quote_idx
  on public.customer_activities (quote_id) where quote_id is not null;
create index if not exists customer_activities_booking_idx
  on public.customer_activities (booking_id) where booking_id is not null;

create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.crm_set_updated_at();

create or replace function public.crm_find_or_create_customer_internal(
  p_first_name text,
  p_last_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_event_address text default '',
  p_billing_address text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_company text := btrim(coalesce(p_company, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_phone_key text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_full_name text := lower(btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')));
begin
  if length(v_first || v_last || v_company || v_email || v_phone) = 0 then
    raise exception 'Customer requires a name, company, email, or phone';
  end if;

  select id into v_id
  from public.customers
  where (length(v_email) > 0 and lower(btrim(email)) = v_email)
     or (length(v_phone_key) >= 7 and regexp_replace(phone, '[^0-9]', '', 'g') = v_phone_key)
     or (
       length(v_full_name) > 0 and length(v_company) > 0
       and lower(btrim(first_name || ' ' || last_name)) = v_full_name
       and lower(btrim(company)) = lower(v_company)
     )
  order by archived asc, created_at asc
  limit 1;

  if v_id is null then
    begin
      insert into public.customers (
        first_name, last_name, company, email, phone, event_address, billing_address
      ) values (
        v_first, v_last, v_company, v_email, v_phone,
        btrim(coalesce(p_event_address, '')), btrim(coalesce(p_billing_address, ''))
      ) returning id into v_id;
    exception when unique_violation then
      select id into v_id
      from public.customers
      where (length(v_email) > 0 and lower(btrim(email)) = v_email)
         or (length(v_phone_key) >= 7 and regexp_replace(phone, '[^0-9]', '', 'g') = v_phone_key)
         or (
           length(v_full_name) > 0 and length(v_company) > 0
           and lower(btrim(first_name || ' ' || last_name)) = v_full_name
           and lower(btrim(company)) = lower(v_company)
         )
      order by archived asc, created_at asc
      limit 1;
    end;
  end if;

  if v_id is null then
    raise exception 'Unable to resolve customer identity';
  end if;

  update public.customers
  set
    first_name = case when first_name = '' then v_first else first_name end,
    last_name = case when last_name = '' then v_last else last_name end,
    company = case when company = '' then v_company else company end,
    email = case when email = '' then v_email else email end,
    phone = case when phone = '' then v_phone else phone end,
    event_address = case when event_address = '' then btrim(coalesce(p_event_address, '')) else event_address end,
    billing_address = case when billing_address = '' then btrim(coalesce(p_billing_address, '')) else billing_address end
  where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.crm_find_or_create_customer_internal(text,text,text,text,text,text,text) from public, anon, authenticated;

create or replace function public.crm_find_or_create_customer(
  p_first_name text,
  p_last_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_event_address text default '',
  p_billing_address text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.crm_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return public.crm_find_or_create_customer_internal(
    p_first_name, p_last_name, p_company, p_email, p_phone,
    p_event_address, p_billing_address
  );
end;
$$;

revoke all on function public.crm_find_or_create_customer(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.crm_find_or_create_customer(text,text,text,text,text,text,text) to authenticated;

-- Backfill existing quotes into normalized customer records.
do $$
declare
  v_lead record;
  v_customer_id uuid;
  v_first text;
  v_last text;
begin
  for v_lead in select * from public.leads where customer_id is null order by id loop
    v_first := split_part(btrim(coalesce(v_lead.name, '')), ' ', 1);
    v_last := btrim(regexp_replace(btrim(coalesce(v_lead.name, '')), '^\S+\s*', ''));
    v_customer_id := public.crm_find_or_create_customer_internal(
      v_first, v_last, v_lead.company, v_lead.email, v_lead.phone, '', ''
    );
    update public.leads set customer_id = v_customer_id where id = v_lead.id;
  end loop;
end;
$$;

-- Backfill existing bookings, preferring their linked quote's customer.
do $$
declare
  v_booking record;
  v_customer_id uuid;
  v_first text;
  v_last text;
begin
  for v_booking in select * from public.bookings where customer_id is null order by id loop
    select customer_id into v_customer_id from public.leads where id = v_booking.quote_id;
    if v_customer_id is null then
      v_first := split_part(btrim(coalesce(v_booking.customer_name, '')), ' ', 1);
      v_last := btrim(regexp_replace(btrim(coalesce(v_booking.customer_name, '')), '^\S+\s*', ''));
      v_customer_id := public.crm_find_or_create_customer_internal(
        v_first, v_last, v_booking.company_name, v_booking.email, v_booking.phone,
        v_booking.venue_address, ''
      );
    end if;
    update public.bookings set customer_id = v_customer_id where id = v_booking.id;
  end loop;
end;
$$;

alter table public.bookings alter column customer_id set not null;

create or replace function public.submit_quote_with_customer(
  p_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_event_date date,
  p_guests integer,
  p_menu text,
  p_event_type text,
  p_budget numeric,
  p_notes text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_quote_id bigint;
  v_first text := split_part(btrim(coalesce(p_name, '')), ' ', 1);
  v_last text := btrim(regexp_replace(btrim(coalesce(p_name, '')), '^\S+\s*', ''));
  v_address text := coalesce((regexp_match(coalesce(p_notes, ''), '(?im)^Address:\s*(.*)$'))[1], '');
begin
  if length(btrim(coalesce(p_name, ''))) = 0
     or length(btrim(coalesce(p_email, ''))) = 0
     or length(btrim(coalesce(p_phone, ''))) = 0 then
    raise exception 'Name, email, and phone are required';
  end if;

  v_customer_id := public.crm_find_or_create_customer_internal(
    v_first, v_last, p_company, p_email, p_phone, v_address, ''
  );

  insert into public.leads (
    name, company, email, phone, event_date, guests, menu, event_type,
    budget, notes, status, customer_id
  ) values (
    btrim(p_name), btrim(coalesce(p_company, '')), lower(btrim(p_email)), btrim(p_phone),
    p_event_date, p_guests, p_menu, p_event_type, p_budget,
    coalesce(p_notes, ''), 'New', v_customer_id
  ) returning id into v_quote_id;

  return v_quote_id;
end;
$$;

revoke all on function public.submit_quote_with_customer(text,text,text,text,date,integer,text,text,numeric,text) from public;
grant execute on function public.submit_quote_with_customer(text,text,text,text,date,integer,text,text,numeric,text) to anon, authenticated;

create or replace function public.crm_customer_matches(p_search text, p_limit integer default 8)
returns table (
  id uuid, first_name text, last_name text, company text, email text,
  phone text, event_address text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_phone_search text := regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g');
begin
  if not public.crm_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  select c.id, c.first_name, c.last_name, c.company, c.email, c.phone, c.event_address
  from public.customers c
  where not c.archived and (
    v_search = ''
    or lower(c.first_name || ' ' || c.last_name) like '%' || v_search || '%'
    or lower(c.company) like '%' || v_search || '%'
    or lower(c.email) like '%' || v_search || '%'
    or (length(v_phone_search) > 0 and regexp_replace(c.phone, '[^0-9]', '', 'g') like '%' || v_phone_search || '%')
  )
  order by lower(c.last_name), lower(c.first_name), lower(c.company)
  limit least(greatest(coalesce(p_limit, 8), 1), 25);
end;
$$;

revoke all on function public.crm_customer_matches(text,integer) from public, anon;
grant execute on function public.crm_customer_matches(text,integer) to authenticated;

create or replace function public.crm_customer_dashboard(
  p_search text default '',
  p_archived boolean default false,
  p_sort text default 'activity_desc',
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id uuid, first_name text, last_name text, company text, email text, phone text,
  archived boolean, created_at timestamptz, quote_count bigint, booking_count bigint,
  last_activity timestamptz, total_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_phone_search text := regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g');
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 20), 5), 100);
begin
  if not public.crm_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  with customer_rows as (
    select
      c.id, c.first_name, c.last_name, c.company, c.email, c.phone, c.archived, c.created_at,
      (select count(*) from public.leads q where q.customer_id = c.id) as quote_count,
      (select count(*) from public.bookings b where b.customer_id = c.id) as booking_count,
      (select max(a.created_at) from public.customer_activities a where a.customer_id = c.id) as last_activity
    from public.customers c
    where c.archived = coalesce(p_archived, false)
      and (
        v_search = ''
        or lower(c.first_name || ' ' || c.last_name) like '%' || v_search || '%'
        or lower(c.company) like '%' || v_search || '%'
        or lower(c.email) like '%' || v_search || '%'
        or (length(v_phone_search) > 0 and regexp_replace(c.phone, '[^0-9]', '', 'g') like '%' || v_phone_search || '%')
        or lower(c.event_address) like '%' || v_search || '%'
        or exists (select 1 from public.leads q where q.customer_id = c.id and q.id::text = v_search)
        or exists (select 1 from public.bookings b where b.customer_id = c.id and b.event_date::text = v_search)
      )
  )
  select r.*, count(*) over() as total_count
  from customer_rows r
  order by
    case when p_sort = 'name_asc' then lower(r.first_name || ' ' || r.last_name) end asc,
    case when p_sort = 'name_desc' then lower(r.first_name || ' ' || r.last_name) end desc,
    case when p_sort = 'company_asc' then lower(r.company) end asc,
    case when p_sort = 'created_desc' then r.created_at end desc,
    case when p_sort = 'activity_asc' then r.last_activity end asc nulls first,
    r.last_activity desc nulls last,
    lower(r.last_name), lower(r.first_name)
  limit v_size offset (v_page - 1) * v_size;
end;
$$;

revoke all on function public.crm_customer_dashboard(text,boolean,text,integer,integer) from public, anon;
grant execute on function public.crm_customer_dashboard(text,boolean,text,integer,integer) to authenticated;

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
  else
    insert into public.customer_activities(customer_id, activity_type, title, quote_id)
    values(new.customer_id, 'quote_updated', 'Quote #' || new.id || ' updated', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists crm_quote_activity on public.leads;
create trigger crm_quote_activity after insert or update on public.leads
for each row execute function public.crm_record_quote_activity();

create or replace function public.crm_record_booking_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.customer_id is not null then
      insert into public.customer_activities(customer_id, activity_type, title, details)
      values(old.customer_id, 'booking_deleted', 'Booking deleted: ' || old.event_title, old.event_date::text);
    end if;
    return old;
  end if;

  if new.customer_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.customer_activities(customer_id, activity_type, title, booking_id)
    values(new.customer_id, 'booking_created', 'Booking created: ' || new.event_title, new.id);
  elsif new.status is distinct from old.status then
    insert into public.customer_activities(customer_id, activity_type, title, details, booking_id)
    values(new.customer_id, 'booking_status_changed', 'Booking status changed: ' || new.event_title, coalesce(old.status, '') || ' -> ' || coalesce(new.status, ''), new.id);
  else
    insert into public.customer_activities(customer_id, activity_type, title, booking_id)
    values(new.customer_id, 'booking_updated', 'Booking updated: ' || new.event_title, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists crm_booking_activity on public.bookings;
create trigger crm_booking_activity after insert or update or delete on public.bookings
for each row execute function public.crm_record_booking_activity();

create or replace function public.crm_record_customer_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.notes is distinct from old.notes then
    insert into public.customer_activities(customer_id, activity_type, title)
    values(new.id, 'internal_note_added', 'Customer internal notes updated');
  elsif new.archived is distinct from old.archived then
    insert into public.customer_activities(customer_id, activity_type, title)
    values(new.id, 'customer_status_changed', case when new.archived then 'Customer archived' else 'Customer restored' end);
  end if;
  return new;
end;
$$;

drop trigger if exists crm_customer_activity on public.customers;
create trigger crm_customer_activity after update on public.customers
for each row execute function public.crm_record_customer_activity();

alter table public.customers enable row level security;
alter table public.customer_activities enable row level security;

drop policy if exists "CRM administrators can read customers" on public.customers;
create policy "CRM administrators can read customers" on public.customers
for select to authenticated using (public.crm_is_admin());
drop policy if exists "CRM administrators can create customers" on public.customers;
create policy "CRM administrators can create customers" on public.customers
for insert to authenticated with check (public.crm_is_admin());
drop policy if exists "CRM administrators can update customers" on public.customers;
create policy "CRM administrators can update customers" on public.customers
for update to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
drop policy if exists "CRM administrators can delete customers" on public.customers;
create policy "CRM administrators can delete customers" on public.customers
for delete to authenticated using (public.crm_is_admin());

drop policy if exists "CRM administrators can read activities" on public.customer_activities;
create policy "CRM administrators can read activities" on public.customer_activities
for select to authenticated using (public.crm_is_admin());
drop policy if exists "CRM administrators can create activities" on public.customer_activities;
create policy "CRM administrators can create activities" on public.customer_activities
for insert to authenticated with check (public.crm_is_admin());

revoke all on public.customers, public.customer_activities from anon;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert on public.customer_activities to authenticated;

comment on table public.customers is 'Normalized private CRM customer records for Project 318.';
comment on table public.customer_activities is 'Automatic private CRM activity timeline.';
comment on column public.leads.customer_id is 'CRM customer associated with this quote.';
comment on column public.bookings.customer_id is 'Required CRM customer associated with this booking.';

commit;
