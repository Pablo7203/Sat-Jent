# Owner-focused redevelopment Phase 5 — reporting audit

## Scope and baseline

Phase 5 builds on the existing Phase 4 daily-sales batch ledger. The repository already has an executive dashboard, a report catalogue, a sales report, CSV export, and the canonical `sales_revenue_events` / `sales_revenue_event_items` views. The Phase 4 migration and workflows are present in the worktree, but were not applied to the local database during the prior phase because the Supabase CLI could not write its telemetry file outside the workspace. This Phase 5 work therefore remains code- and migration-level until an authorized database run is available.

The current worktree contains substantial pre-existing modifications from earlier phases. Those changes are user work and are intentionally preserved. No data reset, deployment, push, or unrelated cleanup is in scope.

## Findings before Phase 5 changes

1. **Revenue source** — completed individual sales and posted daily batches are already unified in the Phase 4 canonical event view; drafts and reversed/cancelled events are excluded. Sale-line reporting likewise uses immutable snapshots. This is the right source-of-truth architecture.
2. **Business date mismatch** — individual sales in the canonical view use `completed_at` converted to Accra time, while legacy reports use `sales.sale_date`. Backdated individual sales are therefore assigned to the wrong reporting day. The authoritative date is `sales.sale_date`; `completed_at` remains the posting/audit timestamp. Daily batch date is `daily_sales_batches.sales_date`.
3. **Revenue vs collections** — sales total is revenue; customer payments are collections. Daily-batch cash/card/mobile split is not recorded and must remain unknown, not inferred. Existing UI appropriately labels collections separately.
4. **Quantity semantics** — existing dashboard sums quantities across unlike units of measure and labels the result “Units sold.” That aggregate is not meaningful. Product/variant and unit-level quantities are safe; a company-wide scalar is not.
5. **Product rankings** — existing dashboard returns at most eight lines ranked by line revenue. It lacks quantity ranking, least-selling, no-sales, slow-moving, category/brand filters, and drill-down detail.
6. **Inventory and operations** — inventory health is current state (not historical as of the chosen reporting range). Low/out-of-stock counts are tied to tracked `branch_inventory` positions. Existing purchasing/transfer summaries are useful but lack a sufficiently actionable period-aware detail surface. Profit, COGS, and inventory valuation are intentionally absent because there is no fully reconciled cost basis.
7. **Permissions** — database reporting RPCs already use `reporting_scope_allowed` for company-vs-branch authority. New reporting RPCs must keep enforcing that independently of client filters; UI hiding is not authorization.
8. **Date handling** — existing range validation accepts normalized impossible calendar dates, defaults to the last 30 days rather than This Month, and the dashboard trend is daily-only. Date meaning is Africa/Accra; weeks should begin Monday.
9. **CSV** — CSV values are quoted, but formula-injection protection can be bypassed with leading whitespace before `=`, `+`, `-`, or `@`.
10. **Verification baseline** — previous checks had successful lint and TypeScript checks, but unit tests failed before collection due Windows process-spawn `EPERM`, production build could not fetch Google fonts in the restricted network environment, and Supabase CLI was blocked by telemetry-file permissions. These are limitations, not passing checks.

## Metric contracts used for Phase 5

- Revenue: sum `sales_revenue_events.revenue` for completed individual sales (`sales.sale_date`) and posted daily batches (`sales_date`) in the selected Accra business-date range. Exclude drafts, cancelled sales, and reversed daily batches.
- Transaction count: number of those revenue events, not number of cash payments or line items.
- Collections: sum posted `customer_payments.amount` by payment business date. Never add collections to revenue.
- Product performance: immutable posted event-item snapshots, grouped by variant and displayed with their unit. Quantity is not compared across different units.
- Current inventory: current tracked `branch_inventory` only, clearly labeled current, independent of the selected historical period.
- Comparison: comparisons must be labeled and use an explicitly defined prior-period window; no percentage should be implied when the prior denominator is zero.
- No-sales products: active, stock-tracked variants with positive current stock and zero selected-period sales; exclude untracked/retired variants.
- Financial non-goals: no profit, margin, COGS, or inventory valuation until source cost accounting is reconciled.

## Outstanding verification

The accumulated local Supabase database is running and the pending daily-sales, Phase 5 reporting, and corrective branch-performance migrations were applied forward-only. No reset, production/staging operation, push, or deployment was performed. The dashboard was then checked in the authenticated local browser and loaded its report widgets.

The current local database is accumulated development data, not a disposable clean database. Full-suite pgTAP failures are recorded below; a clean migration rebuild and reliable fixture isolation still need a separate disposable test database. Do not reset this local database.

## Phase 5 implementation status (2026-09-24)

Implemented in the current worktree:

- Added a forward-only Phase 5 migration that corrects individual-sale business dates to `sale_date` in Africa/Accra, preserves posted batch `sales_date`, and uses the same canonical posted revenue stream for detailed and period reports.
- Added daily/weekly/monthly/annual revenue-and-entry buckets with collections kept separate and source filters for individual sales vs posted batches.
- Added product ranking modes for best quantity (default), best revenue, least-selling stocked lines, no-sales stocked lines, and slow-moving stocked lines, plus category/brand/search filters, unit grouping, current stock, and last-sold date.
- Replaced dashboard-only inventory and branch report summaries with branch-aware, paginated inventory detail and branch performance (revenue/share, entry counts, average entry, distinct variants, quantities by unit, low/out-of-stock positions, and pending purchase orders).
- Added current-state receivables aging and detailed stock movement reports. Inventory valuation remains intentionally absent.
- Added dashboard date presets and trend granularity, active-product ticker, specific pending purchase/draft-batch rows, recent receipts/transfers, recent activity, and UOM-safe quantities. Drafts remain excluded from revenue and are highlighted as late entries when their sales date is earlier than today in Accra.
- Made CSV export retain report filters and paginate up to 100,000 rows with a clear 413 response above that safety bound; strengthened formula-injection handling and impossible-date validation.
- Added reconciliation assertions for backdated sales, posted/draft batches, active product count, unit-safe totals, no-sales inventory, detailed inventory, and branch-level revenue/entry reconciliation.

Validation after local dashboard repair:

- `pnpm lint`: passed.
- `pnpm typecheck`: passed, including Next route type generation.
- Authenticated local browser check (`/app/dashboard`): passed. The dashboard rendered KPIs, date/branch filters, trend, branch performance, ranked products, inventory attention, purchasing, transfers, and activity.
- `supabase migration up --local`: passed after the Phase 4 daily-sales migration was corrected to preserve the existing `STOCK_TRANSFER` enum-like reference value and the Phase 5 reporting migration was made compatible with this database's missing legacy overload and PostgreSQL's reserved `day` alias.
- The Phase 5 branch-performance function initially had an ambiguous output-column reference. A separate forward corrective migration, `20260929020000_fix_reporting_branch_performance_ambiguity.sql`, fixes it; this was applied locally after Phase 5 and does not rewrite that migration.
- `supabase test db`: failed overall on the accumulated local dataset (17 files / 400 tests). `reporting_phase7.sql` and 11 other test files passed. Failures included catalog/public website assertions seeing extra existing records, daily-sales fixture permission/branch failures, Phase 7 reconciliation fixture rejection by `purchases_payable_reconciles`, a duplicate `inactive@test.invalid` fixture in RLS, and two sales reconciliation assertions. This needs investigation on an isolated disposable database; the accumulated database was not reset.
- `pnpm test -- tests/unit/reporting.test.ts`: blocked before collection by Windows `spawn EPERM` in Vite/Rolldown path resolution.
- `supabase db lint --local --level warning`: reported an existing error in `public.delete_unused_product` referencing nonexistent `public.transfer_items` (the table is `public.stock_transfer_items`), plus warnings in older quotation/sale routines. These are outside the Phase 5 reporting changes and remain unresolved.
- `pnpm build`: blocked because Next.js could not fetch DM Serif Display, Geist, and Geist Mono from Google Fonts in this environment.
- A clean migration rebuild and authenticated Playwright suite were not run. No data was reset, and nothing was committed, pushed, or deployed; all pre-existing worktree changes were preserved.
