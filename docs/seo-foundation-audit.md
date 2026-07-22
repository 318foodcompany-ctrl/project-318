# Project 318 SEO Foundation Audit

Issue: #59
Branch: `feature/seo-foundation-audit`

## Current baseline

### Already present
- `robots.txt` allows public crawling and blocks `/admin.html`, `/login.html`, and `/api/`.
- `robots.txt` points to `https://www.318foodco.com/sitemap.xml`.
- `sitemap.xml` includes the homepage, catering, corporate, quote builder, about, gallery, contact, and privacy pages.
- The homepage includes a descriptive title, meta description, one visible H1, local Shreveport/Bossier wording, crawlable navigation, and descriptive logo alt text.

### Immediate gaps to audit and correct
1. Canonical URL tags on every public page.
2. Open Graph and social share metadata.
3. LocalBusiness / FoodEstablishment structured data.
4. Breadcrumb and FAQ schema where appropriate.
5. Unique title and meta-description coverage across all public pages.
6. Heading hierarchy and duplicate H1 checks.
7. Image alt-text coverage and oversized image checks.
8. Internal-link coverage among catering, corporate, quote, contact, gallery, and homepage pages.
9. Search-engine exclusion for all private/admin-only surfaces.
10. Local keyword coverage for Shreveport, Bossier City, office catering, corporate catering, wedding catering, party catering, delivery, and setup.

## Delivery plan

### Milestone 1 — Machine-readable SEO foundation
- Add canonical tags.
- Add Open Graph metadata.
- Add JSON-LD business schema.
- Validate sitemap and robots coverage.
- Add explicit noindex metadata to private pages where needed.

### Milestone 2 — Page-by-page SEO score
Create an admin-side scoring model that evaluates:
- title quality
- meta-description quality
- H1 presence
- local keyword relevance
- internal links
- image alt text
- canonical tag
- structured data
- indexability

Each recommendation must explain the problem, business impact, and suggested correction.

### Milestone 3 — Approval workflow
- AI-generated changes remain drafts.
- Admin can approve or reject each proposed change.
- Approved changes are logged.
- No automatic publication without approval.

### Milestone 4 — Competitor and keyword tracking
- Store target keyword groups.
- Record manual competitor domains.
- Track opportunities and content gaps.
- Avoid unsupported ranking claims when live search data is unavailable.

## Initial target keywords

### Primary
- catering Shreveport LA
- catering Bossier City LA
- corporate catering Shreveport
- office lunch catering Shreveport
- event catering Shreveport

### Secondary
- wedding catering Shreveport
- party catering Bossier City
- catering delivery Shreveport
- employee lunch catering
- catering for 15 people

## Guardrails
- Never auto-publish AI suggestions.
- Preserve the existing quote, booking, invoice, and payment systems.
- Keep Meta Pixel/CAPI and Microsoft Clarity out of this phase.
- Do not expose private admin or API routes to search engines.
