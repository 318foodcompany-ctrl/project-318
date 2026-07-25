# Project 318 Production Feature Audit

**Audit date:** July 25, 2026
**Repository:** `318foodcompany-ctrl/project-318`
**Audited base commit:** `72ad98e3b587a20fff22bfe252e2fc69cc83ec07`
**Audit branch:** `agent/production-feature-audit`
**Production site:** `https://www.318foodco.com`
**Production data mutations performed:** None

## Executive summary

Project 318 has a strong working operational core: secure administrator authentication, CRM records, quote intake, bookings, invoices, payment tracking, first-party attribution, GA4 consent controls, SEO foundations, and a marketing/SEO assistant. The automated suite is broad and currently green.

The system is **not yet ready to be treated as a fully automated catering sales platform**. The most important gap is operational: a quote submitted through the guided planner is saved, but there is no email/SMS notification to the owner or confirmation to the customer even though the success message says it was “sent.” The Contact page uses a separate `mailto:` flow and does not create a database lead. Those two quote paths can produce inconsistent outcomes and lost opportunities.

Several admin controls also overstate what the public site will do. The Homepage, About, and Contact content editors save database content, but their public loaders are compatibility stubs that intentionally leave the hard-coded page copy unchanged. The Specials section is a placeholder. Automated email, SMS, online payment collection, promotion publishing, Square import, customer tags, and persistent follow-up reminders are not production features.

**Overall production-readiness score: 72/100.**

**Launch recommendation:** Do not promote the system as fully automated until the quote-notification and quote-path inconsistencies are fixed. The public marketing site can remain live, and the authenticated CRM/accounting features can continue to be used with the manual operating procedures documented below.

## Scope and methodology

The audit covered:

- every HTML route and public crawler endpoint;
- browser scripts, stylesheets, API functions, SQL migrations, rollback files, and tests;
- public quote, contact, attribution, consent, SEO, and analytics flows;
- administrator authentication, content, media, menus, website settings, CRM, quotes, bookings, invoicing, payments, marketing reporting, launch readiness, and AI assistance;
- anonymous-access behavior for private production tables;
- live, read-only route, metadata, image, console, and configuration checks;
- repository-wide syntax, test, dead-marker, secret, and configuration searches.

The audit did **not**:

- submit a real quote;
- create, edit, archive, invoice, book, or delete a production record;
- send an email, SMS, or advertising event;
- upload a production image;
- run a migration or rollback;
- change Vercel or Supabase configuration;
- sign into the production administrator dashboard;
- deploy or merge code.

## Severity scale

| Severity | Meaning |
|---|---|
| Blocker | Can lose a lead, falsely claim a critical action, expose protected data, or corrupt accounting/CRM records. |
| High | Major production workflow is absent, inconsistent, or misleading; manual mitigation is required. |
| Medium | Material usability, maintainability, conversion, performance, or defense-in-depth weakness. |
| Low | Polish, cleanup, or documentation issue with limited immediate operational impact. |

## Findings requiring action

### PA-001 — Guided quote success falsely implies a message was sent

- **Severity:** Blocker
- **Evidence:** `js/quote-live.js` persists a lead through `submit_quote_with_attribution`, then displays “saved and sent to 318 Food Co.” Repository searches found no email/SMS provider or notification call in that flow.
- **Customer impact:** A customer reasonably believes the company was actively notified. The owner must discover the new lead by opening the dashboard.
- **Risk:** Delayed response or a completely missed catering inquiry.
- **Required correction:** Add a server-side notification pipeline with retry/audit status, or change the success message to state only that the request was saved and document a dashboard-monitoring procedure. Customer confirmation and owner notification must not be claimed until provider delivery is accepted.
- **Interim operating procedure:** Check Quote Management at least daily and after every campaign.

### PA-002 — Contact page and guided planner create different outcomes

- **Severity:** High
- **Evidence:** `contact.html` is handled by `script.js` and opens a `mailto:` draft. It does not call the Supabase quote RPC. `quote-builder.html` writes a real lead.
- **Customer impact:** The result depends on whether the visitor has a configured mail application and whether they manually send the draft.
- **Risk:** Contact-page requests may never enter CRM, attribution, follow-up, booking, invoicing, or revenue reporting.
- **Required correction:** Use one server-backed quote intake service for both forms, or clearly reposition Contact as an email-only link and direct all quote CTAs to the guided planner.

### PA-003 — Marketing opt-in is displayed but not persisted by the live quote flow

- **Severity:** High
- **Evidence:** `quote-builder.html` collects `marketingOptIn`; `js/quote-live.js` does not add it to the lead or RPC parameters. The current CRM path therefore cannot use that checkbox as durable consent evidence.
- **Customer impact:** Consent intent is lost.
- **Compliance impact:** The business cannot reliably prove opt-in or build a compliant subscriber segment from the form.
- **Required correction:** Add a versioned consent record containing subject/contact, channel, disclosure version, timestamp, source, and withdrawal state. Keep transactional quote communication separate from marketing consent.

### PA-004 — No abuse protection or idempotency for anonymous quote creation

- **Severity:** High
- **Evidence:** The anonymous RPC validates input and uses RLS-safe functions, but no CAPTCHA, request-rate control, honeypot, server-side throttling, or client idempotency key was found.
- **Risk:** Spam leads, resource consumption, CRM noise, and duplicate records after uncertain network retries.
- **Required correction:** Add layered abuse controls and an idempotency key enforced by a unique constraint. Preserve accessibility and provide a phone fallback.

### PA-005 — Three content editors do not update their public pages

- **Severity:** High
- **Evidence:** Homepage, About, and Contact admin editors write `website_content`. Their public scripts (`site-content.js`, `site-about-content.js`, `site-contact-content.js`) are compatibility stubs that deliberately retain hard-coded HTML. Corporate content remains dynamic.
- **Owner impact:** The dashboard can report a successful save while public wording does not change.
- **Required correction:** Either restore safe dynamic rendering with production-content validation and cache control, or remove/disable the misleading editors and label the content as developer-managed.

### PA-006 — Specials and outbound marketing are not implemented

- **Severity:** High
- **Evidence:** The production admin Specials panel is a placeholder. No Resend, Twilio, suppression-list, unsubscribe, scheduling, delivery-status, or campaign-send implementation exists. Legacy preview pages save drafts only in local storage.
- **Required correction:** Do not advertise automated specials. Build consent, suppression, templates, provider webhooks, retries, send audit, and stop conditions before enabling campaigns.

### PA-007 — Legacy preview dashboards remain publicly routable

- **Severity:** Medium
- **Evidence:** `/dashboard.html` and `/OPEN-DASHBOARD.html` load a local-only demo with public PIN `3180`, sample customers, browser-local records, preview email tools, and Square import. They are `noindex`, but directly accessible. `/assistant.html` is also an interactive preview.
- **Risk:** Owner/customer confusion, accidental entry of personal data into browser storage, and false expectations about live capabilities.
- **Required correction:** Remove these artifacts from deployment, redirect them to the authenticated admin, or gate them with an explicit non-production build flag.

### PA-008 — Modern CRM lacks several requested operating controls

- **Severity:** Medium
- **Present:** Search, pagination, active/archive views, customer detail, quotes, bookings, financial summary, and activity timeline.
- **Missing/partial:** Customer tags, persisted follow-up date/reminders, task queue, Square customer import, marketing-consent history, and unified outbound communication history.
- **Required correction:** Add these only after consent and messaging architecture is approved.

### PA-009 — Quote Management is a lead pipeline, not a proposal system

- **Severity:** Medium
- **Present:** Search, filters, pipeline/table view, statuses, internal notes, customer, booking, and invoice links.
- **Missing/partial:** Editable proposal details, versioned quote line items, acceptance/rejection by customer, proposal delivery, expiration, revision history, and an explicit “send quote” transaction.
- **Required correction:** Rename UI labels where necessary to avoid implying a formal proposal was sent, or implement a versioned proposal document and delivery workflow.

### PA-010 — Payments are recorded, not collected online

- **Severity:** Medium
- **Present:** Server-calculated invoice totals, payment recording, reversal controls, balance/status logic, immutable history, concurrency checks, and print/save-PDF.
- **Missing:** Payment gateway, hosted payment link, customer receipt delivery, provider reconciliation, refunds, and webhook processing.
- **Required correction:** Clearly label payment entries as manually recorded. Treat a future gateway integration as a separate security/accounting project.

### PA-011 — Meta Pixel is not configured

- **Severity:** Medium
- **Live check:** GA4 measurement configuration is present; Meta Pixel configuration is absent.
- **Present:** Consent-gated GA4/Meta provider modules, event deduplication, attribution capture, campaign link builder, launch readiness, and reporting.
- **Required correction:** Complete owner-side Meta configuration only after consent language, event mapping, domain verification, and Test Events validation are approved.

### PA-012 — Attribution starts before optional-storage consent

- **Severity:** Medium
- **Evidence:** `marketing-attribution.js` writes visitor/session/first-touch/last-touch values to local storage when the module initializes. Analytics and advertising providers are consent-gated, but first-party attribution storage is treated as necessary.
- **Privacy impact:** The privacy policy and consent classification must explicitly justify this storage as strictly necessary, or attribution storage must wait for consent.
- **Required correction:** Obtain legal/business approval for the classification and document retention. If it is not necessary, move attribution identifiers behind the appropriate consent category.

### PA-013 — Consent script can be requested twice during initial load

- **Severity:** Medium
- **Evidence:** Both `script.js` and `marketing-attribution.js` dynamically request `js/consent-manager.js`. Their guards use different selectors/IDs and can race before the first script finishes loading. Live DOM inspection showed two consent script elements on the homepage.
- **Risk:** Extra request, duplicate initialization attempts, and fragile consent UI behavior.
- **Required correction:** Use one static include or one shared promise/loader with a single stable element ID.

### PA-014 — Social proof and high-intent conversion content are thin

- **Severity:** Medium
- **Live homepage evidence:** No testimonial/review component, client logos, social links, FAQ, or clear response-time promise was present.
- **Conversion impact:** Corporate and high-value buyers lack proof and expectation-setting near the primary CTA.
- **Required correction:** Add only verified testimonials, permitted client logos, service-area details, response expectation, and common booking FAQs. Do not invent claims or urgency.

### PA-015 — Fixed gallery is not a full gallery manager

- **Severity:** Medium
- **Present:** Administrator-controlled hero and three gallery image slots.
- **Missing:** Add/remove/reorder items, captions/alt text per image, pagination, image library, focal-point control, and audit history.
- **Required correction:** Either describe it as fixed gallery slots or implement a normalized gallery table and media metadata.

### PA-016 — Upload validation is incomplete at the client edge

- **Severity:** Medium
- **Present:** Storage bucket MIME allowlist, 10 MB limit, administrator-only writes, client MIME/size checks, safe public reads.
- **Missing/partial:** Pixel-dimension limits, image decoding/re-encoding, malware/content scanning, EXIF stripping, and server-derived file type verification.
- **Required correction:** Re-encode images in a trusted server function before publishing for stronger defense.

### PA-017 — Content Security Policy still permits inline code

- **Severity:** Medium
- **Evidence:** `vercel.json` uses `'unsafe-inline'` for scripts and styles.
- **Risk:** Reduces CSP protection against XSS.
- **Required correction:** Move inline scripts/styles into versioned assets and adopt nonces or hashes. Retain current restrictions (`object-src 'none'`, `base-uri 'self'`, frame protections) during migration.

### PA-018 — Password recovery is not available in the owner UI

- **Severity:** Medium
- **Present:** Email/password login, explicit `crm_is_admin()` check, unauthorized sign-out, session restoration, logout.
- **Missing:** Forgot-password flow, recovery completion screen, owner-facing session troubleshooting, and documented break-glass process.
- **Required correction:** Add a secure Supabase recovery flow with approved redirect URLs and administrator runbook.

### PA-019 — Large unused image artifacts remain in the deployed repository

- **Severity:** Low
- **Evidence:** `hero-mockup.png` is approximately 2.6 MB and `hero-catering-wide.png` approximately 2.2 MB; neither is referenced by a live page. Several older “full” menu images also appear unused.
- **Impact:** Repository/deployment weight and maintenance confusion.
- **Required correction:** Confirm no external use, then remove or archive outside the deployment bundle.

### PA-020 — About page ships a large brochure image

- **Severity:** Medium
- **Evidence:** `about.html` references `catering-brochure.jpeg` (approximately 671 KB).
- **Performance impact:** Avoidable mobile transfer and slower rendering.
- **Required correction:** Produce responsive AVIF/WebP variants and specify dimensions/srcset.

### PA-021 — Marketing spend has two sources of truth

- **Severity:** Medium
- **Evidence:** A database-backed marketing-spend module exists, while `admin-marketing-dashboard.js` also reads a private `318_marketing_spend` local-storage value for selected-period CPL.
- **Risk:** Conflicting ROI/CPL numbers across browsers and reports.
- **Required correction:** Use the database ledger for reporting and clearly isolate any what-if calculator from actual spend.

### PA-022 — AI scope is narrower than the product language implies

- **Severity:** Medium
- **Present:** Administrator-only marketing/SEO analysis, structured recommendations, rate limiting, sanitized context, draft review state, audit logging, and server-only provider credentials.
- **Missing:** Facebook post, email campaign, blog, promotion, Google Ads, and Meta Ads generators as distinct reviewed workflows.
- **Required correction:** Describe the current tool as a Marketing & SEO Assistant. Add generators only with per-artifact approval, versioning, and compliance checks.

### PA-023 — Production database integration suites were not run in this audit

- **Severity:** Medium verification gap
- **Reason:** The four suites require explicitly supplied staging database credentials and administrator JWTs. Production credentials were intentionally not used.
- **Skipped suites:** CRM identity/concurrency; CRM quote-status policy/timeline; invoice security/integrity; invoice numbering/payment concurrency.
- **Required correction:** Run these in disposable/staging CI before the next database release.

## Customer-facing feature matrix

| Feature | Status | Evidence / behavior | Required follow-up |
|---|---|---|---|
| Homepage | Implemented | Live, responsive structure, clear hero and CTAs | Add verified social proof and FAQ |
| Catering menus | Implemented | Six menu sections, dynamic menu text/images with static fallbacks | Verify every admin edit after each deployment |
| Corporate page | Implemented | Dynamic corporate content and CTA | Add proof/recurring-program specifics |
| About page | Partial | Live static page; admin edits do not propagate | Restore loader or remove editor |
| Gallery | Partial | Three managed images | Add/remove/reorder/captions not available |
| Contact page | Partial | Creates mail client draft only | Use unified database quote submission |
| Guided quote builder | Partial | Persists leads and attribution | Add notification, idempotency, abuse control, consent persistence |
| Quote estimate | Implemented with disclaimer | Client planning estimate | Keep server/business quote authoritative |
| Marketing opt-in | Broken | Checkbox not persisted | Add consent ledger |
| Confirmation email | Missing | No provider/send path | Server-side transactional email |
| Owner lead notification | Missing | Dashboard discovery only | Email/SMS/web push with audit status |
| AI catering assistant | Preview only | Explicitly says no messages sent | Remove from prod or productize safely |
| Reviews/testimonials | Missing | None found on homepage | Add verified content only |
| FAQ | Missing | None found | Add high-intent catering questions |
| Social links | Configurable, not visibly populated | Website Settings supports them | Populate and verify placement |
| Privacy controls | Implemented with caveat | Banner, preferences, GA4/Meta consent mode | Decide first-party attribution classification |
| Privacy policy | Implemented | Live, canonical, crawlable | Legal review before outbound marketing |

## Administrator feature matrix

| Feature | Status | Evidence / behavior | Required follow-up |
|---|---|---|---|
| Authentication | Implemented | Supabase session + `crm_is_admin()` | Add password recovery |
| Authorization/RLS | Implemented | Admin policies and anonymous denials | Re-run DB suites in staging for releases |
| Homepage editor | Misleading | Saves content; public loader is a stub | Restore or remove |
| About editor | Misleading | Saves content; public loader is a stub | Restore or remove |
| Corporate editor | Implemented | Public dynamic loader exists | Live authenticated verification |
| Contact editor | Misleading | Saves content; public loader is a stub | Restore or remove |
| Website Settings | Implemented | Phone/email/address/hours/social centralized with fallbacks | Live authenticated verification |
| Menu & pricing | Implemented | Database-driven with fallback content | Add full package-description editing if desired |
| Photo manager | Partial | Fixed slots, admin-only bucket writes | Add media metadata/library |
| Specials | Missing | Placeholder panel | Build only after consent/messaging |
| Quote dashboard | Partial | Search, statuses, pipeline, notes, links | Formal proposals/delivery absent |
| Booking calendar | Implemented | Manual/from quote, linked customer, timeline | Credential-backed regression still required |
| CRM | Partial | Customer records, archive, timeline, relationships | Tags, reminders, Square import absent |
| Invoices | Implemented | Draft/issue/send/void, line items, totals, source uniqueness | No customer delivery/payment gateway |
| Payments | Implemented as records | Record/reverse with integrity controls | No online collection/reconciliation |
| Marketing dashboard | Partial | Funnel/source/revenue reports | Remove local-spend ambiguity |
| Launch checklist | Implemented | Owner actions and provider readiness | Manual account steps remain |
| Marketing/SEO AI | Implemented, limited scope | Admin API, drafts, audit log | Provider config and live admin smoke test |

## End-to-end workflow traces

### Guided website quote

1. Visitor chooses event, guest count, menu, add-ons, date, address, and contact details.
2. Safe non-identity draft fields are stored locally for seven days.
3. First/last attribution, visitor ID, and session ID are captured locally.
4. `submit_quote_with_attribution` creates/links the customer, lead, and attribution transactionally.
5. The UI confirms a positive database ID.
6. **Break:** Marketing opt-in is not transmitted.
7. **Break:** No owner notification or customer confirmation is sent.
8. The lead becomes visible in Quote Management when the owner next opens it.

### Contact-page request

1. Visitor fills contact and estimate fields.
2. Browser builds a `mailto:` URL.
3. Visitor’s mail client must open and the visitor must send manually.
4. **Break:** No direct CRM record, attribution chain, owner delivery confirmation, or retry exists.

### Quote to booking

1. Administrator opens a persisted lead.
2. Status and internal notes save to Supabase.
3. Eligible lead can create a linked booking.
4. Time parsing normalizes supported values and falls back safely.
5. Customer, quote, booking, and activity relationships are preserved.

### Quote/booking to invoice and payment

1. Administrator creates or opens the single active invoice associated with the source.
2. Line items and invoice totals are computed through controlled database functions.
3. Invoice number allocation is concurrency-safe.
4. Payments update paid/balance/status; reversals preserve history.
5. CRM financial summary and timeline consume invoice/payment relationships.
6. **Boundary:** Delivery is print/save-PDF; payment is manually recorded rather than collected online.

### Marketing attribution to revenue

1. Browser stores first touch and last non-direct touch.
2. Quote submission writes attribution and lead linkage.
3. Existing quote/customer/booking/invoice/payment relationships provide downstream revenue attribution.
4. Marketing dashboard aggregates funnel and revenue.
5. **Boundary:** Meta is not configured, Search Console is manual, and ad-spend reporting is not fully unified.

## Security review

### Confirmed controls

- Public runtime configuration exposes only Supabase URL/public anon key and optional public analytics IDs.
- API routes require a bearer user and verify `crm_is_admin()` before returning administrative data or invoking AI.
- AI provider URL, key, and model stay server-side.
- Anonymous users were denied reads from `customers`, `bookings`, `invoices`, `payments`, and `customer_activities`.
- Anonymous `leads` select returned HTTP 200 with zero rows, consistent with RLS filtering.
- Anonymous quote creation is confined to security-definer RPCs with controlled grants.
- Website image writes require an authenticated administrator.
- Security headers include HSTS, nosniff, same-origin framing, restrictive permissions policy, and CSP.
- No service-role key, database password, or provider secret was found in browser source.
- Customer internal notes and customer-submitted notes use separate fields.
- Payment reversal and status operations use controlled database logic.

### Security work still required

- Add quote abuse prevention and idempotency.
- Remove `'unsafe-inline'` from CSP.
- Re-encode uploaded images in a trusted environment.
- Add password recovery and administrator incident runbook.
- Run credential-backed RLS/integrity suites in staging.
- Remove or isolate local demo dashboards.
- Confirm all server environment values in deployment settings; repository inspection cannot prove hidden values.

## SEO and discoverability review

### Confirmed

- Public pages declare English language, title, description, canonical URL, and a single H1.
- Open Graph and Twitter metadata are present on crawlable pages.
- `robots.txt` and `sitemap.xml` are live and passed smoke checks.
- Private/preview routes are `noindex`.
- LocalBusiness-style structured data is injected by `technical-seo.js`.
- Image alt text exists for inspected public images.
- Crawlable routes returned successfully in the live smoke test.

### Gaps

- No FAQ content/schema.
- No verified review aggregate or testimonials.
- No automated Search Console data import.
- No location/service landing-page system.
- No admin-managed metadata/schema publishing workflow.
- Social image is reused broadly rather than page-specific.
- Search Console verification and sitemap submission remain account-owner actions.

## Accessibility and responsive review

### Confirmed

- Skip links, language declarations, labels, live status regions, reduced-motion handling, and focus improvements are covered by tests.
- Public navigation and primary forms have accessible names.
- Quote form retains a phone fallback when submission fails.
- Admin visual modules include responsive breakpoints and empty/loading/error patterns.

### Manual verification still required

- Keyboard-only completion of the entire seven-step quote flow.
- Screen-reader output for step changes, estimate changes, admin dialogs, pipeline drag/drop alternatives, and invoice totals.
- Focus trapping/restoration in all modal dialogs.
- 200%/400% zoom and reflow.
- Mobile Safari, iOS VoiceOver, Android Chrome/TalkBack.
- Color contrast against all food-photo backgrounds.
- Large CRM, quote, booking, and invoice datasets on a phone.

## Performance review

### Positive controls

- Public images generally use lazy loading and fall back to bundled assets.
- Public performance script adds dimensions/loading behavior.
- Motion respects reduced-motion preferences.
- Core application is static HTML/CSS/JS with no large framework bundle.

### Gaps

- Unused multi-megabyte image artifacts remain in the deployment repository.
- The About brochure image is approximately 671 KB.
- Images lack a comprehensive responsive `srcset`/AVIF strategy.
- Consent logic can request the same script twice.
- Dynamic Supabase images use timestamp cache-busting, reducing browser/CDN cache effectiveness.
- No reproducible Lighthouse/WebPageTest budget is enforced in CI.
- Google Fonts remain third-party runtime dependencies.

## Configuration and owner-action checklist

| Item | State | Owner/manual action |
|---|---|---|
| Production Supabase URL/anon key | Configured | Keep Production scope separate from Preview |
| GA4 measurement ID | Configured | Verify Realtime and conversion events in GA4 |
| Meta Pixel ID | Not configured | Complete consent/domain/event review first |
| Marketing AI endpoint/key/model | Repository supports it; deployment value not proven | Configure server-only variables and smoke test |
| Search Console | Manual | Verify property and submit sitemap |
| Website phone/email/address/hours/social | Database managed | Authenticated visual check |
| Email provider | Missing | Select/configure provider only after consent design |
| SMS provider | Missing | Legal opt-in and STOP/help workflow required |
| CAPTCHA/rate limiting | Missing | Select privacy-compatible solution |
| Online payment provider | Missing | Separate PCI/security/accounting project |
| Password recovery redirect | Missing | Configure and test approved URL |

## Validation results

### Automated local checks

- **JavaScript syntax:** 104 files checked, 104 passed, 0 failed.
- **Node test suite:** 145 tests total; 141 passed; 0 failed; 4 skipped.
- **Git whitespace/diff validation:** To be run again immediately before commit.

### Skipped database suites

1. CRM database identity/concurrency — staging URL, anon key, and admin token unavailable.
2. CRM quote-status policy/timeline integration — same credential requirement.
3. Invoice database security/integrity — staging URL, anon key, admin token, and service-role key required.
4. Invoice numbering/payment concurrency — same invoice credential requirement.

These skips are expected in an audit that deliberately avoids production credentials and writes. They remain mandatory before any database migration release.

### Live production read-only smoke test

- **11/11 passed:** homepage, catering, corporate, about, gallery, contact, quote builder, privacy, sitemap, robots, runtime config.
- Production runtime Supabase host matched `qanetxmyoxpqnwsntmqz.supabase.co`.
- GA4 configured: yes.
- Meta Pixel configured: no.
- Anonymous private-table access: denied or zero rows as expected.
- Browser console on the inspected public homepage: no captured warning/error entries.
- Public catering images loaded successfully after lazy-load/fallback execution.

### Tests intentionally not performed

- Real public quote submission.
- Contact email-client submission.
- Authenticated admin create/update/delete workflows.
- Image upload.
- AI provider request.
- Analytics/advertising event transmission.
- Payment, invoice, booking, or CRM mutation.

## Recommended remediation order

### Release 1 — Protect every lead

1. Unify Contact and guided quote intake.
2. Add transactional owner notification and customer confirmation with delivery audit.
3. Correct success wording.
4. Add idempotency and abuse protection.
5. Persist versioned marketing consent.

### Release 2 — Make admin controls truthful

1. Restore or remove Homepage/About/Contact public content loaders.
2. Remove production preview dashboards and assistant, or gate them to non-production.
3. Relabel Quote Management where no formal proposal has been delivered.
4. Remove the Specials placeholder until messaging exists.

### Release 3 — Operational CRM

1. Tags, tasks, reminders, and follow-up dates.
2. Unified communication log.
3. Safe Square import with explicit consent handling.
4. Password recovery and administrator runbook.

### Release 4 — Marketing and conversion

1. Verified testimonials, FAQs, response-time expectation, and trust content.
2. Resolve attribution-consent classification.
3. Configure/test Meta only after consent approval.
4. Unify marketing-spend reporting.

### Release 5 — Performance and defense in depth

1. Responsive image pipeline and unused-asset cleanup.
2. Single consent loader.
3. CSP nonce/hash migration.
4. Trusted image processing.
5. Lighthouse budgets and cross-browser accessibility regression.

## Production decision

The public site, CRM, booking calendar, invoicing, and manual payment tracking have a credible production foundation, and no evidence of anonymous CRM/accounting disclosure was found. However, the current quote experience can falsely imply notification delivery and the Contact form does not enter CRM. Those are material sales-operating risks.

**Project 318 is not yet ready to be declared fully production-complete.**

It is suitable for continued controlled use if the owner:

1. monitors Quote Management frequently;
2. understands Contact requests depend on the customer sending an email draft;
3. does not market automated specials, SMS, online payment, or AI content generation as live features;
4. completes the blocker/high-severity remediation before scaling paid traffic.
