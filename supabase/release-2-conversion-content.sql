-- Project 318 Release 2: conversion content, gallery, FAQ, and event types.
-- Apply after release-1-lead-automation.sql. Additive and safe to rerun.
begin;

create extension if not exists pgcrypto;

create table if not exists public.conversion_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null,
  title text not null,
  body text not null default '',
  category text not null default '',
  media_url text not null default '',
  alt_text text not null default '',
  link_url text not null default '',
  value_text text not null default '',
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversion_items_type_check check (item_type in ('testimonial','review','client_logo','statistic','trust_badge','response_promise')),
  constraint conversion_items_status_check check (status in ('draft','published')),
  constraint conversion_items_title_length check (length(btrim(title)) between 1 and 300),
  constraint conversion_items_body_length check (length(body) <= 5000),
  constraint conversion_items_alt_length check (length(alt_text) <= 500)
);

create index if not exists conversion_items_public_order_idx
  on public.conversion_items(item_type, status, sort_order, created_at);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  image_url text not null,
  alt_text text not null,
  caption text not null default '',
  featured boolean not null default false,
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gallery_items_category_length check (length(btrim(category)) between 1 and 100),
  constraint gallery_items_status_check check (status in ('draft','published')),
  constraint gallery_items_image_length check (length(btrim(image_url)) between 1 and 2000),
  constraint gallery_items_alt_length check (length(btrim(alt_text)) between 1 and 500),
  constraint gallery_items_caption_length check (length(caption) <= 2000)
);

create index if not exists gallery_items_public_order_idx
  on public.gallery_items(status, featured desc, sort_order, created_at);

create table if not exists public.gallery_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gallery_categories_name_length check (length(btrim(name)) between 1 and 100),
  constraint gallery_categories_status_check check (status in ('draft','published'))
);

create index if not exists gallery_categories_public_order_idx
  on public.gallery_categories(status, sort_order, created_at);

create table if not exists public.faq_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'General',
  question text not null,
  answer text not null,
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint faq_items_status_check check (status in ('draft','published')),
  constraint faq_items_category_length check (length(btrim(category)) between 1 and 100),
  constraint faq_items_question_length check (length(btrim(question)) between 1 and 500),
  constraint faq_items_answer_length check (length(btrim(answer)) between 1 and 10000)
);

create index if not exists faq_items_public_order_idx
  on public.faq_items(status, category, sort_order, created_at);

create table if not exists public.event_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  hero_image_url text not null default '',
  hero_alt_text text not null default '',
  cta_text text not null default 'Request Catering Quote',
  cta_url text not null default 'quote-builder.html',
  seo_title text not null,
  seo_description text not null,
  status text not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_types_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint event_types_status_check check (status in ('draft','published')),
  constraint event_types_title_length check (length(btrim(title)) between 1 and 200),
  constraint event_types_description_length check (length(btrim(description)) between 1 and 10000),
  constraint event_types_seo_title_length check (length(btrim(seo_title)) between 1 and 70),
  constraint event_types_seo_description_length check (length(btrim(seo_description)) between 1 and 170)
);

create index if not exists event_types_public_order_idx
  on public.event_types(status, sort_order, created_at);

alter table public.conversion_items enable row level security;
alter table public.gallery_items enable row level security;
alter table public.gallery_categories enable row level security;
alter table public.faq_items enable row level security;
alter table public.event_types enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['conversion_items','gallery_items','gallery_categories','faq_items','event_types']
  loop
    execute format('drop policy if exists %I on public.%I', 'Public can read published ' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (status = ''published'' or public.crm_is_admin())',
      'Public can read published ' || table_name, table_name
    );
    execute format('drop policy if exists %I on public.%I', 'Administrators manage ' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin())',
      'Administrators manage ' || table_name, table_name
    );
  end loop;
end;
$$;

create or replace function public.release2_set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['conversion_items','gallery_items','gallery_categories','faq_items','event_types']
  loop
    execute format('drop trigger if exists release2_set_updated_at on public.%I', table_name);
    execute format(
      'create trigger release2_set_updated_at before update on public.%I for each row execute function public.release2_set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

revoke all on public.conversion_items, public.gallery_items, public.gallery_categories, public.faq_items, public.event_types
  from public, anon, authenticated;
grant select on public.conversion_items, public.gallery_items, public.gallery_categories, public.faq_items, public.event_types
  to anon, authenticated;
grant insert, update, delete on public.conversion_items, public.gallery_items, public.gallery_categories, public.faq_items, public.event_types
  to authenticated;
grant all on public.conversion_items, public.gallery_items, public.gallery_categories, public.faq_items, public.event_types
  to service_role;

comment on table public.conversion_items is 'Draft and published homepage trust content managed by administrators.';
comment on table public.gallery_items is 'Unlimited categorized gallery content with publication and display ordering.';
comment on table public.gallery_categories is 'Administrator-managed gallery filters and public display ordering.';
comment on table public.faq_items is 'Searchable public FAQ content with administrator-controlled publication.';
comment on table public.event_types is 'Event-type marketing content and per-item SEO metadata.';

commit;
