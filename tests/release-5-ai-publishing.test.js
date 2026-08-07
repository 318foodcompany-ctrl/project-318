"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const publish=require("../api/admin-marketing-autopilot-publish.js");
const blogIndex=require("../api/blog-index.js");
const blogPost=require("../api/blog-post.js");

test("AI publishing remains a second explicit administrator action",()=>{
  const source=read("api/admin-marketing-autopilot-publish.js");
  assert.match(source,/crm_is_admin/);
  assert.match(source,/task\.status!==\"approved\"/);
  assert.match(source,/action=eq\.published/);
  assert.doesNotMatch(read("api/marketing-autopilot-run.js"),/admin-marketing-autopilot-publish|blog_posts|faq_items/);
});

test("approved publishing is limited to blog and FAQ connectors",()=>{
  const source=read("api/admin-marketing-autopilot-publish.js");
  assert.match(source,/task\.content_type===\"blog_draft\"/);
  assert.match(source,/task\.content_type===\"faq_draft\"/);
  assert.match(source,/does not have an automatic publishing connector yet/i);
  assert.doesNotMatch(source,/facebook\.com|instagram\.com|googleapis\.com|sendTransactionalEmail|ad_spend/i);
});

test("publishing is idempotent and blog source IDs are unique",()=>{
  const source=read("api/admin-marketing-autopilot-publish.js"),sql=read("supabase/release-5-ai-content-publishing.sql");
  assert.match(source,/already_published:true/);
  assert.match(source,/marketing_ai_approval_audit\?task_id=eq/);
  assert.match(sql,/source_ai_content_id uuid unique/);
});

test("blog storage exposes only published posts publicly",()=>{
  const sql=read("supabase/release-5-ai-content-publishing.sql");
  assert.match(sql,/alter table public\.blog_posts enable row level security/);
  assert.match(sql,/status='published' or public\.crm_is_admin\(\)/);
  assert.match(sql,/grant select on public\.blog_posts to anon,authenticated/);
  assert.doesNotMatch(sql,/grant (?:insert|update|delete|all)[^;]*to anon/i);
});

test("blog routes are server-rendered with canonical metadata and schema",()=>{
  const index=read("api/blog-index.js"),post=read("api/blog-post.js"),vercel=read("vercel.json");
  assert.match(index,/Catering Resources/);assert.match(index,/status=eq\.published/);
  assert.match(post,/BlogPosting/);assert.match(post,/rel=\"canonical\"/);assert.match(post,/status=eq\.published/);
  assert.match(vercel,/\"source\": \"\/blog\"/);assert.match(vercel,/\"source\": \"\/blog\/:slug\"/);
});

test("dynamic sitemap includes static pages and approved blog posts",()=>{
  const sitemap=read("api/sitemap.js"),vercel=read("vercel.json");
  assert.match(sitemap,/blog_posts\?status=eq\.published/);
  assert.match(sitemap,/\/quote-builder\.html/);assert.match(sitemap,/\/faq\.html/);
  assert.match(vercel,/\"source\": \"\/sitemap\.xml\"/);
});

test("slug normalization removes markup and unsafe path characters",()=>{
  assert.equal(publish.slugify("  Corporate Lunches: Shreveport & Bossier!  "),"corporate-lunches-shreveport-bossier");
  assert.match(publish.slugify("***"),/^post-\d+$/);
});

test("SSR templates escape untrusted content",()=>{
  const indexHtml=blogIndex.page([{slug:"safe",title:"<script>x</script>",excerpt:"A&B",published_at:"2026-08-07T00:00:00Z"}]);
  assert.doesNotMatch(indexHtml,/<script>x<\/script>/);assert.match(indexHtml,/&lt;script&gt;/);assert.match(indexHtml,/A&amp;B/);
  const postHtml=blogPost.page({slug:"safe",title:"<img src=x>",excerpt:"hello",body:"<script>x</script>",seo_title:"Title",seo_description:"Description",published_at:"2026-08-07T00:00:00Z"});
  assert.doesNotMatch(postHtml,/<img src=x>/);assert.doesNotMatch(postHtml,/<script>x<\/script>/);
});

test("schedule preferences use timezone-aware next-run calculation",()=>{
  const sql=read("supabase/release-5-ai-autopilot-scheduling.sql"),ui=read("js/admin-ai-autopilot.js");
  for(const field of ["timezone_name","day_of_week","day_of_month","preferred_hour","custom_interval"])assert.match(sql,new RegExp(field));
  assert.match(sql,/America\/Chicago/);assert.match(sql,/at time zone zone/);
  assert.match(ui,/marketing_ai_next_run/);assert.match(ui,/Weekly day/);assert.match(ui,/Monthly day/);assert.match(ui,/Timezone/);
});

test("AI business snapshot is aggregate-only and excludes customer PII",()=>{
  const sql=read("supabase/release-5-ai-intelligence-context.sql");
  assert.match(sql,/marketing_ai_business_snapshot/);
  assert.match(sql,/aggregate-only/i);
  assert.match(sql,/count\(\*\)/);
  assert.match(sql,/sum\(/);
  assert.doesNotMatch(sql,/select\s+(?:[^;]*\.)?(?:name|email|phone|notes|internal_notes|venue_address)\b/i);
  assert.doesNotMatch(sql,/customer_name|company_name|normalized_email/i);
  assert.match(sql,/revoke all on function public\.marketing_ai_business_snapshot\(integer\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.marketing_ai_business_snapshot\(integer\) to service_role/);
});

test("autopilot grounds recommendations in the aggregate snapshot without exposing it to browser code",()=>{
  const runner=read("api/marketing-autopilot-run.js"),ui=read("js/admin-ai-autopilot.js");
  assert.match(runner,/rpc\/marketing_ai_business_snapshot/);
  assert.match(runner,/Aggregate business\/content snapshot \(no customer PII\)/);
  assert.match(runner,/snapshot_period_days/);
  assert.doesNotMatch(ui,/marketing_ai_business_snapshot|customer_name|normalized_email/);
});
