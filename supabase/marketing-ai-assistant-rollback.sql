-- Removes only the marketing assistant layer. Refuses to destroy audit history.
begin;
do $$
begin
  if to_regclass('public.marketing_ai_audit') is not null
     and exists (select 1 from public.marketing_ai_audit limit 1) then
    raise exception 'marketing_ai_audit contains records; preserve or export them before rollback';
  end if;
end $$;
drop function if exists public.marketing_ai_review(uuid,text);
drop table if exists public.marketing_ai_audit;
commit;
