# Project 318 backup and restore

## Backup policy

- Use Supabase-managed backups/PITR when available.
- Before each migration, create or verify a recent backup and record its timestamp.
- Keep separate encrypted schema-only exports in source control review artifacts; never commit production rows.
- Export accounting and customer data only to approved encrypted storage with least-privilege access.
- Test restoration regularly in a disposable project—not Production.

## What must be protected

- CRM customers and activities
- Leads, attribution, consent evidence, and delivery logs
- Bookings
- Invoices, immutable line items, payments, and reversals
- Sales opportunities and stage history
- Proposals and versions
- Follow-up rules/messages
- Website content and settings
- Private customer documents and website images
- Auth administrator metadata and environment-variable inventory (values stored in the provider, not the repository)

## Safe restore drill

1. Create a blank disposable Supabase project.
2. Restore the chosen backup or apply the documented migration chain.
3. Restore private Storage objects with original paths and metadata.
4. Configure disposable-only public and server credentials.
5. Create a staging administrator with `app_metadata.role = admin`.
6. Run all database integration suites and the production checklist against the disposable project.
7. Compare table counts, foreign-key integrity, invoice balances, payment history, proposal versions, consent records, and activity counts.
8. Destroy disposable credentials and document the result.

## Production restoration

- Require explicit owner approval and a written incident record.
- Stop application writes, cron jobs, and email sends.
- Record the current database state before restoring.
- Restore to a new project first when possible; validate before changing traffic.
- Update environment variables atomically and verify the production project reference before deployment.
- Never reuse staging keys in Production.
- After restoration, rotate credentials, refresh administrator sessions, run the full smoke test, and reconcile records created after the restored point.
