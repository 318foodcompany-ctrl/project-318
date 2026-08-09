-- Guarded rollback for Project 318 Release 5 AI Marketing Autopilot.
-- Refuses destructive rollback once AI work, approvals, or published blog content exist.
begin;

do $$
declare n bigint:=0;
begin
  if to_regclass('public.marketing_ai_tasks') is not null then execute 'select count(*) from public.marketing_ai_tasks' into n; end if;
  if n>0 then raise exception 'Rollback refused: Release 5 AI tasks exist'; end if;
  if to_regclass('public.marketing_ai_approval_audit') is not null then execute 'select count(*) from public.marketing_ai_approval_audit' into n; end if;
  if n>0 then raise exception 'Rollback refused: Release 5 approval/audit history exists'; end if;
  if to_regclass('public.blog_posts') is not null then execute 'select count(*) from public.blog_posts' into n; end if;
  if n>0 then raise exception 'Rollback refused: published or draft blog content exists'; end if;
end $$;

drop function if exists public.marketing_ai_next_run(text,integer,integer,integer,integer,text,timestamptz);
drop function if exists public.marketing_ai_queue_due_automation();
drop function if exists public.marketing_ai_claim_due_task(integer);
drop trigger if exists blog_posts_touch on public.blog_posts;
drop function if exists public.blog_posts_touch_updated_at();
drop table if exists public.blog_posts;
drop table if exists public.marketing_ai_approval_audit;
drop table if exists public.marketing_ai_tasks;
drop table if exists public.marketing_ai_automation_settings;
drop table if exists public.marketing_ai_brand_brain;
drop function if exists public.marketing_ai_autopilot_touch_updated_at();

commit;