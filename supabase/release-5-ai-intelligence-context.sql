-- Project 318 Release 5: privacy-preserving aggregate context for AI marketing analysis.
-- No customer names, emails, phone numbers, addresses, notes, or private CRM text are returned.
begin;

create or replace function public.marketing_ai_business_snapshot(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  days integer:=least(greatest(coalesce(p_days,30),1),365);
  cutoff timestamptz:=now()-make_interval(days=>least(greatest(coalesce(p_days,30),1),365));
  result jsonb;
begin
  if current_user not in ('postgres','service_role') and not public.crm_is_admin() then
    raise exception 'Administrator or service role required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'period_days',days,
    'generated_at',now(),
    'leads',jsonb_build_object(
      'total',coalesce((select count(*) from public.leads where created_at>=cutoff),0),
      'status_counts',coalesce((select jsonb_object_agg(status,cnt) from (select coalesce(nullif(btrim(status),''),'Unknown') status,count(*) cnt from public.leads where created_at>=cutoff group by 1) s),'{}'::jsonb),
      'event_type_counts',coalesce((select jsonb_object_agg(event_type,cnt) from (select coalesce(nullif(btrim(event_type),''),'Unknown') event_type,count(*) cnt from public.leads where created_at>=cutoff group by 1 order by cnt desc limit 12) s),'{}'::jsonb)
    ),
    'bookings',jsonb_build_object(
      'total',coalesce((select count(*) from public.bookings where created_at>=cutoff),0),
      'confirmed',coalesce((select count(*) from public.bookings where created_at>=cutoff and status='Confirmed'),0),
      'completed',coalesce((select count(*) from public.bookings where created_at>=cutoff and status='Completed'),0),
      'cancelled',coalesce((select count(*) from public.bookings where created_at>=cutoff and status='Cancelled'),0),
      'quoted_value',coalesce((select round(sum(coalesce(quote_amount,0)),2) from public.bookings where created_at>=cutoff and status<>'Cancelled'),0)
    ),
    'invoices',jsonb_build_object(
      'created',coalesce((select count(*) from public.invoices where created_at>=cutoff),0),
      'total_value',coalesce((select round(sum(total_amount),2) from public.invoices where created_at>=cutoff and lifecycle_status<>'void'),0),
      'paid_value',coalesce((select round(sum(paid_amount),2) from public.invoices where created_at>=cutoff and lifecycle_status<>'void'),0),
      'outstanding_value',coalesce((select round(sum(balance_due),2) from public.invoices where created_at>=cutoff and lifecycle_status='sent'),0)
    ),
    'payments',jsonb_build_object(
      'net_recorded',coalesce((select round(sum(case when entry_type in ('payment','deposit') then amount else -amount end),2) from public.payments where payment_date>=current_date-days),0)
    ),
    'content_inventory',jsonb_build_object(
      'published_blog_count',coalesce((select count(*) from public.blog_posts where status='published'),0),
      'published_blog_titles',coalesce((select jsonb_agg(title order by published_at desc nulls last) from (select title,published_at from public.blog_posts where status='published' order by published_at desc nulls last limit 30) b),'[]'::jsonb),
      'published_faq_count',coalesce((select count(*) from public.faq_items where status='published'),0),
      'published_faq_questions',coalesce((select jsonb_agg(question order by category,sort_order) from (select question,category,sort_order from public.faq_items where status='published' order by category,sort_order limit 40) f),'[]'::jsonb),
      'published_event_types',coalesce((select jsonb_agg(jsonb_build_object('slug',slug,'title',title) order by sort_order) from public.event_types where status='published'),'[]'::jsonb),
      'website_pages',coalesce((select jsonb_agg(distinct page) from public.website_content),'[]'::jsonb)
    )
  ) into result;
  return result;
end $$;

revoke all on function public.marketing_ai_business_snapshot(integer) from public,anon,authenticated;
grant execute on function public.marketing_ai_business_snapshot(integer) to service_role;

comment on function public.marketing_ai_business_snapshot(integer) is
  'Aggregate-only AI marketing context. Deliberately excludes customer identity, contact data, notes, and private CRM text.';

commit;