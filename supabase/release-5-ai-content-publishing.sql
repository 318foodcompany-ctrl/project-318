-- Project 318 Release 5: explicit administrator publishing for approved AI content.
-- Publishing remains a separate admin action after approval. No scheduler can publish.
begin;

do $$
begin
  if to_regclass('public.marketing_ai_tasks') is null
     or to_regclass('public.marketing_ai_content') is null
     or to_regclass('public.faq_items') is null then
    raise exception 'Release 2 FAQ and Release 5 AI Autopilot are required';
  end if;
end $$;

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  source_ai_content_id uuid unique references public.marketing_ai_content(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 1 and 300),
  excerpt text not null default '' check (length(excerpt) <= 1000),
  body text not null check (length(btrim(body)) between 1 and 50000),
  seo_title text not null default '' check (length(seo_title) <= 70),
  seo_description text not null default '' check (length(seo_description) <= 170),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blog_posts_public_idx on public.blog_posts(status,published_at desc);

create or replace function public.blog_posts_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists blog_posts_touch on public.blog_posts;
create trigger blog_posts_touch before update on public.blog_posts
for each row execute function public.blog_posts_touch_updated_at();

alter table public.blog_posts enable row level security;
drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts" on public.blog_posts
for select to anon,authenticated using (status='published' or public.crm_is_admin());
drop policy if exists "Administrators manage blog posts" on public.blog_posts;
create policy "Administrators manage blog posts" on public.blog_posts
for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
revoke all on public.blog_posts from public,anon,authenticated;
grant select on public.blog_posts to anon,authenticated;
grant insert,update,delete on public.blog_posts to authenticated;
grant all on public.blog_posts to service_role;

alter table public.marketing_ai_approval_audit
  drop constraint if exists marketing_ai_approval_audit_action_check;
alter table public.marketing_ai_approval_audit
  add constraint marketing_ai_approval_audit_action_check check (action in (
    'scheduled','generated','edited','approved','rejected','regenerated','archived','failed','published'
  ));

comment on table public.blog_posts is 'Administrator-approved public blog content, optionally originating from AI drafts.';
commit;