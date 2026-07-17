-- Run this once in Supabase Dashboard > SQL Editor before using private quote notes.
-- It is safe to run more than once.

begin;

alter table public.leads
  add column if not exists internal_notes text not null default '';

-- One-time cleanup for notes saved by the earlier marker-based implementation.
-- The customer-submitted portion remains in notes; the private portion moves to internal_notes.
update public.leads
set
  internal_notes = btrim(split_part(notes, '--- INTERNAL NOTES ---', 2)),
  notes = regexp_replace(split_part(notes, '--- INTERNAL NOTES ---', 1), E'\n\n$', '')
where position('--- INTERNAL NOTES ---' in coalesce(notes, '')) > 0
  and internal_notes = '';

comment on column public.leads.internal_notes is
  'Private notes maintained by authenticated 318 Food Co. administrators.';

-- The existing leads Row Level Security policies remain unchanged.
-- The public quote form only inserts customer-facing fields and never reads or writes internal_notes.

commit;
