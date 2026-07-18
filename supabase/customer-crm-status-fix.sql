-- Production patch: permit authenticated CRM administrators to update quote status.
-- Safe to apply after customer-crm.sql and safe to rerun.
begin;

alter table public.leads enable row level security;

drop policy if exists "CRM administrators can update quote status" on public.leads;
create policy "CRM administrators can update quote status"
on public.leads
for update
to authenticated
using (public.crm_is_admin())
with check (public.crm_is_admin());

revoke update on public.leads from anon;
grant update (status) on public.leads to authenticated;

commit;
