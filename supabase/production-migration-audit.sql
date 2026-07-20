-- Project 318 read-only production migration audit.
-- Run in the production Supabase SQL editor. This script does not modify data.
-- Every row should report PASS before launch.

with required_objects(object_type, object_name, is_present) as (
  values
    ('table', 'public.customers', to_regclass('public.customers') is not null),
    ('table', 'public.customer_activities', to_regclass('public.customer_activities') is not null),
    ('table', 'public.leads', to_regclass('public.leads') is not null),
    ('table', 'public.bookings', to_regclass('public.bookings') is not null),
    ('table', 'public.invoices', to_regclass('public.invoices') is not null),
    ('table', 'public.invoice_line_items', to_regclass('public.invoice_line_items') is not null),
    ('table', 'public.payments', to_regclass('public.payments') is not null),
    ('table', 'public.invoice_number_sequences', to_regclass('public.invoice_number_sequences') is not null),
    ('table', 'public.marketing_visitors', to_regclass('public.marketing_visitors') is not null),
    ('table', 'public.marketing_sessions', to_regclass('public.marketing_sessions') is not null),
    ('table', 'public.marketing_touchpoints', to_regclass('public.marketing_touchpoints') is not null),
    ('function', 'public.submit_quote_with_customer', to_regprocedure('public.submit_quote_with_customer(text,text,text,text,date,integer,text,text,numeric,text)') is not null),
    ('function', 'public.submit_quote_with_attribution', to_regprocedure('public.submit_quote_with_attribution(text,text,text,text,date,integer,text,text,numeric,text,jsonb)') is not null),
    ('function', 'public.marketing_quote_attribution', exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='marketing_quote_attribution')),
    ('function', 'public.invoicing_dashboard', exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='invoicing_dashboard')),
    ('function', 'public.invoicing_summary', exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='invoicing_summary')),
    ('function', 'public.invoicing_create_invoice', exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='invoicing_create_invoice'))
),
required_columns(table_name, column_name, is_present) as (
  values
    ('public.leads', 'customer_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='customer_id')),
    ('public.leads', 'internal_notes', exists(select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='internal_notes')),
    ('public.leads', 'marketing_session_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='marketing_session_id')),
    ('public.leads', 'marketing_first_touchpoint_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='marketing_first_touchpoint_id')),
    ('public.leads', 'marketing_last_touchpoint_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='marketing_last_touchpoint_id')),
    ('public.bookings', 'customer_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='customer_id')),
    ('public.bookings', 'quote_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='quote_id')),
    ('public.customer_activities', 'invoice_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='customer_activities' and column_name='invoice_id')),
    ('public.customer_activities', 'payment_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='customer_activities' and column_name='payment_id'))
)
select
  object_type as check_type,
  object_name as check_name,
  case when is_present then 'PASS' else 'FAIL' end as status
from required_objects
union all
select
  'column',
  table_name || '.' || column_name,
  case when is_present then 'PASS' else 'FAIL' end
from required_columns
order by status desc, check_type, check_name;

-- One-line launch gate. Expected result: READY.
with failures as (
  select 1
  from (
    select to_regclass('public.customers') is not null ok
    union all select to_regclass('public.leads') is not null
    union all select to_regclass('public.bookings') is not null
    union all select to_regclass('public.invoices') is not null
    union all select to_regclass('public.payments') is not null
    union all select to_regclass('public.marketing_touchpoints') is not null
    union all select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='submit_quote_with_attribution')
    union all select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='invoicing_dashboard')
    union all select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='invoicing_create_invoice')
  ) checks
  where not ok
)
select case when exists(select 1 from failures) then 'NOT READY' else 'READY' end as production_migration_status;
