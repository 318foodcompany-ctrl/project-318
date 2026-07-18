-- Emergency rollback for the attribution foundation. This deliberately refuses
-- to destroy captured attribution data. Archive/export data before manual removal.
begin;

revoke execute on function public.marketing_revenue_attribution(date,date,text) from authenticated;
revoke execute on function public.marketing_quote_attribution(bigint) from authenticated;
revoke execute on function public.submit_quote_with_attribution(text,text,text,text,date,integer,text,text,numeric,text,jsonb) from anon, authenticated;

drop function if exists public.marketing_revenue_attribution(date,date,text);
drop function if exists public.marketing_quote_attribution(bigint);
drop function if exists public.submit_quote_with_attribution(text,text,text,text,date,integer,text,text,numeric,text,jsonb);

-- Tables, lead links, captured data, and internal helpers remain intentionally.
-- Removing accounting attribution requires an explicit reviewed data-retention migration.

commit;
