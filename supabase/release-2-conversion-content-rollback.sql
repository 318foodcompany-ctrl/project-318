-- Non-destructive Release 2 rollback.
-- Disable public/admin access without deleting conversion content or media.
begin;

revoke all on public.conversion_items, public.gallery_items, public.gallery_categories, public.faq_items, public.event_types
  from anon, authenticated;

drop policy if exists "Public can read published conversion_items" on public.conversion_items;
drop policy if exists "Administrators manage conversion_items" on public.conversion_items;
drop policy if exists "Public can read published gallery_items" on public.gallery_items;
drop policy if exists "Administrators manage gallery_items" on public.gallery_items;
drop policy if exists "Public can read published gallery_categories" on public.gallery_categories;
drop policy if exists "Administrators manage gallery_categories" on public.gallery_categories;
drop policy if exists "Public can read published faq_items" on public.faq_items;
drop policy if exists "Administrators manage faq_items" on public.faq_items;
drop policy if exists "Public can read published event_types" on public.event_types;
drop policy if exists "Administrators manage event_types" on public.event_types;

comment on table public.conversion_items is 'Release 2 access disabled; content retained for safe recovery.';
comment on table public.gallery_items is 'Release 2 access disabled; content retained for safe recovery.';
comment on table public.gallery_categories is 'Release 2 access disabled; content retained for safe recovery.';
comment on table public.faq_items is 'Release 2 access disabled; content retained for safe recovery.';
comment on table public.event_types is 'Release 2 access disabled; content retained for safe recovery.';

commit;
