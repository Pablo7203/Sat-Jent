# SAT-J Owner-Focused Phase 6 Audit

**Status: Requested Phase 6 gaps implemented and locally verified; staging has not been updated.** This audit covers inventory costing, operating expenses, financial accounts, payment-ledger integration, P&L, reconciliation, and in-transit stock valuation. It does not claim external accounting certification or a staging deployment.

## Implemented locally

- **Inventory cost and WAC:** Branch/variant balances keep quantity, value, weighted-average cost, and an explicit `COMPLETE`/`MISSING` state. Existing stock and historical movement costs that cannot be established from evidence stay `MISSING`/unvalued. Cost events are replayed in chronological business-time order for late/backdated receipts; dependent sale cost snapshots are corrected only when that replay supports a value. If the replay cannot establish a complete basis, reports withhold profit rather than invent a cost.
- **New sales and purchasing costs:** Goods receipts use actual received unit cost to update WAC. Completed sales, posted daily sales batches, reversals, and inter-branch movements write cost events transactionally. A sale line’s COGS/profit remains explicitly unknown if its source cost is unknown.
- **Financial ledger:** Branch-assigned financial accounts and append-only movements are available through `/app/finance`. New initial sale collections, receivable payments, supplier payments, expense payments, and reversals post to the selected account with idempotency and audit handling. Account opening balances and statement reconciliations are recorded as ledger entries, not editable balance fields.
- **Expenses:** `/app/expenses` supports recording, approval/rejection, partial/full payment, and branch/account selection. Expense payments reduce account balances only when paid. Receipt storage is private and scoped in the database; an end-user receipt upload interaction is not yet part of the page.
- **P&L and dashboard:** `/app/finance` provides a date- and branch-filtered P&L. The executive dashboard now includes a matching profitability snapshot for Super Admins and Owners. If any sale line in the selected period has unknown COGS, gross and operating profit display as incomplete instead of estimated.
- **Transfers in transit:** The Finance page exposes dispatched quantity and value from the immutable source-branch dispatch cost event. Unknown cost is labeled `UNVALUED`; receipt applies the supported source cost when available.
- **Access control:** Finance, cost and profitability operations are permission-gated and branch-scoped. Account options are restricted to active accounts assigned to the transaction’s branch.

## Data-integrity boundaries

- Historical customer/supplier payments recorded before account selection existed are **not automatically assigned** to a cash account. Their actual destination cannot be inferred safely; they need operator reconciliation if historical ledger opening balances are required.
- Historical sale lines with missing cost remain unvalued until evidence supports a documented cost baseline/replay. No synthetic or current-price cost is substituted.
- Backdated receipt replay can invalidate downstream historical costs when the event timeline is incomplete. In that case the system preserves an explicit incomplete state and withholds profitability.
- In-transit stock without a complete dispatch-time cost is shown with no value. It is never valued using a later destination cost or an invented estimate.

## Remaining accounting extensions

These are outside the gaps closed in this local slice and should be considered before describing the product as a complete accounting package:

1. Receipt file upload/view interaction on the expense UI.
2. Inter-account cash/bank transfers and a dedicated bank-statement import/matching workflow beyond the current statement-balance reconciliation.
3. Per-product gross-margin views and finance report exports.
4. Freight/landed-cost allocation across receipt lines and treatment of later landed-cost adjustments.
5. A controlled workflow to reconcile pre-ledger historical payment rows to documented opening balances.

## Local verification

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test`: 12 files / 37 tests passed.
- `supabase test db --local`: 18 files / 502 assertions passed, covering cost replay, missing-cost safety, payment ledger entries/reversals, P&L, reconciliation, expenses, and transfer costing.
- `npm run build`: optimized Next.js production build passed, including type generation and the relocated Proxy.
- Production-mode Playwright run: 44 passed / 16 expected skips / 0 failed across desktop, mobile, and tablet projects. It covered authentication/access, product creation, stock lookup and opening stock, paid sales and receipts, transfers, dashboard/reporting, finance/expenses, exports, and disabled public-site routes.
- The opt-in purchasing E2E flow was also run against local Supabase: draft, order confirmation, and partial goods receipt passed. Its currency assertion was corrected to match the current `GH₵` display.
- E2E transaction records and seeded test identities remain in the local database for inspection; no staging push or deployment was performed.
