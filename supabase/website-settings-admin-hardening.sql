-- Restrict Website Settings writes to Project 318 administrators.
-- Run after customer-crm.sql because this policy uses public.crm_is_admin().
begin;

alter table public.website_settings enable row level security;

drop policy if exists "Authenticated users can manage website settings"
on public.website_settings;
drop policy if exists "Website settings administrators can manage"
on public.website_settings;

create policy "Website settings administrators can manage"
on public.website_settings
for all
to authenticated
using (public.crm_is_admin())
with check (public.crm_is_admin());

revoke insert, update, delete, truncate, references, trigger
on public.website_settings from anon, authenticated;
grant select on public.website_settings to anon, authenticated;
grant insert, update, delete on public.website_settings to authenticated;

comment on policy "Website settings administrators can manage"
on public.website_settings is
  'Only JWTs with app_metadata.role = admin may change global website settings.';

commit;
