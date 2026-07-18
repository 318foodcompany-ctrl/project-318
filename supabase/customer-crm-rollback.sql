-- Project 318 CRM rollback
-- WARNING: This removes CRM-only customer and activity data. It preserves all
-- existing quote and booking rows and their original customer text fields.

begin;

drop trigger if exists crm_quote_activity on public.leads;
drop trigger if exists crm_booking_activity on public.bookings;
drop trigger if exists crm_customer_activity on public.customers;
drop trigger if exists crm_protect_lead_customer_link on public.leads;
drop trigger if exists crm_protect_booking_customer_link on public.bookings;

alter table public.leads drop constraint if exists leads_customer_id_fkey;
alter table public.bookings drop constraint if exists bookings_customer_id_fkey;
alter table public.leads drop column if exists customer_id;
alter table public.bookings drop column if exists customer_id;

drop function if exists public.submit_quote_with_customer(text,text,text,text,date,integer,text,text,numeric,text);
drop function if exists public.crm_customer_dashboard(text,boolean,text,integer,integer);
drop function if exists public.crm_customer_matches(text,integer);
drop function if exists public.crm_find_or_create_customer(text,text,text,text,text,text,text);
drop function if exists public.crm_find_or_create_customer_internal(text,text,text,text,text,text,text);
drop function if exists public.crm_record_quote_activity();
drop function if exists public.crm_record_booking_activity();
drop function if exists public.crm_record_customer_activity();
drop function if exists public.crm_set_updated_at();
drop function if exists public.crm_enforce_admin_customer_link();

drop table if exists public.customer_activities;
drop table if exists public.customers;
drop function if exists public.crm_is_admin();

commit;
