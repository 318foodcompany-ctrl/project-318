-- Project 318 production invoicing and payment tracking.
-- Review before running. This migration is non-destructive and safe to rerun.
begin;

create extension if not exists pgcrypto;

create table if not exists public.invoice_number_sequences (
  sequence_year integer primary key,
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  quote_id bigint references public.leads(id) on delete set null,
  booking_id bigint references public.bookings(id) on delete set null,
  lifecycle_status text not null default 'draft'
    check (lifecycle_status in ('draft', 'sent', 'void')),
  issue_date date,
  due_date date,
  currency text not null default 'USD' check (currency = 'USD'),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  required_deposit_amount numeric(14,2) not null default 0 check (required_deposit_amount >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0),
  balance_due numeric(14,2) not null default 0 check (balance_due >= 0),
  customer_notes text not null default '',
  internal_notes text not null default '',
  terms text not null default '',
  sent_at timestamptz,
  voided_at timestamptz,
  void_reason text not null default '',
  version integer not null default 1 check (version > 0),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_issue_fields check (
    (lifecycle_status = 'draft' and invoice_number is null)
    or (lifecycle_status in ('sent', 'void') and invoice_number is not null and issue_date is not null and due_date is not null)
  ),
  constraint invoices_due_after_issue check (
    issue_date is null or due_date is null or due_date >= issue_date
  ),
  constraint invoices_balance_equation check (balance_due = total_amount - paid_amount)
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position integer not null check (position > 0),
  description text not null check (length(btrim(description)) > 0),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  taxable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, position)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  entry_type text not null check (entry_type in ('payment', 'deposit', 'refund', 'reversal')),
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'other'
    check (payment_method in ('cash', 'check', 'card', 'ach', 'square', 'other')),
  reference_number text not null default '',
  notes text not null default '',
  reverses_payment_id uuid references public.payments(id) on delete restrict,
  recorded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint payments_reversal_link check (
    (entry_type = 'reversal' and reverses_payment_id is not null)
    or (entry_type <> 'reversal' and reverses_payment_id is null)
  ),
  unique (reverses_payment_id)
);

create unique index if not exists invoices_active_quote_unique
  on public.invoices (quote_id)
  where quote_id is not null and lifecycle_status <> 'void';
create unique index if not exists invoices_active_booking_unique
  on public.invoices (booking_id)
  where booking_id is not null and lifecycle_status <> 'void';
create index if not exists invoices_customer_created_idx
  on public.invoices (customer_id, created_at desc);
create index if not exists invoices_due_date_idx
  on public.invoices (due_date) where lifecycle_status = 'sent';
create index if not exists invoices_number_search_idx
  on public.invoices (lower(invoice_number)) where invoice_number is not null;
create index if not exists payments_invoice_created_idx
  on public.payments (invoice_id, created_at desc);

alter table public.customer_activities add column if not exists invoice_id uuid;
alter table public.customer_activities add column if not exists payment_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_activities_invoice_id_fkey'
      and conrelid = 'public.customer_activities'::regclass
  ) then
    alter table public.customer_activities
      add constraint customer_activities_invoice_id_fkey
      foreign key (invoice_id) references public.invoices(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_activities_payment_id_fkey'
      and conrelid = 'public.customer_activities'::regclass
  ) then
    alter table public.customer_activities
      add constraint customer_activities_payment_id_fkey
      foreign key (payment_id) references public.payments(id) on delete set null;
  end if;
end;
$$;

create index if not exists customer_activities_invoice_idx
  on public.customer_activities (invoice_id) where invoice_id is not null;
create index if not exists customer_activities_payment_idx
  on public.customer_activities (payment_id) where payment_id is not null;

create or replace function public.invoicing_effective_status(p_invoice public.invoices)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when p_invoice.lifecycle_status = 'void' then 'void'
    when p_invoice.lifecycle_status = 'draft' then 'draft'
    when p_invoice.balance_due = 0 then 'paid'
    when p_invoice.paid_amount > 0 then 'partially_paid'
    when p_invoice.due_date < current_date then 'overdue'
    else 'sent'
  end;
$$;

create or replace function public.invoicing_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  if row(new.*) is distinct from row(old.*) then
    new.version = old.version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.invoicing_set_updated_at();

create or replace function public.invoicing_next_number(p_issue_date date)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year integer := extract(year from coalesce(p_issue_date, current_date))::integer;
  v_number bigint;
begin
  if not public.crm_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  insert into public.invoice_number_sequences(sequence_year, last_number, updated_at)
  values(v_year, 1, now())
  on conflict (sequence_year) do update
    set last_number = public.invoice_number_sequences.last_number + 1,
        updated_at = now()
  returning last_number into v_number;
  return '318-' || v_year || '-' || lpad(v_number::text, 6, '0');
end;
$$;

create or replace function public.invoicing_recalculate(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices;
  v_subtotal numeric(14,2);
  v_taxable numeric(14,2);
  v_discount numeric(14,2);
  v_tax_basis numeric(14,2);
  v_tax numeric(14,2);
  v_total numeric(14,2);
  v_paid numeric(14,2);
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;

  select coalesce(sum(line_total), 0), coalesce(sum(line_total) filter (where taxable), 0)
  into v_subtotal, v_taxable
  from public.invoice_line_items where invoice_id = p_invoice_id;

  v_discount := least(v_invoice.discount_amount, v_subtotal);
  v_tax_basis := greatest(v_taxable - case when v_subtotal > 0 then round(v_discount * (v_taxable / v_subtotal), 2) else 0 end, 0);
  v_tax := round(v_tax_basis * v_invoice.tax_rate / 100, 2);
  v_total := greatest(v_subtotal - v_discount + v_tax, 0);

  select coalesce(sum(case when entry_type in ('payment','deposit') then amount else -amount end), 0)
  into v_paid from public.payments where invoice_id = p_invoice_id;

  if v_paid < 0 then raise exception 'Payment history cannot produce a negative paid balance'; end if;
  if v_paid > v_total then raise exception 'Payment history cannot overpay the invoice'; end if;
  update public.invoices set
    subtotal = v_subtotal,
    tax_amount = v_tax,
    total_amount = v_total,
    paid_amount = v_paid,
    balance_due = v_total - v_paid
  where id = p_invoice_id
  returning * into v_invoice;
  return v_invoice;
end;
$$;

create or replace function public.invoicing_line_change_recalculate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.invoicing_recalculate(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists invoice_lines_recalculate on public.invoice_line_items;
create trigger invoice_lines_recalculate
after insert or update or delete on public.invoice_line_items
for each row execute function public.invoicing_line_change_recalculate();

create or replace function public.invoicing_prevent_payment_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'Payment history is append-only; record a reversal instead';
end;
$$;

drop trigger if exists payments_immutable on public.payments;
create trigger payments_immutable
before update or delete on public.payments
for each row execute function public.invoicing_prevent_payment_mutation();

create or replace function public.invoicing_payment_change_recalculate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices;
begin
  v_invoice := public.invoicing_recalculate(new.invoice_id);
  insert into public.customer_activities(customer_id, activity_type, title, details, invoice_id, payment_id)
  values(
    v_invoice.customer_id,
    case when new.entry_type in ('payment','deposit') then 'payment_recorded' else 'payment_reversed' end,
    case
      when new.entry_type = 'deposit' then 'Deposit recorded for ' || coalesce(v_invoice.invoice_number, 'draft invoice')
      when new.entry_type = 'payment' then 'Payment recorded for ' || coalesce(v_invoice.invoice_number, 'draft invoice')
      when new.entry_type = 'refund' then 'Refund recorded for ' || coalesce(v_invoice.invoice_number, 'invoice')
      else 'Payment reversed for ' || coalesce(v_invoice.invoice_number, 'invoice')
    end,
    new.entry_type || ': $' || to_char(new.amount, 'FM9999999990.00'),
    new.invoice_id,
    new.id
  );
  return new;
end;
$$;

drop trigger if exists payments_recalculate on public.payments;
create trigger payments_recalculate
after insert on public.payments
for each row execute function public.invoicing_payment_change_recalculate();

create or replace function public.invoicing_create_invoice(
  p_customer_id uuid,
  p_quote_id bigint default null,
  p_booking_id bigint default null,
  p_due_date date default null,
  p_discount_amount numeric default 0,
  p_tax_rate numeric default 0,
  p_required_deposit_amount numeric default 0,
  p_customer_notes text default '',
  p_internal_notes text default '',
  p_terms text default '',
  p_line_items jsonb default '[]'::jsonb
)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices;
  v_source_customer uuid;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if not exists(select 1 from public.customers where id = p_customer_id) then raise exception 'Customer not found'; end if;
  if p_discount_amount < 0 or p_tax_rate < 0 or p_tax_rate > 100 or p_required_deposit_amount < 0 then
    raise exception 'Invoice amounts are invalid';
  end if;
  if p_quote_id is not null then
    select customer_id into v_source_customer from public.leads where id = p_quote_id;
    if not found or v_source_customer is distinct from p_customer_id then raise exception 'Quote customer does not match invoice customer'; end if;
  end if;
  if p_booking_id is not null then
    select customer_id into v_source_customer from public.bookings where id = p_booking_id;
    if not found or v_source_customer is distinct from p_customer_id then raise exception 'Booking customer does not match invoice customer'; end if;
  end if;

  insert into public.invoices(
    customer_id, quote_id, booking_id, due_date, discount_amount, tax_rate,
    required_deposit_amount, customer_notes, internal_notes, terms
  ) values(
    p_customer_id, p_quote_id, p_booking_id, p_due_date, coalesce(p_discount_amount,0),
    coalesce(p_tax_rate,0), coalesce(p_required_deposit_amount,0),
    coalesce(p_customer_notes,''), coalesce(p_internal_notes,''), coalesce(p_terms,'')
  ) returning * into v_invoice;

  insert into public.invoice_line_items(invoice_id, position, description, quantity, unit_price, taxable)
  select v_invoice.id, x.position, btrim(x.description), x.quantity, x.unit_price, coalesce(x.taxable,true)
  from jsonb_to_recordset(coalesce(p_line_items, '[]'::jsonb))
    as x(position integer, description text, quantity numeric, unit_price numeric, taxable boolean);

  v_invoice := public.invoicing_recalculate(v_invoice.id);
  if v_invoice.discount_amount > v_invoice.subtotal then raise exception 'Discount cannot exceed invoice subtotal'; end if;
  if v_invoice.required_deposit_amount > v_invoice.total_amount then raise exception 'Required deposit cannot exceed invoice total'; end if;
  insert into public.customer_activities(customer_id, activity_type, title, invoice_id)
  values(p_customer_id, 'invoice_created', 'Draft invoice created', v_invoice.id);
  return v_invoice;
exception when unique_violation then
  raise exception 'An active invoice already exists for this quote or booking' using errcode = '23505';
end;
$$;

create or replace function public.invoicing_update_draft(
  p_invoice_id uuid,
  p_expected_version integer,
  p_due_date date,
  p_discount_amount numeric,
  p_tax_rate numeric,
  p_required_deposit_amount numeric,
  p_customer_notes text,
  p_internal_notes text,
  p_terms text,
  p_line_items jsonb
)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_invoice public.invoices;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.lifecycle_status <> 'draft' then raise exception 'Only draft invoices can be edited'; end if;
  if v_invoice.version <> p_expected_version then raise exception 'Invoice changed in another session; reload before saving' using errcode = '40001'; end if;
  if p_discount_amount < 0 or p_tax_rate < 0 or p_tax_rate > 100 or p_required_deposit_amount < 0 then raise exception 'Invoice amounts are invalid'; end if;

  update public.invoices set due_date=p_due_date, discount_amount=p_discount_amount,
    tax_rate=p_tax_rate, required_deposit_amount=p_required_deposit_amount,
    customer_notes=coalesce(p_customer_notes,''), internal_notes=coalesce(p_internal_notes,''),
    terms=coalesce(p_terms,'') where id=p_invoice_id;
  delete from public.invoice_line_items where invoice_id=p_invoice_id;
  insert into public.invoice_line_items(invoice_id, position, description, quantity, unit_price, taxable)
  select p_invoice_id, x.position, btrim(x.description), x.quantity, x.unit_price, coalesce(x.taxable,true)
  from jsonb_to_recordset(coalesce(p_line_items,'[]'::jsonb))
    as x(position integer, description text, quantity numeric, unit_price numeric, taxable boolean);
  v_invoice := public.invoicing_recalculate(p_invoice_id);
  if v_invoice.discount_amount > v_invoice.subtotal then raise exception 'Discount cannot exceed invoice subtotal'; end if;
  if v_invoice.required_deposit_amount > v_invoice.total_amount then raise exception 'Required deposit cannot exceed invoice total'; end if;
  return v_invoice;
end;
$$;

create or replace function public.invoicing_issue_invoice(
  p_invoice_id uuid,
  p_issue_date date default current_date,
  p_due_date date default null
)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_invoice public.invoices;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.lifecycle_status <> 'draft' then raise exception 'Only draft invoices can be issued'; end if;
  if not exists(select 1 from public.invoice_line_items where invoice_id=p_invoice_id) then raise exception 'Invoice requires at least one line item'; end if;
  v_invoice := public.invoicing_recalculate(p_invoice_id);
  if v_invoice.total_amount <= 0 then raise exception 'Invoice total must be greater than zero'; end if;
  if v_invoice.discount_amount > v_invoice.subtotal then raise exception 'Discount cannot exceed invoice subtotal'; end if;
  if v_invoice.required_deposit_amount > v_invoice.total_amount then raise exception 'Required deposit cannot exceed invoice total'; end if;
  if coalesce(p_due_date,v_invoice.due_date) is null or coalesce(p_due_date,v_invoice.due_date) < p_issue_date then raise exception 'A valid due date is required'; end if;
  update public.invoices set invoice_number=public.invoicing_next_number(p_issue_date),
    lifecycle_status='sent', issue_date=p_issue_date, due_date=coalesce(p_due_date,v_invoice.due_date), sent_at=now()
  where id=p_invoice_id returning * into v_invoice;
  insert into public.customer_activities(customer_id,activity_type,title,invoice_id)
  values(v_invoice.customer_id,'invoice_issued','Invoice '||v_invoice.invoice_number||' issued',v_invoice.id);
  return v_invoice;
end;
$$;

create or replace function public.invoicing_void_invoice(p_invoice_id uuid, p_reason text)
returns public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_invoice public.invoices;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.lifecycle_status='void' then return v_invoice; end if;
  if v_invoice.paid_amount > 0 then raise exception 'Reverse or refund payments before voiding this invoice'; end if;
  if length(btrim(coalesce(p_reason,'')))=0 then raise exception 'Void reason is required'; end if;
  update public.invoices set
    invoice_number=coalesce(invoice_number,public.invoicing_next_number(current_date)),
    issue_date=coalesce(issue_date,current_date), due_date=coalesce(due_date,current_date),
    lifecycle_status='void',voided_at=now(),void_reason=btrim(p_reason)
  where id=p_invoice_id returning * into v_invoice;
  insert into public.customer_activities(customer_id,activity_type,title,details,invoice_id)
  values(v_invoice.customer_id,'invoice_voided','Invoice '||v_invoice.invoice_number||' voided',v_invoice.void_reason,v_invoice.id);
  return v_invoice;
end;
$$;

create or replace function public.invoicing_record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference_number text default '',
  p_entry_type text default 'payment',
  p_notes text default ''
)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_invoice public.invoices; v_payment public.payments;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.lifecycle_status in ('draft','void') then raise exception 'Payments require an issued, active invoice'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_entry_type not in ('payment','deposit','refund') then raise exception 'Invalid payment entry type'; end if;
  if p_payment_method not in ('cash','check','card','ach','square','other') then raise exception 'Invalid payment method'; end if;
  if p_entry_type in ('payment','deposit') and p_amount > v_invoice.balance_due then raise exception 'Payment exceeds invoice balance'; end if;
  if p_entry_type='refund' and p_amount > v_invoice.paid_amount then raise exception 'Refund exceeds paid amount'; end if;
  insert into public.payments(invoice_id,entry_type,amount,payment_date,payment_method,reference_number,notes)
  values(p_invoice_id,p_entry_type,p_amount,coalesce(p_payment_date,current_date),p_payment_method,
    coalesce(p_reference_number,''),coalesce(p_notes,'')) returning * into v_payment;
  return v_payment;
end;
$$;

create or replace function public.invoicing_reverse_payment(p_payment_id uuid, p_reason text)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_original public.payments; v_invoice public.invoices; v_reversal public.payments;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select * into v_original from public.payments where id=p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_original.entry_type not in ('payment','deposit') then raise exception 'Only payments and deposits can be reversed'; end if;
  if exists(select 1 from public.payments where reverses_payment_id=p_payment_id) then raise exception 'Payment has already been reversed'; end if;
  if length(btrim(coalesce(p_reason,'')))=0 then raise exception 'Reversal reason is required'; end if;
  select * into v_invoice from public.invoices where id=v_original.invoice_id for update;
  insert into public.payments(invoice_id,entry_type,amount,payment_date,payment_method,reference_number,notes,reverses_payment_id)
  values(v_original.invoice_id,'reversal',v_original.amount,current_date,v_original.payment_method,
    v_original.reference_number,btrim(p_reason),v_original.id) returning * into v_reversal;
  return v_reversal;
end;
$$;

create or replace function public.invoicing_dashboard(
  p_search text default '', p_status text default '', p_overdue_only boolean default false,
  p_sort text default 'created_desc', p_page integer default 1, p_page_size integer default 20
)
returns table(
  id uuid, invoice_number text, customer_id uuid, customer_name text, company text,
  quote_id bigint, booking_id bigint, issue_date date, due_date date, status text,
  total_amount numeric, paid_amount numeric, balance_due numeric, created_at timestamptz, total_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_search text:=lower(btrim(coalesce(p_search,''))); v_page integer:=greatest(coalesce(p_page,1),1); v_size integer:=least(greatest(coalesce(p_page_size,20),5),100);
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  return query with rows as (
    select i.id,i.invoice_number,i.customer_id,btrim(c.first_name||' '||c.last_name) customer_name,c.company,
      i.quote_id,i.booking_id,i.issue_date,i.due_date,public.invoicing_effective_status(i) status,
      i.total_amount,i.paid_amount,i.balance_due,i.created_at
    from public.invoices i join public.customers c on c.id=i.customer_id
    where (v_search='' or lower(coalesce(i.invoice_number,'')) like '%'||v_search||'%'
      or lower(c.first_name||' '||c.last_name) like '%'||v_search||'%' or lower(c.company) like '%'||v_search||'%'
      or lower(c.email) like '%'||v_search||'%' or i.quote_id::text=v_search or i.booking_id::text=v_search)
      and (coalesce(p_status,'')='' or public.invoicing_effective_status(i)=p_status)
      and (not coalesce(p_overdue_only,false) or public.invoicing_effective_status(i)='overdue')
  ) select r.*,count(*) over() from rows r order by
    case when p_sort='due_asc' then r.due_date end asc nulls last,
    case when p_sort='customer_asc' then lower(r.customer_name) end asc,
    case when p_sort='total_desc' then r.total_amount end desc,
    case when p_sort='balance_desc' then r.balance_due end desc,
    r.created_at desc limit v_size offset (v_page-1)*v_size;
end;
$$;

create or replace function public.invoicing_customer_summary(p_customer_id uuid)
returns table(total_invoiced numeric,total_paid numeric,outstanding_balance numeric,overdue_count bigint,last_payment_date date)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  return query select coalesce(sum(i.total_amount) filter(where i.lifecycle_status<>'void'),0),
    coalesce(sum(i.paid_amount) filter(where i.lifecycle_status<>'void'),0),
    coalesce(sum(i.balance_due) filter(where i.lifecycle_status<>'void'),0),
    count(*) filter(where public.invoicing_effective_status(i)='overdue'),
    (select max(p.payment_date) from public.payments p join public.invoices pi on pi.id=p.invoice_id
      where pi.customer_id=p_customer_id and p.entry_type in ('payment','deposit'))
  from public.invoices i where i.customer_id=p_customer_id;
end;
$$;

create or replace function public.invoicing_summary()
returns table(total_invoiced numeric,total_paid numeric,outstanding_balance numeric,overdue_count bigint,draft_count bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  return query select
    coalesce(sum(i.total_amount) filter(where i.lifecycle_status<>'void'),0),
    coalesce(sum(i.paid_amount) filter(where i.lifecycle_status<>'void'),0),
    coalesce(sum(i.balance_due) filter(where i.lifecycle_status<>'void'),0),
    count(*) filter(where public.invoicing_effective_status(i)='overdue'),
    count(*) filter(where i.lifecycle_status='draft')
  from public.invoices i;
end;
$$;

alter table public.invoice_number_sequences enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Invoice administrators can read invoices" on public.invoices;
create policy "Invoice administrators can read invoices" on public.invoices for select to authenticated using(public.crm_is_admin());
drop policy if exists "Invoice administrators can read line items" on public.invoice_line_items;
create policy "Invoice administrators can read line items" on public.invoice_line_items for select to authenticated using(public.crm_is_admin());
drop policy if exists "Invoice administrators can read payments" on public.payments;
create policy "Invoice administrators can read payments" on public.payments for select to authenticated using(public.crm_is_admin());

revoke all on public.invoice_number_sequences,public.invoices,public.invoice_line_items,public.payments from anon;
revoke all on public.invoice_number_sequences,public.invoices,public.invoice_line_items,public.payments from authenticated;
grant select on public.invoices,public.invoice_line_items,public.payments to authenticated;

revoke all on function public.invoicing_next_number(date) from public,anon;
revoke all on function public.invoicing_recalculate(uuid) from public,anon;
revoke all on function public.invoicing_create_invoice(uuid,bigint,bigint,date,numeric,numeric,numeric,text,text,text,jsonb) from public,anon;
revoke all on function public.invoicing_update_draft(uuid,integer,date,numeric,numeric,numeric,text,text,text,jsonb) from public,anon;
revoke all on function public.invoicing_issue_invoice(uuid,date,date) from public,anon;
revoke all on function public.invoicing_void_invoice(uuid,text) from public,anon;
revoke all on function public.invoicing_record_payment(uuid,numeric,date,text,text,text,text) from public,anon;
revoke all on function public.invoicing_reverse_payment(uuid,text) from public,anon;
revoke all on function public.invoicing_dashboard(text,text,boolean,text,integer,integer) from public,anon;
revoke all on function public.invoicing_customer_summary(uuid) from public,anon;
revoke all on function public.invoicing_summary() from public,anon;

grant execute on function public.invoicing_create_invoice(uuid,bigint,bigint,date,numeric,numeric,numeric,text,text,text,jsonb) to authenticated;
grant execute on function public.invoicing_update_draft(uuid,integer,date,numeric,numeric,numeric,text,text,text,jsonb) to authenticated;
grant execute on function public.invoicing_issue_invoice(uuid,date,date) to authenticated;
grant execute on function public.invoicing_void_invoice(uuid,text) to authenticated;
grant execute on function public.invoicing_record_payment(uuid,numeric,date,text,text,text,text) to authenticated;
grant execute on function public.invoicing_reverse_payment(uuid,text) to authenticated;
grant execute on function public.invoicing_dashboard(text,text,boolean,text,integer,integer) to authenticated;
grant execute on function public.invoicing_customer_summary(uuid) to authenticated;
grant execute on function public.invoicing_summary() to authenticated;

comment on table public.invoices is 'Private production invoices with server-authoritative totals.';
comment on table public.invoice_line_items is 'Invoice charges editable only through administrator RPCs.';
comment on table public.payments is 'Append-only payment, deposit, refund, and reversal history.';

commit;
