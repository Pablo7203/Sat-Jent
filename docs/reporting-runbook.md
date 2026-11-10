# Reporting runbook

## Verification

1. Run `pnpm db:reset`, `pnpm db:lint`, and `pnpm test:rls`.
2. Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`.
3. Run `pnpm test:e2e:setup`, start the app, and run `pnpm test:e2e`.
4. Run `pnpm build` before release.

## Reconciliation

Reconcile dashboard revenue to completed sale totals using `completed_at` in `Africa/Accra`; reconcile collections independently to posted customer payments. Reconcile purchases to non-cancelled purchase totals and supplier payments separately. Aging must equal positive named-customer completed-sale balances.

If a figure looks wrong, confirm status, branch, and timezone first. Then call `dashboard_summary(from_date, to_date, target_branch)` as the affected authenticated user. Do not diagnose access through the service role because it bypasses caller context.

## Performance and safety

Indexes cover completed sales, posted payments, sale-line joins, purchases, and audit activity. Date ranges are capped at two years and detailed exports at 1,000 rows. Add pre-aggregated tables and reconciliation jobs before raising either limit.
