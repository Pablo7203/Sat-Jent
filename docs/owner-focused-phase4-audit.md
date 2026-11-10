# SAT-J Owner-Focused Phase 4 Audit

**Status: implementation authored; migration and database tests not executed locally. No database changes applied.**

## Repository and Phase 3 baseline

- Current branch: `codex/satj-owner-focused-redesign`.
- The worktree already contains numerous unrelated/uncommitted Phase 1–3 and UI changes. They are preserved; Phase 4 will add forward-only migrations and scoped files only.
- The repository Phase 3 audit (`docs/owner-focused-phase3-audit.md`) reports the local purchasing/receiving migrations through `20260925013000` applied and a focused 64-assertion pgTAP suite passing. It explicitly leaves receipt concurrency stress, guarded purchasing E2E, full regression and production build outstanding. Treat Phase 3 as **PASS WITH LIMITATIONS**, not a release sign-off.
- Local Vitest execution was attempted and failed before test collection: Vite's Windows `optimizeSafeRealPathSync` child-process spawn returned `EPERM`. `pnpm exec supabase status` could not run because the Supabase CLI is not recognized in this environment. No reset or database mutation was attempted.

## Current sales and inventory architecture

- Individual sales are stored in `sales` and `sale_items`. The sale header requires a customer and includes payment status, amount paid, and balance due. Completion (`complete_sale`) requires walk-in sales to be fully paid, can create a customer payment, and posts `SALE` inventory movements. This is unsuitable for an aggregate batch that has no verified cash collection or named customer.
- Individual sale lines snapshot product/variant/SKU/unit, standard suggested price, actual unit price and line total. A recent forward migration permits repeated variant lines; the original schema's `(sale_id, variant_id)` uniqueness is no longer authoritative.
- Inventory is represented by `branch_inventory` plus immutable `stock_movements`. `inventory_apply_movement` locks a branch/variant row, rejects negative results, and is revoked from direct authenticated callers. Posting must call it within one trusted database transaction.
- Purchasing uses separate purchase orders, partial goods receipts, actual receipt-cost snapshots, recognized-payable calculations, supplier payments and an idempotent `post_goods_receipt` RPC. The Phase 3 audit records no critical known stock corruption, while noting that concurrent-receipt stress remains unverified.
- Product lookup is the shared `/api/app/product-lookup` endpoint and `ProductLookup` component. It returns exact variant UUID, Item Code, unit, branch stock and effective standard retail price.
- Existing reporting is implemented by `dashboard_summary` and `reporting_sales` RPCs in `20260831021000_reporting_layer.sql`. It currently calculates completed individual-sale revenue from `sales` and `sale_items`; customer collections and receivables come from separate payment/sale sources.
- Sales price overrides are controlled by `sales.price_override`; date validation already limits future transactions and limits backdating to Owner/Super Admin. Branch scope is enforced by `can_access_branch` and authenticated server actions.

## Architecture decision (before implementation)

Implement `daily_sales_batches` and `daily_sales_batch_items` as a separate aggregate-sales source, **not** as a fake walk-in sale. This preserves the individual customer/payment/receivable lifecycle and avoids fabricated payments. A posted batch will contribute exactly one revenue event and its lines will each create exactly one stock movement, all in the same PostgreSQL transaction. Drafts have no stock/revenue reporting effect. Reversal keeps the original record and restores stock with linked reversal movements; it does not manufacture a refund.

Use a canonical reporting view over completed individual sales and posted daily batches, with business-date semantics per source, so sales reports and dashboard sales metrics can consume a single non-duplicating source. Collections, payments and receivables remain individual-sale/customer-payment measures and will not include unverified batch revenue.

The database owns batch numbering, branch authorization, date and price checks, quantity precision, combined stock validation, line/batch totals, posting idempotency, movement creation, and reversal. Server actions provide authenticated entry points; RLS permits scoped reads while direct writes are revoked. Product lookup remains the existing shared component. Repeated variants remain separate lines.

## Phase 4 implementation delivered in the worktree

1. Added `20260928010000_daily_sales_batches.sql`: batch and line tables, sequence, scoped read RLS, immutable posted history, guarded RPCs for draft/post/reverse, movement auditing, a one-standard-post-per-branch/date unique index, and reporting/dashboard revenue integration.
2. Added `/app/daily-sales` list, create, detail and draft-edit routes. The form supports branch/date, product/variant search, repeated lines, actual selling prices, decimal-aware quantity steps, live totals, draft persistence, additional batches and reversed-batch correction drafts.
3. Added `daily_sales.*` navigation/permission codes and role grants: Owner/Super Admin can read/create/edit/post/reverse/company-read; Branch Manager can read/create/edit/post only. Existing individual sale, collections, customer balances and receivables flows are kept separate.
4. Added `supabase/tests/daily_sales_phase4.sql` for role permissions, direct-write denial, repeated lines, draft no-stock behavior, posting, idempotency, stock shortage atomicity, reporting separation, reversal, and backdate/future-date rules. No mutation-gated E2E test was added in this phase; browser/database E2E remains outstanding.
5. Added `docs/daily-sales-batches.md` with role permissions, close workflow, additional/correction batches, stock/reporting semantics, and troubleshooting.
6. Did not reset data, apply the migration, push, or deploy.

## Verification run for this worktree

- `pnpm typecheck`: passed after adding all routes and server/client components.
- Scoped ESLint on daily-sales routes/components plus modified stock-movement/navigation/auth files: passed.
- `git diff --check`: no whitespace errors; Git printed only existing Windows line-ending conversion warnings.
- `pnpm test -- tests/unit/money.test.ts`: blocked before test collection by Vite/Rolldown `spawn EPERM` in `optimizeSafeRealPathSync`.
- `pnpm build`: blocked because the environment cannot fetch the existing Google Fonts (`DM Serif Display`, `Geist`, `Geist Mono`). This is an environment/network blocker, not a reported code compile failure; the optimized build is not verified.
- Supabase CLI status: blocked while trying to write `C:\Users\Thoma\.supabase\telemetry.json` (`EPERM`, outside the project writable area). Therefore the migration and pgTAP suite have not been applied or executed. No attempt was made to change CLI telemetry or access rights.
- Full regression, SQL lint/pgTAP, inventory and daily-sales concurrency, mutation-gated E2E, UI/browser review, and production build remain unverified. Phase 3 limitations above remain in force.

**Release status: NOT READY for staging or production until the migration is reviewed/applied to an isolated local database and pgTAP plus end-to-end/concurrency checks pass.**

## Remaining Phase 3 / baseline verification gaps

Receipt concurrency, mutation-gated purchasing E2E, full regression/concurrency matrix, and production build are not verified in the existing Phase 3 report. Vitest and Supabase CLI execution have environment startup blockers recorded above. These are release limitations until independently rerun; they will not be represented as Phase 4 passes.
