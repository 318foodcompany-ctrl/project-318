-- Project 318 administrator-only marketing assistant audit trail.
-- Forward-only, idempotent, and safe to apply after customer-crm.sql.
begin;

do $$
begin
  if to_regprocedure('public.crm_is_admin()') is null then
    raise exception 'Required function public.crm_is_admin() is missing';
  end if;
end $$;

create table if not exists public.marketing_ai_audit (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  analysis_type text not null,
  request_context jsonb not null default '{}'::jsonb,
  structured_output jsonb not null,
  provider text not null,
  model text not null,
  review_status text not null default 'draft',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  constraint marketing_ai_analysis_type_check check (analysis_type in ('seo','performance','next_actions')),
  constraint marketing_ai_review_status_check check (review_status in ('draft','approved','rejected')),
  constraint marketing_ai_context_object_check check (jsonb_typeof(request_context) = 'object'),
  constraint marketing_ai_output_object_check check (jsonb_typeof(structured_output) = 'object'),
  constraint marketing_ai_provider_length check (length(provider) between 1 and 120),
  constraint marketing_ai_model_length check (length(model) between 1 and 120)
);

create index if not exists marketing_ai_audit_created_idx on public.marketing_ai_audit(created_at desc);
create index if not exists marketing_ai_audit_status_idx on public.marketing_ai_audit(review_status, created_at desc);

alter table public.marketing_ai_audit enable row level security;
drop policy if exists "Marketing AI administrators can read audit records" on public.marketing_ai_audit;
create policy "Marketing AI administrators can read audit records" on public.marketing_ai_audit
  for select to authenticated using (public.crm_is_admin());
drop policy if exists "Marketing AI administrators can create audit records" on public.marketing_ai_audit;
create policy "Marketing AI administrators can create audit records" on public.marketing_ai_audit
  for insert to authenticated with check (public.crm_is_admin() and created_by = auth.uid() and review_status = 'draft');

revoke all on public.marketing_ai_audit from public, anon, authenticated;
grant select, insert on public.marketing_ai_audit to authenticated;

create or replace function public.marketing_ai_review(p_audit_id uuid, p_status text)
returns public.marketing_ai_audit
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.marketing_ai_audit;
begin
  if not public.crm_is_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Unsupported review status'; end if;
  update public.marketing_ai_audit
     set review_status = p_status, reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_audit_id and review_status = 'draft'
   returning * into v_record;
  if v_record.id is null then raise exception 'Draft recommendation was not found or was already reviewed'; end if;
  return v_record;
end;
$$;

revoke all on function public.marketing_ai_review(uuid,text) from public, anon;
grant execute on function public.marketing_ai_review(uuid,text) to authenticated;

commit;
