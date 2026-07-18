-- Roll back only the quote-status administrator policy added by
-- customer-crm-status-fix.sql. CRM tables and records are preserved.
begin;

drop policy if exists "CRM administrators can update quote status" on public.leads;

commit;
