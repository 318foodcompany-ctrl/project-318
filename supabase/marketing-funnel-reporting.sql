-- Project 318 administrator marketing funnel reporting.
-- Apply after marketing-attribution.sql. Safe to rerun.
begin;

create or replace function public.marketing_quote_funnel(
  p_start date,
  p_end date,
  p_model text default 'last_non_direct'
)
returns table (
  source text,
  medium text,
  campaign text,
  quote_count bigint,
  contacted_count bigint,
  proposal_count bigint,
  booked_count bigint,
  closed_count bigint,
  cancelled_count bigint,
  quoted_budget numeric,
  booked_budget numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.crm_is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Invalid reporting date range';
  end if;
  if p_model not in ('first', 'last_non_direct') then
    raise exception 'Unsupported attribution model';
  end if;

  return query
  select
    coalesce(t.source, 'unattributed') as source,
    coalesce(t.medium, '(none)') as medium,
    coalesce(t.campaign, '') as campaign,
    count(*) as quote_count,
    count(*) filter (where l.status = 'Contacted') as contacted_count,
    count(*) filter (where l.status in ('Proposal Sent', 'Quote Sent')) as proposal_count,
    count(*) filter (where l.status = 'Booked') as booked_count,
    count(*) filter (where l.status in ('Closed', 'Lost')) as closed_count,
    count(*) filter (where l.status = 'Cancelled') as cancelled_count,
    coalesce(sum(coalesce(l.budget, 0)), 0) as quoted_budget,
    coalesce(sum(coalesce(l.budget, 0)) filter (where l.status = 'Booked'), 0) as booked_budget
  from public.leads l
  left join public.marketing_touchpoints t on t.id = case
    when p_model = 'first' then l.marketing_first_touchpoint_id
    else l.marketing_last_touchpoint_id
  end
  where l.created_at >= p_start::timestamptz
    and l.created_at < (p_end + 1)::timestamptz
  group by coalesce(t.source, 'unattributed'), coalesce(t.medium, '(none)'), coalesce(t.campaign, '')
  order by quote_count desc, booked_count desc, source asc;
end;
$$;

revoke all on function public.marketing_quote_funnel(date,date,text) from public, anon;
grant execute on function public.marketing_quote_funnel(date,date,text) to authenticated;

comment on function public.marketing_quote_funnel(date,date,text) is
  'Administrator-only quote funnel grouped by first-touch or last-non-direct marketing source.';

commit;
