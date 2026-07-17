create table if not exists public.website_settings (
  setting_key text primary key,
  setting_value text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.website_settings enable row level security;

drop policy if exists "Public can read website settings" on public.website_settings;
create policy "Public can read website settings"
on public.website_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can manage website settings" on public.website_settings;
create policy "Authenticated users can manage website settings"
on public.website_settings
for all
to authenticated
using (true)
with check (true);

insert into public.website_settings (setting_key, setting_value)
values
  ('business_name', '318 Food Co.'),
  ('phone', '(318) 572-0137'),
  ('email', '318FoodCompany@gmail.com'),
  ('address', 'Northwest Louisiana'),
  ('hours', 'By appointment'),
  ('facebook_url', ''),
  ('instagram_url', '')
on conflict (setting_key) do nothing;
