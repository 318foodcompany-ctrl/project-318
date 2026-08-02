# Production Migration Runbook

This is the authoritative migration order for the integrated launch candidate. Apply to a backed-up disposable staging project first. Production execution requires account-owner approval and is not part of this release branch.

| Order | Forward migration | Purpose / prerequisite | Rerunnable | Rollback and limitations | Data-loss risk / verification |
|---:|---|---|---|---|---|
| 1 | `supabase/baseline-schema.sql` | Base leads and website schema | Review before rerun | Restore backup; no universal rollback | High if reversed; verify core tables |
| 2 | `supabase/website-settings.sql` | Published site settings; requires baseline | Yes | None; restore backup | Low; read public settings |
| 3 | `supabase/quote-internal-notes.sql` | Private quote notes; requires leads | Yes | None | Low; verify anonymous denial |
| 4 | `supabase/booking-calendar.sql` | Booking records and RPCs | Yes | None | High if removed; create staging booking |
| 5 | `supabase/customer-crm.sql` | Customers, activities, `crm_is_admin()` | Yes | `customer-crm-rollback.sql`; guarded/record destructive | High; verify admin and anonymous roles |
| 6 | `supabase/customer-crm-status-fix.sql` | Quote status and CRM timeline corrections | Yes | `customer-crm-status-fix-rollback.sql`; may restore old behavior | Medium; exercise status transitions |
| 7 | `supabase/invoicing-payments.sql` | Invoice ledger, numbering, payments | Yes | `invoicing-payments-rollback.sql`; disables feature and preserves financial records | Critical; run invoice integrity/concurrency suites |
| 8 | `supabase/marketing-attribution.sql` | First/last touch attribution | Yes | `marketing-attribution-rollback.sql`; preserve attribution history | Medium; submit tagged staging lead |
| 9 | `supabase/marketing-funnel-reporting.sql` | Funnel reporting RPCs | Yes | Restore definitions from backup | Low; call admin report |
| 10 | `supabase/marketing-spend-roas.sql` | Spend and ROAS reporting | Yes | Restore definitions from backup | Medium; verify admin-only access |
| 11 | `supabase/website-settings-admin-hardening.sql` | Restrict settings writes to admins | Yes | No routine rollback | Low; verify authenticated non-admin denial |
| 12 | `supabase/migrations/20260722190000_admin_rls_hardening.sql` | Removes broad authenticated admin access; requires `crm_is_admin()` | Yes | No routine rollback | Low; run RLS matrix |
| 13 | `supabase/migrations/20260722200000_website_images_storage.sql` | Website image bucket and hardened policies | Yes | No routine rollback; objects must be retained | Medium; validate signatures, size, RLS |
| 14 | `supabase/release-1-lead-automation.sql` | Secure lead intake, consent, delivery evidence, rate limits | Yes | `release-1-lead-automation-rollback.sql`; non-destructive feature disable | Medium; test idempotent intake and private data |
| 15 | `supabase/release-2-conversion-content.sql` | Testimonials, gallery, FAQ, events | Yes | `release-2-conversion-content-rollback.sql`; disables access, retains content | Low; verify published/anonymous and draft/admin views |
| 16 | `supabase/release-3-sales-platform.sql` | Pipeline, proposals, portal, follow-ups | Yes | `release-3-sales-platform-rollback.sql`; refuses when business records exist | High; run portal/proposal database tests |
| 17 | `supabase/launch-readiness-hardening.sql` | Atomic/recoverable queue claims | Yes | `launch-readiness-hardening-rollback.sql`; narrowly scoped | Medium; test duplicate and stuck claims |
| 18 | `supabase/release-4-ai-marketing.sql` | AI drafts, campaigns, sequences, events, suppression | Yes | `release-4-ai-marketing-rollback.sql`; refuses with business/compliance history | High; verify no enrollment/queue side effects and run Release 4 database tests |

Before every step: confirm the staging project reference, take/confirm a backup, inspect the SQL transaction boundary, and record start/end timestamps. After every step: capture the expected verification above, inspect Supabase logs, and stop on any unexpected row count, policy, function, or permission change.

Static integration review found no duplicate release filenames or missing parent migrations. The sequence deliberately places `crm_is_admin()` before every dependent policy; storage hardening precedes Release 2/3 content use; Release 3 precedes queue hardening; and Release 4 follows the hardened queue. Rollbacks for invoicing, Release 3, and Release 4 are not disaster-recovery substitutes and must never be forced around their business-data guards.

Required configuration for staging validation: `CRM_TEST_SUPABASE_URL`, `CRM_TEST_ANON_KEY`, `CRM_TEST_ADMIN_TOKEN`, `CRM_TEST_SERVICE_ROLE_KEY`, `INVOICE_TEST_SUPABASE_URL`, `INVOICE_TEST_ANON_KEY`, `INVOICE_TEST_ADMIN_TOKEN`, and `INVOICE_TEST_SERVICE_ROLE_KEY`. Never commit their values.
