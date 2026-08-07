# Release 2: Conversion Optimization

Release 2 adds conversion-focused trust, planning, gallery, FAQ, event-type, and local SEO content without changing Release 1 lead intake.

## Data and publishing

Apply `supabase/release-2-conversion-content.sql` after the Release 1 migration. It creates four administrator-managed tables:

- `conversion_items` for testimonials, manual review highlights, client logos, statistics, trust badges, and the response-time promise
- `gallery_items` for unlimited categorized and ordered images
- `gallery_categories` for administrator-managed gallery filters
- `faq_items` for searchable FAQ content and FAQ schema
- `event_types` for event marketing content and per-item SEO metadata

Anonymous visitors can read only published rows. Authenticated users must pass the existing `crm_is_admin()` rule to create, edit, reorder, publish, or delete content.

The rollback intentionally disables access without deleting content or media.

## Admin workflow

Open **Conversion Content** in the authenticated admin. Every content type supports:

- draft or published status
- preview before saving
- drag-and-drop ordering
- editing
- deletion with confirmation

Gallery, client-logo, and event-type editors accept JPG, PNG, and WebP uploads up to 10 MB through the existing `website-images` bucket. Existing fixed photo-manager uploads remain unchanged.

## Public fallback behavior

The homepage, gallery, FAQ, and event-type page use polished built-in fallback content when the migration is not applied, Supabase is unavailable, or no published rows exist. Manual Google review highlights are clearly labeled; no Google API or review claim is fabricated.

## Manual staging validation

1. Apply the migration to a disposable staging Supabase project.
2. Confirm anonymous users see published rows only and cannot modify any table.
3. Confirm a non-admin authenticated user cannot manage content.
4. Create draft and published examples for every content type.
5. Preview, edit, reorder, publish, unpublish, and delete test items.
6. Upload a JPG, PNG, and WebP; reject SVG and files over 10 MB.
7. Verify gallery filters, FAQ search/accordion/schema, event-type cards, mobile CTA, exit reminder, and thank-you suggestions.
8. Verify Home, About, Contact, Corporate, Quote Builder, CRM, bookings, invoices, attribution, and Release 1 submissions still work.
9. Remove staging test content after validation.

## Environment variables

Release 2 adds no environment variables or third-party credentials. It reuses the existing public Supabase runtime configuration and authenticated administrator session.

## Deferred

- Live Google Reviews API synchronization and Google Business Profile credentials
- Automated client-logo discovery or customer-identity inference
- Dedicated standalone URL for every event type
- Multivariate testing and automated personalization
- Image transformations beyond browser-native responsive loading
