# Go-live runbook

## Go/no-go prerequisites

- Release commit/tag exists and CI is green from a clean checkout.
- Staging uses its own Supabase/hosting projects and the release candidate has passed UAT.
- Production domain, HTTPS, environment values, auth URLs, SMTP, signup policy, and monitoring are verified.
- Real branches, employees/access, catalogue, pricing, images, and public content are owner-approved.
- Opening stock dry-run, controlled apply, reconciliation, and sign-off are complete.
- Legacy receivables/payables/cash/history policy is explicitly approved.
- A restorable production backup and rollback owner are confirmed.

Any missing item is a no-go unless the business owner formally accepts a documented non-integrity risk; security, backup, or reconciliation failures are never waivable.

## Cutover

Freeze legacy master-data and stock edits; take the final backup; deploy the immutable release; apply migrations once; provision the Super Admin; load approved master data; post and reconcile opening stock; verify roles; smoke-test login, sale, purchase receipt, transfer, reports, public catalogue, quotation, health, and password reset; then switch DNS/traffic. Record every operator and timestamp.

## Rollback and hypercare

Rollback application traffic to the prior immutable release when schema compatibility permits. If new production writes occurred, do not blindly restore a database or reverse migrations: freeze writes, assess transactions, and use the approved recovery decision. During the first 72 hours, review health/errors, failed auth, stock integrity, sales/purchase/payment reconciliation, quotation intake, and user reports at agreed intervals. Close hypercare only with owner sign-off.
