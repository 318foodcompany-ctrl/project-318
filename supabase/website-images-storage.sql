begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-images',
  'website-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can read website images" on storage.objects;
create policy "public can read website images"
on storage.objects for select
using (bucket_id = 'website-images');

drop policy if exists "administrators can upload website images" on storage.objects;
create policy "administrators can upload website images"
on storage.objects for insert to authenticated
with check (bucket_id = 'website-images' and public.crm_is_admin());

drop policy if exists "administrators can update website images" on storage.objects;
create policy "administrators can update website images"
on storage.objects for update to authenticated
using (bucket_id = 'website-images' and public.crm_is_admin())
with check (bucket_id = 'website-images' and public.crm_is_admin());

drop policy if exists "administrators can delete website images" on storage.objects;
create policy "administrators can delete website images"
on storage.objects for delete to authenticated
using (bucket_id = 'website-images' and public.crm_is_admin());

commit;
