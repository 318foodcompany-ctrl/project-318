-- Project 318 Release 3: sales pipeline, proposals, portal, and automation.
-- Forward-only, non-destructive, and safe to rerun after CRM, bookings, and invoices.
begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regprocedure('public.crm_is_admin()') is null then
    raise exception 'Required function public.crm_is_admin() is missing';
  end if;
  if to_regclass('public.customers') is null or to_regclass('public.leads') is null
     or to_regclass('public.bookings') is null or to_regclass('public.invoices') is null then
    raise exception 'CRM, booking, and invoicing migrations must be applied first';
  end if;
end $$;

create table if not exists public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  quote_id bigint unique references public.leads(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  stage text not null default 'new_lead'
    check (stage in ('new_lead','contacted','proposal_sent','waiting_on_customer','booked','completed','lost')),
  priority boolean not null default false,
  expected_revenue numeric(14,2) not null default 0 check (expected_revenue >= 0),
  follow_up_at timestamptz,
  assigned_staff text not null default '',
  lost_reason text not null default '',
  internal_notes text not null default '',
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_opportunity_lost_reason check (stage <> 'lost' or length(btrim(lost_reason)) > 0)
);

create table if not exists public.sales_stage_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.sales_opportunities(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  note text not null default '',
  changed_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_comments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.sales_opportunities(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  body text not null check (length(btrim(body)) > 0 and length(body) <= 5000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint sales_comment_parent check (num_nonnulls(opportunity_id, customer_id) = 1)
);

create or replace function public.sales_sync_quote_opportunity()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_stage text;
begin
  if new.customer_id is null then return new; end if;
  v_stage := case lower(coalesce(new.status,''))
    when 'contacted' then 'contacted' when 'proposal sent' then 'proposal_sent'
    when 'quote sent' then 'proposal_sent' when 'booked' then 'booked'
    when 'closed' then 'completed' when 'cancelled' then 'lost' when 'lost' then 'lost'
    else 'new_lead' end;
  insert into public.sales_opportunities(quote_id,customer_id,stage,expected_revenue,lost_reason)
  values(new.id,new.customer_id,v_stage,greatest(coalesce(new.budget,0),0),
    case when v_stage='lost' then 'Quote cancelled or lost' else '' end)
  on conflict(quote_id) do update set customer_id=excluded.customer_id,
    stage=case when public.sales_opportunities.stage in ('new_lead','contacted','proposal_sent') then excluded.stage else public.sales_opportunities.stage end,
    expected_revenue=case when public.sales_opportunities.expected_revenue=0 then excluded.expected_revenue else public.sales_opportunities.expected_revenue end;
  return new;
end $$;
drop trigger if exists sales_quote_opportunity_sync on public.leads;
create trigger sales_quote_opportunity_sync after insert or update of customer_id,status,budget on public.leads
for each row execute function public.sales_sync_quote_opportunity();

insert into public.sales_opportunities(quote_id,customer_id,stage,expected_revenue,lost_reason)
select l.id,l.customer_id,
  case lower(coalesce(l.status,'')) when 'contacted' then 'contacted' when 'proposal sent' then 'proposal_sent'
    when 'quote sent' then 'proposal_sent' when 'booked' then 'booked' when 'closed' then 'completed'
    when 'cancelled' then 'lost' when 'lost' then 'lost' else 'new_lead' end,
  greatest(coalesce(l.budget,0),0),
  case when lower(coalesce(l.status,'')) in ('cancelled','lost') then 'Quote cancelled or lost' else '' end
from public.leads l where l.customer_id is not null
on conflict(quote_id) do nothing;

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  quote_id bigint references public.leads(id) on delete set null,
  booking_id bigint references public.bookings(id) on delete set null,
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  title text not null check (length(btrim(title)) > 0),
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','approved','declined','expired','void')),
  current_version integer not null default 1 check (current_version > 0),
  expiration_date date,
  approved_at timestamptz,
  declined_at timestamptz,
  sent_at timestamptz,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists proposals_active_quote_unique
  on public.proposals(quote_id) where quote_id is not null and status <> 'void';
create unique index if not exists proposals_active_booking_unique
  on public.proposals(booking_id) where booking_id is not null and status <> 'void';

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  introduction text not null default '',
  terms text not null default '',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique(proposal_id, version_number)
);

create table if not exists public.proposal_line_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.proposal_versions(id) on delete cascade,
  position integer not null check (position > 0),
  item_type text not null default 'menu'
    check (item_type in ('menu','package','addon','delivery','setup','discount','other')),
  description text not null check (length(btrim(description)) > 0),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  taxable boolean not null default true,
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  unique(version_id, position)
);

create table if not exists public.customer_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Customer portal',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_portal_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete set null,
  direction text not null check (direction in ('customer','staff')),
  body text not null check (length(btrim(body)) > 0 and length(body) <= 5000),
  created_at timestamptz not null default now()
);

create table if not exists public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  uploaded_by_customer boolean not null default false,
  created_at timestamptz not null default now()
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('customer-documents','customer-documents',false,4194304,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=4194304,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp'];

create table if not exists public.follow_up_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null
    check (trigger_type in ('no_response','proposal_reminder','upcoming_event','post_event_thank_you','review_request','lost_lead')),
  delay_days integer not null default 1 check (delay_days between 0 and 365),
  channel text not null default 'email' check (channel in ('email')),
  subject_template text not null,
  body_template text not null,
  enabled boolean not null default false,
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follow_up_messages (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references public.follow_up_rules(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  booking_id bigint references public.bookings(id) on delete set null,
  channel text not null default 'email' check (channel = 'email'),
  recipient text not null,
  subject text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','cancelled','suppressed')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  provider_message_id text not null default '',
  error_message text not null default '',
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

alter table public.bookings add column if not exists calendar_color text not null default '#e21b23';
alter table public.bookings add column if not exists kitchen_start_at timestamptz;
alter table public.bookings add column if not exists delivery_departure_at timestamptz;

create index if not exists sales_opportunities_stage_followup_idx on public.sales_opportunities(stage, follow_up_at);
create index if not exists sales_opportunities_customer_idx on public.sales_opportunities(customer_id, updated_at desc);
create index if not exists sales_stage_history_opportunity_idx on public.sales_stage_history(opportunity_id, created_at desc);
create index if not exists proposals_customer_idx on public.proposals(customer_id, created_at desc);
create index if not exists proposals_status_expiration_idx on public.proposals(status, expiration_date);
create index if not exists portal_tokens_customer_idx on public.customer_portal_tokens(customer_id, expires_at desc);
create index if not exists follow_up_messages_due_idx on public.follow_up_messages(status, scheduled_for);

create or replace function public.sales_touch_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end $$;

drop trigger if exists sales_opportunities_touch on public.sales_opportunities;
create trigger sales_opportunities_touch before update on public.sales_opportunities
for each row execute function public.sales_touch_updated_at();
drop trigger if exists proposals_touch on public.proposals;
create trigger proposals_touch before update on public.proposals
for each row execute function public.sales_touch_updated_at();

create or replace function public.sales_record_stage_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'INSERT' or old.stage is distinct from new.stage then
    insert into public.sales_stage_history(opportunity_id, from_stage, to_stage, changed_by)
    values(new.id, case when tg_op='UPDATE' then old.stage end, new.stage, auth.uid());
    insert into public.customer_activities(customer_id, activity_type, title, details, quote_id)
    values(new.customer_id, 'sales_stage_changed', 'Sales stage changed',
      coalesce(case when tg_op='UPDATE' then old.stage || ' → ' end,'') || new.stage, new.quote_id);
  end if;
  return new;
end $$;
drop trigger if exists sales_stage_activity on public.sales_opportunities;
create trigger sales_stage_activity after insert or update of stage on public.sales_opportunities
for each row execute function public.sales_record_stage_change();

create or replace function public.sales_save_proposal(
  p_proposal_id uuid, p_customer_id uuid, p_quote_id bigint, p_booking_id bigint,
  p_opportunity_id uuid, p_title text, p_expiration_date date, p_introduction text,
  p_terms text, p_discount numeric, p_tax_rate numeric, p_items jsonb
) returns public.proposals
language plpgsql security definer set search_path = public as $$
declare
  v_proposal public.proposals;
  v_version integer;
  v_version_id uuid;
  v_subtotal numeric(14,2);
  v_taxable numeric(14,2);
  v_discount numeric(14,2) := greatest(coalesce(p_discount,0),0);
  v_tax_rate numeric(7,4) := greatest(least(coalesce(p_tax_rate,0),100),0);
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_customer_id is null or length(btrim(coalesce(p_title,'')))=0 then raise exception 'Customer and title are required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one line item is required'; end if;
  select coalesce(sum(round((x->>'quantity')::numeric * (x->>'unit_price')::numeric,2)),0),
         coalesce(sum(case when coalesce((x->>'taxable')::boolean,true) then round((x->>'quantity')::numeric * (x->>'unit_price')::numeric,2) else 0 end),0)
    into v_subtotal,v_taxable from jsonb_array_elements(p_items) x;
  if v_discount > v_subtotal then raise exception 'Discount cannot exceed subtotal'; end if;

  if p_proposal_id is null then
    insert into public.proposals(customer_id,quote_id,booking_id,opportunity_id,title,expiration_date)
    values(p_customer_id,p_quote_id,p_booking_id,p_opportunity_id,btrim(p_title),p_expiration_date)
    returning * into v_proposal;
    v_version := 1;
  else
    select * into v_proposal from public.proposals where id=p_proposal_id for update;
    if not found then raise exception 'Proposal not found'; end if;
    if v_proposal.status not in ('draft','sent','viewed') then raise exception 'Approved, declined, expired, or void proposals cannot be edited'; end if;
    v_version := v_proposal.current_version + 1;
    update public.proposals set customer_id=p_customer_id, quote_id=p_quote_id, booking_id=p_booking_id,
      opportunity_id=p_opportunity_id,title=btrim(p_title),expiration_date=p_expiration_date,current_version=v_version
      where id=p_proposal_id returning * into v_proposal;
  end if;

  insert into public.proposal_versions(proposal_id,version_number,introduction,terms,subtotal,discount_amount,tax_rate,tax_amount,total_amount)
  values(v_proposal.id,v_version,coalesce(p_introduction,''),coalesce(p_terms,''),v_subtotal,v_discount,v_tax_rate,
    round(greatest(v_taxable-v_discount,0)*v_tax_rate/100,2),
    round(v_subtotal-v_discount+greatest(v_taxable-v_discount,0)*v_tax_rate/100,2))
  returning id into v_version_id;
  insert into public.proposal_line_items(version_id,position,item_type,description,quantity,unit_price,taxable)
  select v_version_id, ordinality, coalesce(x->>'item_type','menu'), btrim(x->>'description'),
    (x->>'quantity')::numeric,(x->>'unit_price')::numeric,coalesce((x->>'taxable')::boolean,true)
  from jsonb_array_elements(p_items) with ordinality a(x,ordinality);
  insert into public.customer_activities(customer_id,activity_type,title,details,quote_id,booking_id)
  values(p_customer_id,'proposal_saved','Proposal saved',p_title || ' · version ' || v_version,p_quote_id,p_booking_id);
  return v_proposal;
exception when unique_violation then
  raise exception 'An active proposal already exists for this quote or booking' using errcode='23505';
end $$;

create or replace function public.sales_set_proposal_status(p_proposal_id uuid, p_status text)
returns public.proposals language plpgsql security definer set search_path=public as $$
declare v public.proposals;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_status not in ('draft','sent','viewed','approved','declined','expired','void') then raise exception 'Invalid proposal status'; end if;
  update public.proposals set status=p_status,
    sent_at=case when p_status='sent' then coalesce(sent_at,now()) else sent_at end,
    approved_at=case when p_status='approved' then now() else approved_at end,
    declined_at=case when p_status='declined' then now() else declined_at end
  where id=p_proposal_id returning * into v;
  if not found then raise exception 'Proposal not found'; end if;
  insert into public.customer_activities(customer_id,activity_type,title,details,quote_id,booking_id)
  values(v.customer_id,'proposal_status_changed','Proposal status changed',p_status,v.quote_id,v.booking_id);
  if v.opportunity_id is not null then
    update public.sales_opportunities set
      stage=case when p_status='sent' then 'proposal_sent' when p_status='viewed' then 'waiting_on_customer'
        when p_status='approved' then 'booked' when p_status='declined' then 'lost' else stage end,
      lost_reason=case when p_status='declined' then 'Proposal declined' else lost_reason end
    where id=v.opportunity_id;
  end if;
  return v;
end $$;

create or replace function public.sales_create_portal_token(p_customer_id uuid, p_expires_at timestamptz default now()+interval '30 days')
returns text language plpgsql security definer set search_path=public as $$
declare v_token text := encode(gen_random_bytes(32),'hex');
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  insert into public.customer_portal_tokens(customer_id,token_hash,expires_at)
  values(p_customer_id,encode(digest(v_token,'sha256'),'hex'),p_expires_at);
  return v_token;
end $$;

create or replace function public.sales_portal_snapshot(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_customer uuid; v_result jsonb;
begin
  select customer_id into v_customer from public.customer_portal_tokens
  where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex') and revoked_at is null and expires_at>now()
  for update;
  if not found then raise exception 'Invalid or expired portal access' using errcode='42501'; end if;
  update public.customer_portal_tokens set last_used_at=now()
  where token_hash=encode(digest(p_token,'sha256'),'hex');
  select jsonb_build_object(
    'customer',(select jsonb_build_object('first_name',first_name,'last_name',last_name,'company',company) from public.customers where id=v_customer),
    'proposals',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'title',p.title,'status',p.status,'expiration_date',p.expiration_date,
      'current_version',p.current_version,'sent_at',p.sent_at,'approved_at',p.approved_at,
      'version',(select jsonb_build_object('version_number',v.version_number,'introduction',v.introduction,
        'terms',v.terms,'subtotal',v.subtotal,'discount_amount',v.discount_amount,'tax_amount',v.tax_amount,
        'total_amount',v.total_amount,'items',coalesce((select jsonb_agg(jsonb_build_object(
          'description',li.description,'quantity',li.quantity,'unit_price',li.unit_price,'line_total',li.line_total
        ) order by li.position) from public.proposal_line_items li where li.version_id=v.id),'[]'::jsonb))
        from public.proposal_versions v where v.proposal_id=p.id order by v.version_number desc limit 1)
      ) order by p.created_at desc) from public.proposals p where p.customer_id=v_customer and p.status<>'draft'),'[]'::jsonb),
    'invoices',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id,'invoice_number',i.invoice_number,'lifecycle_status',i.lifecycle_status,'issue_date',i.issue_date,
      'due_date',i.due_date,'subtotal',i.subtotal,'tax_amount',i.tax_amount,'total_amount',i.total_amount,
      'paid_amount',i.paid_amount,'balance_due',i.balance_due,'customer_notes',i.customer_notes,'terms',i.terms
    ) order by i.created_at desc) from public.invoices i where i.customer_id=v_customer and i.lifecycle_status<>'draft'),'[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(jsonb_build_object(
      'id',b.id,'event_title',b.event_title,'event_type',b.event_type,'event_date',b.event_date,
      'start_time',b.start_time,'end_time',b.end_time,'guest_count',b.guest_count,'venue_name',b.venue_name,
      'venue_address',b.venue_address,'status',b.status
    ) order by b.event_date desc) from public.bookings b where b.customer_id=v_customer),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(jsonb_build_object(
      'id',pay.id,'invoice_id',pay.invoice_id,'entry_type',pay.entry_type,'amount',pay.amount,
      'payment_date',pay.payment_date,'payment_method',pay.payment_method
    ) order by pay.created_at desc) from public.payments pay join public.invoices i on i.id=pay.invoice_id where i.customer_id=v_customer),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'proposal_id',m.proposal_id,'direction',m.direction,'body',m.body,'created_at',m.created_at
    ) order by m.created_at) from public.customer_portal_messages m where m.customer_id=v_customer),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d) - 'storage_path' order by d.created_at desc) from public.customer_documents d where d.customer_id=v_customer),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

create or replace function public.sales_portal_respond(p_token text,p_proposal_id uuid,p_action text,p_message text default '')
returns void language plpgsql security definer set search_path=public as $$
declare v_customer uuid; v_status text;
begin
  select customer_id into v_customer from public.customer_portal_tokens
  where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex') and revoked_at is null and expires_at>now();
  if not found then raise exception 'Invalid or expired portal access' using errcode='42501'; end if;
  if p_action not in ('approve','decline','question') then raise exception 'Invalid portal action'; end if;
  if p_action in ('approve','decline') then
    v_status := case when p_action='approve' then 'approved' else 'declined' end;
    update public.proposals set status=v_status,
      approved_at=case when v_status='approved' then now() else approved_at end,
      declined_at=case when v_status='declined' then now() else declined_at end
    where id=p_proposal_id and customer_id=v_customer and status in ('sent','viewed');
    if not found then raise exception 'Proposal is unavailable for this action'; end if;
    update public.sales_opportunities set stage=case when v_status='approved' then 'booked' else 'lost' end,
      lost_reason=case when v_status='declined' then 'Proposal declined' else lost_reason end
    where id=(select opportunity_id from public.proposals where id=p_proposal_id);
  end if;
  if length(btrim(coalesce(p_message,'')))>0 then
    insert into public.customer_portal_messages(customer_id,proposal_id,direction,body)
    values(v_customer,p_proposal_id,'customer',left(btrim(p_message),5000));
  end if;
  insert into public.customer_activities(customer_id,activity_type,title,details)
  values(v_customer,'customer_portal_activity','Customer portal activity',p_action);
end $$;

create or replace function public.sales_merge_customers(p_keep uuid,p_merge uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_keep=p_merge then raise exception 'Choose two different customers'; end if;
  perform 1 from public.customers where id in(p_keep,p_merge) for update;
  update public.leads set customer_id=p_keep where customer_id=p_merge;
  update public.bookings set customer_id=p_keep where customer_id=p_merge;
  update public.invoices set customer_id=p_keep where customer_id=p_merge;
  update public.proposals set customer_id=p_keep where customer_id=p_merge;
  update public.sales_opportunities set customer_id=p_keep where customer_id=p_merge;
  update public.customer_activities set customer_id=p_keep where customer_id=p_merge;
  update public.customer_portal_messages set customer_id=p_keep where customer_id=p_merge;
  update public.customer_documents set customer_id=p_keep where customer_id=p_merge;
  update public.customer_portal_tokens set revoked_at=now() where customer_id=p_merge and revoked_at is null;
  update public.customers set archived=true,notes=concat_ws(E'\n',nullif(notes,''),'Merged into '||p_keep::text) where id=p_merge;
  insert into public.customer_activities(customer_id,activity_type,title,details)
  values(p_keep,'customers_merged','Customer records merged','Archived duplicate '||p_merge::text);
end $$;

create or replace function public.sales_schedule_due_followups()
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer := 0; v_added integer := 0;
begin
  if current_user not in ('postgres','service_role') and not public.crm_is_admin() then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
  -- Opportunity and proposal follow-ups stop once the opportunity is booked, completed, or lost.
  insert into public.follow_up_messages(rule_id,customer_id,opportunity_id,proposal_id,channel,recipient,subject,body,scheduled_for,idempotency_key,status)
  select r.id,o.customer_id,o.id,p.id,r.channel,c.email,r.subject_template,r.body_template,
    case r.trigger_type when 'proposal_reminder' then p.sent_at+r.delay_days*interval '1 day'
      else o.updated_at+r.delay_days*interval '1 day' end,
    encode(digest(concat_ws(':',r.id::text,o.id::text,coalesce(p.id::text,''),r.trigger_type),'sha256'),'hex'),
    case when length(btrim(c.email))=0 then 'suppressed' else 'queued' end
  from public.follow_up_rules r join public.sales_opportunities o on o.stage not in ('booked','completed','lost')
  join public.customers c on c.id=o.customer_id
  left join lateral (select p1.* from public.proposals p1 where p1.opportunity_id=o.id and p1.status in ('sent','viewed') order by p1.sent_at desc limit 1) p on true
  where r.enabled and r.trigger_type in ('no_response','proposal_reminder')
    and (r.trigger_type<>'proposal_reminder' or p.id is not null)
    and (case r.trigger_type when 'proposal_reminder' then p.sent_at+r.delay_days*interval '1 day' else o.updated_at+r.delay_days*interval '1 day' end)<=now()
  on conflict(idempotency_key) do nothing;
  get diagnostics v_count = row_count;

  insert into public.follow_up_messages(rule_id,customer_id,booking_id,channel,recipient,subject,body,scheduled_for,idempotency_key,status)
  select r.id,b.customer_id,b.id,r.channel,c.email,r.subject_template,r.body_template,
    case when r.trigger_type='upcoming_event' then b.event_date::timestamptz-r.delay_days*interval '1 day'
      else b.event_date::timestamptz+r.delay_days*interval '1 day' end,
    encode(digest(concat_ws(':',r.id::text,b.id::text,r.trigger_type),'sha256'),'hex'),
    case when length(btrim(c.email))=0 then 'suppressed'
      when r.trigger_type='review_request' and not exists(select 1 from public.leads l where l.customer_id=c.id and l.marketing_consent_status='granted') then 'suppressed'
      else 'queued' end
  from public.follow_up_rules r join public.bookings b on b.customer_id is not null and b.status<>'Cancelled'
  join public.customers c on c.id=b.customer_id
  where r.enabled and r.trigger_type in ('upcoming_event','post_event_thank_you','review_request')
    and (case when r.trigger_type='upcoming_event' then b.event_date::timestamptz-r.delay_days*interval '1 day'
      else b.event_date::timestamptz+r.delay_days*interval '1 day' end)<=now()
    and (r.trigger_type='upcoming_event' or b.status='Completed')
  on conflict(idempotency_key) do nothing;
  get diagnostics v_added = row_count;
  v_count := v_count + v_added;

  insert into public.follow_up_messages(rule_id,customer_id,opportunity_id,channel,recipient,subject,body,scheduled_for,idempotency_key,status)
  select r.id,o.customer_id,o.id,r.channel,c.email,r.subject_template,r.body_template,
    o.updated_at+r.delay_days*interval '1 day',
    encode(digest(concat_ws(':',r.id::text,o.id::text,r.trigger_type),'sha256'),'hex'),
    case when length(btrim(c.email))=0 or not exists(select 1 from public.leads l where l.customer_id=c.id and l.marketing_consent_status='granted') then 'suppressed' else 'queued' end
  from public.follow_up_rules r join public.sales_opportunities o on o.stage='lost'
  join public.customers c on c.id=o.customer_id
  where r.enabled and r.trigger_type='lost_lead' and o.updated_at+r.delay_days*interval '1 day'<=now()
  on conflict(idempotency_key) do nothing;
  get diagnostics v_added = row_count;
  v_count := v_count + v_added;
  return v_count;
end $$;

do $$
declare t text;
begin
  foreach t in array array['sales_opportunities','sales_stage_history','sales_comments','proposals','proposal_versions',
    'proposal_line_items','customer_portal_tokens','customer_portal_messages','customer_documents','follow_up_rules','follow_up_messages']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I','Release 3 administrators manage '||t,t);
    execute format('create policy %I on public.%I for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin())',
      'Release 3 administrators manage '||t,t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

-- Proposal versions and stage history are append-only through controlled functions/triggers.
revoke insert,update,delete on public.sales_stage_history from authenticated;
revoke insert,update,delete on public.proposals from authenticated;
revoke insert,update,delete on public.proposal_versions from authenticated;
revoke insert,update,delete on public.proposal_line_items from authenticated;
grant select on public.sales_stage_history,public.proposals,public.proposal_versions,public.proposal_line_items to authenticated;

revoke all on function public.sales_save_proposal(uuid,uuid,bigint,bigint,uuid,text,date,text,text,numeric,numeric,jsonb) from public,anon;
revoke all on function public.sales_set_proposal_status(uuid,text) from public,anon;
revoke all on function public.sales_create_portal_token(uuid,timestamptz) from public,anon;
revoke all on function public.sales_merge_customers(uuid,uuid) from public,anon;
grant execute on function public.sales_save_proposal(uuid,uuid,bigint,bigint,uuid,text,date,text,text,numeric,numeric,jsonb) to authenticated;
grant execute on function public.sales_set_proposal_status(uuid,text) to authenticated;
grant execute on function public.sales_create_portal_token(uuid,timestamptz) to authenticated;
grant execute on function public.sales_merge_customers(uuid,uuid) to authenticated;
revoke all on function public.sales_schedule_due_followups() from public,anon,authenticated;
grant execute on function public.sales_schedule_due_followups() to service_role;
revoke all on function public.sales_portal_snapshot(text) from public;
revoke all on function public.sales_portal_respond(text,uuid,text,text) from public;
grant execute on function public.sales_portal_snapshot(text) to anon,authenticated;
grant execute on function public.sales_portal_respond(text,uuid,text,text) to anon,authenticated;

commit;
