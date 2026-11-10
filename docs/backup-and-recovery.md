# Backup and recovery

Enable managed production database backups and point-in-time recovery appropriate to the owner's recovery objectives. Record retention, encryption, storage region, access owners, and restore permissions in the production change record. Product images require a separate storage export/replication plan; a database backup alone does not contain the image objects.

## Logical backup

Run from a trusted host with a short-lived, non-logged database connection string:

```sh
supabase db dump --db-url "$PRODUCTION_DATABASE_URL" --file satj-schema.sql
supabase db dump --db-url "$PRODUCTION_DATABASE_URL" --data-only --use-copy --file satj-data.sql
```

Encrypt the files before off-host storage, restrict access, checksum them, and record timestamp, source project, migration version, and operator. Do not commit backups.

## Restore drill

Restore only into a new isolated database/project. A full Supabase platform dump includes objects owned by managed Auth, Storage, and Realtime roles; restore it using the platform administrator/managed recovery mechanism, not an ordinary application database role. Apply schema, restore data, then run integrity and smoke checks. Confirm row counts for critical tables; stock ledger versus branch inventory; sales totals versus items/payments; purchases versus receipts/payments; transfers in transit; user/branch/role mappings; and storage-object references. Record duration and evidence, then destroy the isolated copy according to policy.

Recovery is not accepted until an actual backup has been restored and verified. A local synthetic-data drill proves the procedure only; it does not prove production backup availability.
