begin;

do $$
begin
  if to_regprocedure('public.crm_is_admin()') is null then
    raise exception 'Required function public.crm_is_admin() is missing; apply customer-crm.sql first.';
  end if;
end
$$;

alter table public.leads enable row level security;
alter table public.website_content enable row level security;
alter table public.menu_items enable row level security;

drop policy if exists "Anyone can insert leads" on public.leads;
drop policy if exists "Authenticated users can view leads" on public.leads;
drop policy if exists "CRM administrators can read leads" on public.leads;
drop policy if exists "CRM administrators can create leads" on public.leads;
drop policy if exists "CRM administrators can delete leads" on public.leads;

create policy "CRM administrators can read leads"
on public.leads for select to authenticated
using (public.crm_is_admin());

create policy "CRM administrators can create leads"
on public.leads for insert to authenticated
with check (public.crm_is_admin());

create policy "CRM administrators can delete leads"
on public.leads for delete to authenticated
using (public.crm_is_admin());

revoke all on public.leads from anon, authenticated;
grant select, insert, update, delete on public.leads to authenticated;

drop policy if exists "Authenticated users can add website content" on public.website_content;
drop policy if exists "Authenticated users can update website content" on public.website_content;
drop policy if exists "Authenticated users can delete website content" on public.website_content;
drop policy if exists "Website administrators can manage website content" on public.website_content;

create policy "Website administrators can manage website content"
on public.website_content for all to authenticated
using (public.crm_is_admin())
with check (public.crm_is_admin());

revoke insert, update, delete, truncate, references, trigger
on public.website_content from anon, authenticated;
grant select on public.website_content to anon, authenticated;
grant insert, update, delete on public.website_content to authenticated;

drop policy if exists "Authenticated users can manage menu items" on public.menu_items;
drop policy if exists "Website administrators can manage menu items" on public.menu_items;

create policy "Website administrators can manage menu items"
on public.menu_items for all to authenticated
using (public.crm_is_admin())
with check (public.crm_is_admin());

revoke insert, update, delete, truncate, references, trigger
on public.menu_items from anon, authenticated;
grant select on public.menu_items to anon, authenticated;
grant insert, update, delete on public.menu_items to authenticated;

commit;
