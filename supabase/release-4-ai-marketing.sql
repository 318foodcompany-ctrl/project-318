-- Project 318 Release 4: AI marketing drafts, campaigns, email sequences, consent, and delivery reporting.
-- Apply after release-3-sales-platform.sql and launch-readiness-hardening.sql.
-- Additive, transaction-wrapped, and safe to rerun. Does not enroll existing customers.
begin;

do $$
begin
  if to_regprocedure('public.crm_is_admin()') is null
     or to_regclass('public.follow_up_messages') is null
     or to_regclass('public.marketing_consent_history') is null then
    raise exception 'CRM, Release 1, Release 3, and Launch Readiness migrations are required';
  end if;
end $$;

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text not null default '' check (length(description) <= 4000),
  goal text not null default '' check (length(goal) <= 500),
  audience text not null default '' check (length(audience) <= 500),
  offer text not null default '' check (length(offer) <= 1000),
  status text not null default 'draft'
    check (status in ('draft','scheduled','running','paused','completed','cancelled','archived')),
  tags text[] not null default '{}',
  start_date date,
  end_date date,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.marketing_ai_content (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  content_type text not null check (content_type in (
    'facebook_post','instagram_caption','google_business_post','linkedin_post',
    'promotional_email','email_newsletter','blog_draft','google_ads','meta_ads',
    'landing_page','seasonal_campaign','holiday_campaign','executive_summary'
  )),
  title text not null default '' check (length(title) <= 300),
  generation_input jsonb not null default '{}'::jsonb check (jsonb_typeof(generation_input)='object'),
  structured_output jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_output)='object'),
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  tags text[] not null default '{}',
  provider text not null default '',
  model text not null default '',
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost numeric(12,6) check (estimated_cost is null or estimated_cost >= 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.marketing_email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  category text not null default 'general' check (length(category) between 1 and 100),
  subject_template text not null check (length(btrim(subject_template)) between 1 and 300),
  preview_text text not null default '' check (length(preview_text) <= 500),
  blocks jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks)='array'),
  plain_text_template text not null default '' check (length(plain_text_template) <= 50000),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.marketing_email_sequences (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 200),
  trigger_type text not null check (trigger_type in (
    'new_lead','quote_requested','proposal_sent','proposal_viewed','proposal_not_viewed',
    'proposal_approved','proposal_expired','booking_confirmed','event_approaching',
    'event_completed','review_request','customer_inactive','manual'
  )),
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_email_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.marketing_email_sequences(id) on delete cascade,
  template_id uuid not null references public.marketing_email_templates(id) on delete restrict,
  position integer not null check (position between 0 and 100),
  delay_minutes integer not null default 0 check (delay_minutes between 0 and 525600),
  conditions jsonb not null default '{}'::jsonb check (jsonb_typeof(conditions)='object'),
  created_at timestamptz not null default now(),
  unique(sequence_id,position)
);

create table if not exists public.marketing_email_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.marketing_email_sequences(id) on delete restrict,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  lead_id bigint references public.leads(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  booking_id bigint references public.bookings(id) on delete set null,
  status text not null default 'active' check (status in ('active','paused','completed','cancelled','suppressed')),
  trigger_key text not null,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid default auth.uid(),
  unique(sequence_id,customer_id,trigger_key)
);

create table if not exists public.marketing_suppressions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete restrict,
  normalized_email text not null,
  scope text not null default 'global' check (scope in ('global','campaign')),
  campaign_id uuid references public.marketing_campaigns(id) on delete cascade,
  reason text not null check (reason in ('unsubscribe','bounce','complaint','administrator')),
  active boolean not null default true,
  source text not null default 'system',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  lifted_at timestamptz,
  lifted_by uuid,
  check ((scope='global' and campaign_id is null) or (scope='campaign' and campaign_id is not null))
);
create unique index if not exists marketing_suppressions_active_unique
  on public.marketing_suppressions(normalized_email,scope,coalesce(campaign_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where active;

create table if not exists public.marketing_unsubscribe_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  token_hash text not null unique check (length(token_hash)=64),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.marketing_consent_audit (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  action text not null check (action in ('unsubscribed','suppressed','resubscribed','suppression_lifted')),
  scope text not null check (scope in ('global','campaign')),
  source text not null,
  occurred_at timestamptz not null default now(),
  actor_id uuid default auth.uid(),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object')
);

create table if not exists public.marketing_email_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.follow_up_messages(id) on delete set null,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  provider_message_id text not null default '',
  event_type text not null check (event_type in (
    'queued','claimed','sent','delivered','opened','clicked','deferred','bounced',
    'complained','unsubscribed','failed','cancelled'
  )),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

alter table public.follow_up_messages add column if not exists campaign_id uuid references public.marketing_campaigns(id) on delete set null;
alter table public.follow_up_messages add column if not exists template_id uuid references public.marketing_email_templates(id) on delete set null;
alter table public.follow_up_messages add column if not exists enrollment_id uuid references public.marketing_email_enrollments(id) on delete set null;
alter table public.follow_up_messages add column if not exists classification text not null default 'transactional';
alter table public.follow_up_messages add column if not exists html_body text not null default '';
alter table public.follow_up_messages add column if not exists retry_count integer not null default 0;
alter table public.follow_up_messages add column if not exists max_retries integer not null default 3;
alter table public.follow_up_messages add column if not exists last_attempt_at timestamptz;
alter table public.follow_up_messages drop constraint if exists follow_up_messages_classification_check;
alter table public.follow_up_messages add constraint follow_up_messages_classification_check
  check (classification in ('transactional','marketing'));
alter table public.follow_up_messages drop constraint if exists follow_up_messages_retry_check;
alter table public.follow_up_messages add constraint follow_up_messages_retry_check
  check (retry_count between 0 and 10 and max_retries between 0 and 10);

create index if not exists marketing_campaigns_status_dates_idx on public.marketing_campaigns(status,start_date,end_date);
create index if not exists marketing_ai_content_campaign_idx on public.marketing_ai_content(campaign_id,created_at desc);
create index if not exists marketing_templates_status_idx on public.marketing_email_templates(status,category);
create index if not exists marketing_sequences_trigger_idx on public.marketing_email_sequences(status,trigger_type);
create index if not exists marketing_steps_sequence_idx on public.marketing_email_sequence_steps(sequence_id,position);
create index if not exists marketing_enrollments_status_idx on public.marketing_email_enrollments(status,sequence_id);
create index if not exists marketing_suppressions_email_idx on public.marketing_suppressions(normalized_email,active);
create index if not exists marketing_consent_audit_customer_idx on public.marketing_consent_audit(customer_id,occurred_at desc);
create index if not exists marketing_email_events_message_idx on public.marketing_email_events(message_id,occurred_at);
create index if not exists marketing_email_events_campaign_idx on public.marketing_email_events(campaign_id,event_type,occurred_at);
create index if not exists follow_up_messages_marketing_due_idx
  on public.follow_up_messages(status,scheduled_for,retry_count) where classification='marketing';

create or replace function public.marketing_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists marketing_campaigns_touch on public.marketing_campaigns;
create trigger marketing_campaigns_touch before update on public.marketing_campaigns
for each row execute function public.marketing_touch_updated_at();
drop trigger if exists marketing_ai_content_touch on public.marketing_ai_content;
create trigger marketing_ai_content_touch before update on public.marketing_ai_content
for each row execute function public.marketing_touch_updated_at();
drop trigger if exists marketing_email_templates_touch on public.marketing_email_templates;
create trigger marketing_email_templates_touch before update on public.marketing_email_templates
for each row execute function public.marketing_touch_updated_at();
drop trigger if exists marketing_email_sequences_touch on public.marketing_email_sequences;
create trigger marketing_email_sequences_touch before update on public.marketing_email_sequences
for each row execute function public.marketing_touch_updated_at();

create or replace function public.marketing_has_consent(p_customer_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.marketing_consent_history h
    where h.customer_id=p_customer_id and h.channel='email'
      and h.granted and h.withdrawn_at is null
      and not exists(
        select 1 from public.marketing_consent_history newer
        where newer.customer_id=h.customer_id and newer.channel=h.channel
          and newer.recorded_at>h.recorded_at
      )
  )
$$;
revoke all on function public.marketing_has_consent(uuid) from public,anon,authenticated;
grant execute on function public.marketing_has_consent(uuid) to service_role;

create or replace function public.marketing_is_suppressed(p_email text,p_campaign_id uuid default null)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.marketing_suppressions s
    where s.active and s.normalized_email=lower(btrim(coalesce(p_email,'')))
      and (s.scope='global' or (s.scope='campaign' and s.campaign_id=p_campaign_id))
  )
$$;
revoke all on function public.marketing_is_suppressed(text,uuid) from public,anon,authenticated;
grant execute on function public.marketing_is_suppressed(text,uuid) to service_role;

create or replace function public.marketing_create_unsubscribe_token(p_customer_id uuid,p_days integer default 365)
returns text language plpgsql security definer set search_path=public as $$
declare v_token text:=encode(gen_random_bytes(32),'hex');
begin
  if current_user not in ('postgres','service_role') and not public.crm_is_admin() then
    raise exception 'Administrator or service role required' using errcode='42501';
  end if;
  insert into public.marketing_unsubscribe_tokens(customer_id,token_hash,expires_at)
  values(p_customer_id,encode(digest(v_token,'sha256'),'hex'),now()+least(greatest(coalesce(p_days,365),1),730)*interval '1 day');
  return v_token;
end $$;
revoke all on function public.marketing_create_unsubscribe_token(uuid,integer) from public,anon,authenticated;
grant execute on function public.marketing_create_unsubscribe_token(uuid,integer) to authenticated,service_role;

create or replace function public.marketing_unsubscribe(p_token text,p_scope text default 'global',p_campaign_id uuid default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_customer uuid; v_email text;
begin
  if p_scope not in ('global','campaign') or (p_scope='campaign' and p_campaign_id is null) then return false; end if;
  select t.customer_id,c.email into v_customer,v_email
  from public.marketing_unsubscribe_tokens t join public.customers c on c.id=t.customer_id
  where t.token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex')
    and t.used_at is null and t.expires_at>now() for update of t;
  if not found then return false; end if;
  update public.marketing_unsubscribe_tokens set used_at=now()
  where token_hash=encode(digest(p_token,'sha256'),'hex');
  insert into public.marketing_suppressions(customer_id,normalized_email,scope,campaign_id,reason,source)
  values(v_customer,lower(btrim(v_email)),p_scope,case when p_scope='campaign' then p_campaign_id end,'unsubscribe','one_click')
  on conflict do nothing;
  insert into public.marketing_consent_audit(customer_id,campaign_id,action,scope,source,details)
  values(v_customer,case when p_scope='campaign' then p_campaign_id end,'unsubscribed',p_scope,'one_click',
    jsonb_build_object('marketing_consent_history_preserved',true));
  update public.follow_up_messages set status='suppressed',error_message='UNSUBSCRIBED'
  where customer_id=v_customer and classification='marketing' and status in ('queued','processing')
    and (p_scope='global' or campaign_id=p_campaign_id);
  return true;
end $$;
revoke all on function public.marketing_unsubscribe(text,text,uuid) from public,authenticated;
grant execute on function public.marketing_unsubscribe(text,text,uuid) to anon;

create or replace function public.marketing_enroll_customer(
  p_sequence_id uuid,p_customer_id uuid,p_trigger_key text,p_lead_id bigint default null,
  p_proposal_id uuid default null,p_booking_id bigint default null
) returns public.marketing_email_enrollments
language plpgsql security definer set search_path=public as $$
declare v_sequence public.marketing_email_sequences; v_enrollment public.marketing_email_enrollments;
  v_customer public.customers; v_step record; v_subject text; v_body text; v_message_id uuid;
begin
  if current_user not in ('postgres','service_role') and not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select * into v_sequence from public.marketing_email_sequences where id=p_sequence_id and status='active';
  if not found then raise exception 'Active sequence not found'; end if;
  select * into v_customer from public.customers where id=p_customer_id and not archived;
  if not found then raise exception 'Active customer not found'; end if;
  insert into public.marketing_email_enrollments(sequence_id,campaign_id,customer_id,lead_id,proposal_id,booking_id,trigger_key)
  values(v_sequence.id,v_sequence.campaign_id,p_customer_id,p_lead_id,p_proposal_id,p_booking_id,left(btrim(p_trigger_key),200))
  on conflict(sequence_id,customer_id,trigger_key) do update set id=public.marketing_email_enrollments.id
  returning * into v_enrollment;
  if not public.marketing_has_consent(p_customer_id) or public.marketing_is_suppressed(v_customer.email,v_sequence.campaign_id) then
    update public.marketing_email_enrollments set status='suppressed' where id=v_enrollment.id returning * into v_enrollment;
    return v_enrollment;
  end if;
  for v_step in
    select s.*,t.subject_template,t.plain_text_template,t.preview_text
    from public.marketing_email_sequence_steps s join public.marketing_email_templates t on t.id=s.template_id
    where s.sequence_id=v_sequence.id and t.status='active' order by s.position
  loop
    if coalesce((v_step.conditions->>'proposal_not_viewed')::boolean,false)
       and exists(select 1 from public.proposals p where p.id=p_proposal_id and p.status='viewed') then continue; end if;
    if coalesce((v_step.conditions->>'proposal_viewed')::boolean,false)
       and not exists(select 1 from public.proposals p where p.id=p_proposal_id and p.status='viewed') then continue; end if;
    if coalesce((v_step.conditions->>'proposal_not_approved')::boolean,false)
       and exists(select 1 from public.proposals p where p.id=p_proposal_id and p.status='approved') then continue; end if;
    if coalesce((v_step.conditions->>'customer_not_replied')::boolean,false)
       and exists(select 1 from public.customer_portal_messages m where m.customer_id=p_customer_id and m.direction='customer'
         and m.created_at>=v_enrollment.enrolled_at and (p_proposal_id is null or m.proposal_id=p_proposal_id)) then continue; end if;
    if coalesce((v_step.conditions->>'customer_not_booked')::boolean,false)
       and exists(select 1 from public.bookings b where b.customer_id=p_customer_id and b.status<>'Cancelled') then continue; end if;
    if coalesce((v_step.conditions->>'customer_booked')::boolean,false)
       and not exists(select 1 from public.bookings b where b.customer_id=p_customer_id and b.status<>'Cancelled') then continue; end if;
    if coalesce((v_step.conditions->>'corporate_lead')::boolean,false)
       and not exists(select 1 from public.leads l where l.customer_id=p_customer_id and (length(btrim(l.company))>0 or lower(l.event_type) like '%corporate%')) then continue; end if;
    if coalesce((v_step.conditions->>'repeat_customer')::boolean,false)
       and (select count(*) from public.bookings b where b.customer_id=p_customer_id and b.status='Completed')<2 then continue; end if;
    if coalesce((v_step.conditions->>'event_not_passed')::boolean,false)
       and exists(select 1 from public.bookings b where b.id=p_booking_id and b.event_date<current_date) then continue; end if;
    v_subject:=replace(replace(v_step.subject_template,'{{first_name}}',coalesce(v_customer.first_name,'')),
      '{{company_name}}',coalesce(v_customer.company,''));
    v_body:=replace(replace(v_step.plain_text_template,'{{first_name}}',coalesce(v_customer.first_name,'')),
      '{{company_name}}',coalesce(v_customer.company,''));
    v_message_id:=null;
    insert into public.follow_up_messages(customer_id,proposal_id,booking_id,channel,recipient,subject,body,
      scheduled_for,idempotency_key,status,campaign_id,template_id,enrollment_id,classification)
    values(p_customer_id,p_proposal_id,p_booking_id,'email',v_customer.email,v_subject,v_body,
      now()+v_step.delay_minutes*interval '1 minute',
      encode(digest(v_enrollment.id::text||':'||v_step.id::text,'sha256'),'hex'),'queued',
      v_sequence.campaign_id,v_step.template_id,v_enrollment.id,'marketing')
    on conflict(idempotency_key) do nothing returning id into v_message_id;
    if v_message_id is not null then
      insert into public.marketing_email_events(message_id,campaign_id,provider,provider_event_id,event_type,occurred_at)
      values(v_message_id,v_sequence.campaign_id,'internal','queue:'||v_message_id,'queued',now())
      on conflict(provider,provider_event_id) do nothing;
    end if;
  end loop;
  return v_enrollment;
end $$;
revoke all on function public.marketing_enroll_customer(uuid,uuid,text,bigint,uuid,bigint) from public,anon;
grant execute on function public.marketing_enroll_customer(uuid,uuid,text,bigint,uuid,bigint) to authenticated;

create or replace function public.marketing_event_enrollment()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_sequence record; v_trigger text; v_customer uuid; v_key text;
begin
  if tg_table_name='leads' then
    if new.customer_id is null then return new; end if;
    v_customer:=new.customer_id; v_trigger:='quote_requested'; v_key:='lead:'||new.id;
  elsif tg_table_name='proposals' then
    if new.customer_id is null or new.status is not distinct from old.status then return new; end if;
    v_customer:=new.customer_id;
    v_trigger:=case new.status when 'sent' then 'proposal_sent' when 'viewed' then 'proposal_viewed'
      when 'approved' then 'proposal_approved' else null end;
    v_key:='proposal:'||new.id||':'||new.status;
  elsif tg_table_name='bookings' then
    if new.customer_id is null then return new; end if;
    v_customer:=new.customer_id;
    v_trigger:=case new.status when 'Confirmed' then 'booking_confirmed' when 'Completed' then 'event_completed' else null end;
    if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
    v_key:='booking:'||new.id||':'||new.status;
  end if;
  if v_trigger is null then return new; end if;
  for v_sequence in select id from public.marketing_email_sequences where status='active'
    and trigger_type in(v_trigger,case when v_trigger='quote_requested' then 'new_lead' end,
      case when v_trigger='event_completed' then 'review_request' end)
  loop
    perform public.marketing_enroll_customer(v_sequence.id,v_customer,v_key,
      case when tg_table_name='leads' then new.id end,
      case when tg_table_name='proposals' then new.id end,
      case when tg_table_name='bookings' then new.id end);
  end loop;
  return new;
end $$;
drop trigger if exists marketing_lead_enrollment on public.leads;
create trigger marketing_lead_enrollment after insert on public.leads for each row execute function public.marketing_event_enrollment();
drop trigger if exists marketing_proposal_enrollment on public.proposals;
create trigger marketing_proposal_enrollment after update of status on public.proposals for each row execute function public.marketing_event_enrollment();
drop trigger if exists marketing_booking_enrollment on public.bookings;
create trigger marketing_booking_enrollment after insert or update of status on public.bookings for each row execute function public.marketing_event_enrollment();

create or replace function public.marketing_schedule_time_enrollments()
returns integer language plpgsql security definer set search_path=public as $$
declare v_sequence record; v_record record; v_count integer:=0;
begin
  if current_user not in ('postgres','service_role') then raise exception 'Service role required' using errcode='42501'; end if;
  for v_sequence in select * from public.marketing_email_sequences where status='active' and trigger_type in('proposal_not_viewed','proposal_expired','event_approaching','customer_inactive')
  loop
    if v_sequence.trigger_type in('proposal_not_viewed','proposal_expired') then
      for v_record in select p.id,p.customer_id from public.proposals p
        where (v_sequence.trigger_type='proposal_not_viewed' and p.status='sent' and p.sent_at<now()-interval '1 day')
           or (v_sequence.trigger_type='proposal_expired' and p.expiration_date<current_date and p.status in('sent','viewed'))
      loop perform public.marketing_enroll_customer(v_sequence.id,v_record.customer_id,'timed-proposal:'||v_record.id,null,v_record.id,null);v_count:=v_count+1;end loop;
    elsif v_sequence.trigger_type='event_approaching' then
      for v_record in select b.id,b.customer_id from public.bookings b where b.customer_id is not null and b.status<>'Cancelled' and b.event_date between current_date and current_date+30
      loop perform public.marketing_enroll_customer(v_sequence.id,v_record.customer_id,'approaching:'||v_record.id,null,null,v_record.id);v_count:=v_count+1;end loop;
    else
      for v_record in select c.id from public.customers c where not c.archived and c.updated_at<now()-interval '90 days'
      loop perform public.marketing_enroll_customer(v_sequence.id,v_record.id,'inactive:'||to_char(current_date,'YYYY-MM'),null,null,null);v_count:=v_count+1;end loop;
    end if;
  end loop;
  return v_count;
end $$;
revoke all on function public.marketing_schedule_time_enrollments() from public,anon,authenticated;
grant execute on function public.marketing_schedule_time_enrollments() to service_role;

create or replace function public.marketing_validate_claim(p_message_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_message public.follow_up_messages; v_email text;
begin
  if current_user not in ('postgres','service_role') then raise exception 'Service role required' using errcode='42501'; end if;
  select * into v_message from public.follow_up_messages where id=p_message_id for update;
  if not found or v_message.status<>'processing' then return false; end if;
  if v_message.classification='transactional' then return true; end if;
  select email into v_email from public.customers where id=v_message.customer_id;
  if not public.marketing_has_consent(v_message.customer_id)
     or public.marketing_is_suppressed(v_email,v_message.campaign_id)
     or exists(select 1 from public.marketing_email_enrollments e where e.id=v_message.enrollment_id and e.status<>'active')
     or exists(select 1 from public.marketing_email_enrollments e join public.marketing_email_sequences s on s.id=e.sequence_id
       where e.id=v_message.enrollment_id and s.status<>'active')
     or exists(select 1 from public.marketing_campaigns c where c.id=v_message.campaign_id and c.status<>'running')
  then
    update public.follow_up_messages set status='suppressed',processing_started_at=null,error_message='CONSENT_OR_SUPPRESSION'
    where id=p_message_id;
    return false;
  end if;
  return true;
end $$;
revoke all on function public.marketing_validate_claim(uuid) from public,anon,authenticated;
grant execute on function public.marketing_validate_claim(uuid) to service_role;

create or replace function public.marketing_cancel_enrollment(p_enrollment_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_message record;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  update public.marketing_email_enrollments set status='cancelled',cancelled_at=now()
  where id=p_enrollment_id and status in ('active','paused');
  for v_message in
    update public.follow_up_messages set status='cancelled',processing_started_at=null
    where enrollment_id=p_enrollment_id and classification='marketing' and status in ('queued','processing')
    returning id,campaign_id
  loop
    insert into public.marketing_email_events(message_id,campaign_id,provider,provider_event_id,event_type,occurred_at)
    values(v_message.id,v_message.campaign_id,'internal','cancel:'||v_message.id,'cancelled',now())
    on conflict(provider,provider_event_id) do nothing;
  end loop;
end $$;
revoke all on function public.marketing_cancel_enrollment(uuid) from public,anon;
grant execute on function public.marketing_cancel_enrollment(uuid) to authenticated;

drop function if exists public.marketing_campaign_report(date,date,uuid);
create or replace function public.marketing_campaign_report(
  p_start date,p_end date,p_campaign_id uuid default null,p_sequence_id uuid default null,
  p_audience text default null,p_source text default null,p_status text default null
)
returns table(campaign_id uuid,campaign_name text,event_type text,event_count bigint,amount numeric)
language plpgsql security definer set search_path=public as $$
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>730 then raise exception 'Invalid reporting range'; end if;
  return query
  with results as (
    select c.id,c.name,'campaigns_created',case when c.created_at>=p_start::timestamptz and c.created_at<(p_end+1)::timestamptz then 1 else 0 end::bigint,0::numeric amount
    from public.marketing_campaigns c
    where (p_campaign_id is null or c.id=p_campaign_id)
      and (p_audience is null or c.audience ilike '%'||p_audience||'%')
      and (p_source is null or p_source=any(c.tags))
      and (p_status is null or c.status=p_status)
    union all
    select c.id,c.name,e.event_type,count(*)::bigint,0::numeric amount from public.marketing_campaigns c
    left join public.marketing_email_events e on e.campaign_id=c.id
      and e.occurred_at>=p_start::timestamptz and e.occurred_at<(p_end+1)::timestamptz
    left join public.marketing_email_enrollments enrollment on enrollment.id=e.enrollment_id
    where (p_campaign_id is null or c.id=p_campaign_id)
      and (p_sequence_id is null or enrollment.sequence_id=p_sequence_id)
      and (p_audience is null or c.audience ilike '%'||p_audience||'%')
      and (p_source is null or p_source=any(c.tags))
      and (p_status is null or c.status=p_status)
    group by c.id,c.name,e.event_type
    union all
    select c.id,c.name,'leads_generated',count(distinct enrollment.lead_id)::bigint,0::numeric
    from public.marketing_campaigns c left join public.marketing_email_enrollments enrollment on enrollment.campaign_id=c.id and enrollment.enrolled_at>=p_start::timestamptz and enrollment.enrolled_at<(p_end+1)::timestamptz
    where (p_campaign_id is null or c.id=p_campaign_id) and (p_sequence_id is null or enrollment.sequence_id=p_sequence_id)
      and (p_audience is null or c.audience ilike '%'||p_audience||'%') and (p_source is null or p_source=any(c.tags)) and (p_status is null or c.status=p_status)
    group by c.id,c.name
    union all
    select c.id,c.name,'quotes_generated',count(distinct enrollment.lead_id)::bigint,0::numeric
    from public.marketing_campaigns c left join public.marketing_email_enrollments enrollment on enrollment.campaign_id=c.id and enrollment.enrolled_at>=p_start::timestamptz and enrollment.enrolled_at<(p_end+1)::timestamptz
    where (p_campaign_id is null or c.id=p_campaign_id) and (p_sequence_id is null or enrollment.sequence_id=p_sequence_id)
      and (p_audience is null or c.audience ilike '%'||p_audience||'%') and (p_source is null or p_source=any(c.tags)) and (p_status is null or c.status=p_status)
    group by c.id,c.name
    union all
    select c.id,c.name,'bookings_attributed',count(distinct enrollment.booking_id)::bigint,0::numeric
    from public.marketing_campaigns c left join public.marketing_email_enrollments enrollment on enrollment.campaign_id=c.id and enrollment.enrolled_at>=p_start::timestamptz and enrollment.enrolled_at<(p_end+1)::timestamptz
    where (p_campaign_id is null or c.id=p_campaign_id) and (p_sequence_id is null or enrollment.sequence_id=p_sequence_id)
      and (p_audience is null or c.audience ilike '%'||p_audience||'%') and (p_source is null or p_source=any(c.tags)) and (p_status is null or c.status=p_status)
    group by c.id,c.name
    union all
    select c.id,c.name,'revenue_attributed',count(distinct pay.id)::bigint,coalesce(sum(case when pay.entry_type in ('payment','deposit') then pay.amount else -pay.amount end),0)
    from public.marketing_campaigns c
    left join public.marketing_email_enrollments enrollment on enrollment.campaign_id=c.id
    left join public.invoices invoice on invoice.booking_id=enrollment.booking_id or invoice.quote_id=enrollment.lead_id
    left join public.payments pay on pay.invoice_id=invoice.id and pay.payment_date>=p_start and pay.payment_date<=p_end
    where (p_campaign_id is null or c.id=p_campaign_id) and (p_sequence_id is null or enrollment.sequence_id=p_sequence_id)
      and (p_audience is null or c.audience ilike '%'||p_audience||'%') and (p_source is null or p_source=any(c.tags)) and (p_status is null or c.status=p_status)
    group by c.id,c.name
  )
  select * from results;
end $$;
revoke all on function public.marketing_campaign_report(date,date,uuid,uuid,text,text,text) from public,anon;
grant execute on function public.marketing_campaign_report(date,date,uuid,uuid,text,text,text) to authenticated;

create or replace function public.marketing_reorder_step(p_step_id uuid,p_direction integer)
returns void language plpgsql security definer set search_path=public as $$
declare v_step public.marketing_email_sequence_steps; v_other public.marketing_email_sequence_steps;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_direction not in (-1,1) then raise exception 'Direction must be -1 or 1'; end if;
  select * into v_step from public.marketing_email_sequence_steps where id=p_step_id for update;
  if not found then raise exception 'Sequence step not found'; end if;
  if p_direction=-1 then
    select * into v_other from public.marketing_email_sequence_steps
    where sequence_id=v_step.sequence_id and position<v_step.position
    order by position desc limit 1 for update;
  else
    select * into v_other from public.marketing_email_sequence_steps
    where sequence_id=v_step.sequence_id and position>v_step.position
    order by position asc limit 1 for update;
  end if;
  if not found then return; end if;
  update public.marketing_email_sequence_steps set position=0 where id=v_step.id;
  update public.marketing_email_sequence_steps set position=v_step.position where id=v_other.id;
  update public.marketing_email_sequence_steps set position=v_other.position where id=v_step.id;
end $$;
revoke all on function public.marketing_reorder_step(uuid,integer) from public,anon;
grant execute on function public.marketing_reorder_step(uuid,integer) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'marketing_campaigns','marketing_ai_content','marketing_email_templates',
    'marketing_email_sequences','marketing_email_sequence_steps','marketing_email_enrollments',
    'marketing_suppressions','marketing_unsubscribe_tokens','marketing_consent_audit','marketing_email_events'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I','Release 4 administrators manage '||t,t);
    execute format('create policy %I on public.%I for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin())',
      'Release 4 administrators manage '||t,t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $;

grant select on table
  public.marketing_campaigns,
  public.marketing_ai_content,
  public.marketing_email_templates,
  public.marketing_email_sequences,
  public.marketing_email_enrollments,
  public.marketing_suppressions,
  public.marketing_email_events
to anon;

-- Compliance history is written only by trusted functions/services.
revoke insert,update,delete on public.marketing_email_events from authenticated;
revoke insert,update,delete on public.marketing_unsubscribe_tokens from authenticated;
revoke insert,update,delete on public.marketing_consent_audit from authenticated;

commit;
