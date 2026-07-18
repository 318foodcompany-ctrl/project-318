-- Run only in a disposable Supabase database after invoicing-payments.sql.
begin;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}';

do $$
begin
  if has_table_privilege('anon','public.invoices','select') then raise exception 'anon can read invoices'; end if;
  if has_table_privilege('anon','public.payments','insert') then raise exception 'anon can insert payments'; end if;
  if has_table_privilege('authenticated','public.payments','update') then raise exception 'authenticated can mutate payment history directly'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='invoices' and cmd='SELECT' and qual='crm_is_admin()') then raise exception 'invoice admin read policy missing'; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename in ('invoices','invoice_line_items','payments') and (qual='true' or with_check='true')) then raise exception 'unconditional accounting policy found'; end if;
end;
$$;

rollback;
