# SAT-J Owner-Focused Phase 3 Audit

**Scope:** Existing purchasing refinement, purchase orders, goods receiving, actual buying-cost capture, standard selling-price review/update, inventory integration and supplier balances. This continues the current SAT-J application and preserves the Phase 1/2 and accumulated local business data.

## Executive summary

Phase 3 reuses the existing suppliers, purchase orders, purchase items, goods receipts, payments, product variants/Item Codes, effective-dated prices and branch inventory ledger. It does not add a second purchasing module or a general ledger. New purchases recognize the operational supplier payable only when receipt quantities are posted, at their actual receipt costs; a PO alone is not a payable or a stock movement. Existing purchases retain their prior order-value balance treatment and are marked as legacy so their amounts are not fabricated or silently rewritten.

Forward-only migrations through `20260925013000_allow_incomplete_purchase_order_drafts.sql` were applied to the local Supabase database. No reset, branch switch, commit, push, staging deployment or production operation was performed.

## Repository/schema findings

- The base schema already had purchase orders, agreed per-unit PO costs, multiple goods receipts, supplier payments, branch permissions, stock movements, audit history, and the shared product lookup/pricing infrastructure.
- Receipts were already atomic and idempotent but did not save actual unit buying cost or receipt value. The old receipt RPC could bypass that requirement, so authenticated access was revoked for it.
- Supplier balances previously recognized the whole PO at creation. That is preserved for pre-existing transactions; new POs use actual receipt costs as the recognized payable basis.
- Inventory remains projection/ledger-backed. Only the receipt posting RPC applies a `PURCHASE_RECEIPT` movement, scoped to the PO's branch. Drafting/confirming an order never adjusts stock.
- Existing effective-dated price records are reused. An explicit receipt-time option updates a company or receiving-branch price through the established permission-checked price-change routine; it is never inferred from buying cost.

## Workflow delivered

1. The Purchases list retains supplier, branch, date/status/payment filters and pagination.
2. An authorized user selects an active supplier and an accessible active receiving branch, then uses the Phase 2 Item Code/name/variant autocomplete to add exact sellable variants.
3. Quantity and agreed buying price are entered per unit. Drafts can now be saved before lines are complete (including a header-only draft); incomplete rows are not stored as invalid placeholder lines. Confirmation requires at least one complete, valid product line.
4. A confirmed PO remains `ORDERED`; it does not make stock or payable balances appear.
5. Receiving loads only outstanding lines from that PO. It shows ordered/previously received/outstanding quantity, agreed cost, actual cost, value at actual cost, the current applicable selling price, and—when permitted—an optional company or branch price change.
6. Receipt date cannot be future-dated. The UI limits backdating to Owner/Super Admin and the database remains authoritative. Posting validates branch, permission, quantities, costs, zero-cost reason, and selected price updates in one transaction.
7. Partial receipts may be posted multiple times; the status becomes `PARTIALLY_RECEIVED` until no ordered quantity remains, then `RECEIVED`. Reusing an operation key does not duplicate stock. Receipts retain both PO agreed cost and actual cost snapshots.
8. Purchase detail and supplier detail show ordered value separately from the recognized payable, paid amount, due balance, receipt history, actual receipt costs/values, and receipt stock-movement links.

## Cost, payable, price, and inventory policy

| Value                    | Meaning                                                                               | When it changes                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| PO agreed unit cost      | Supplier's agreed buying price on the purchase line                                   | Saved with a draft/confirmed PO; never overwritten by receipt variance                       |
| Actual receipt unit cost | Actual cost for a quantity delivered on one receipt                                   | Captured for each posted receipt line; historic unknowns remain `NULL`                       |
| Receipt value            | Received quantity × actual receipt unit cost, rounded to GHS cents                    | Stored as an immutable receipt-line snapshot                                                 |
| Standard selling price   | Existing effective-dated retail price; company or branch scope                        | Changes only when an authorized user explicitly opts in while posting a receipt              |
| Supplier payable         | Operational obligation recognized for received goods, less recorded supplier payments | New PO: increases by actual receipt value; legacy PO: original existing balance is preserved |
| Branch stock             | Current quantity backed by the stock movement ledger                                  | Increases only by posted receipt quantity, at the purchase's receiving branch                |

Zero-cost receipt lines require a reason. Selling-price changes are not automatic and historical sales/receipt snapshots remain unchanged. Supplier payments reduce the supplier payable; they are not classified as operating expenses by this change.

## Migrations and historical data

- `20260925010000_purchasing_receipt_cost_refinement.sql`: new payable basis/value; actual/agreed cost and receipt-value snapshots; current-price lookup; editable draft/combined save-confirm RPC; cost-aware transactional receipt RPC; historical balance backfill preserves existing amounts; receipt movement date support.
- `20260925011000_disable_legacy_costless_receipt_rpc.sql`: prevents authenticated calls to the former receipt API from bypassing actual-cost capture.
- `20260925012000_supplier_payments_use_recognized_payable.sql`: limits supplier payment posting to the recognized payable and checks authorization before retry handling.
- `20260925013000_allow_incomplete_purchase_order_drafts.sql`: permits empty/incomplete drafts while preventing empty orders from being confirmed.
- Historical goods-receipt actual cost is intentionally not inferred from PO cost. Legacy receipts display “Not captured on legacy receipt.” Existing payable values are backfilled exactly from amount paid plus prior balance due.

## Security and audit boundaries

- Server pages/actions continue to use existing permission checks and Supabase session clients; no service-role key was added to the purchasing workflow.
- Security-definer RPCs repeat purchase permission and branch-scope checks. The PO branch controls receiving stock; client branch IDs cannot redirect it.
- Price updates use the existing `product_prices.manage` check, including branch scope checks; an unauthorized price update aborts the entire receipt transaction rather than partially receiving stock.
- The costless receipt RPC is no longer callable by authenticated users. Stock table writes remain unavailable directly; receipt movement and quantity change remain transactional.
- Existing supplier, purchase, receipt and payment audit records are retained. Receipt audit metadata includes receipt value, cost variance, branch, supplier, date and payable basis.

## Verification performed

| Check                                                              | Result                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local forward-only migration up                                    | **PASS** — applied `20260925013000_allow_incomplete_purchase_order_drafts.sql`; no reset                                                                                                                                                                                                    |
| Focused local pgTAP purchasing suite                               | **PASS — 64 assertions** — draft-only empty PO, confirmed-empty rejection, zero stock on PO, partial/full receipts, actual-cost payable and payment handling, unauthorized price update atomicity, authorized effective price update/history, branch/role, idempotency and ledger integrity |
| `pnpm typecheck`                                                   | **PASS**                                                                                                                                                                                                                                                                                    |
| `pnpm lint`                                                        | **PASS**                                                                                                                                                                                                                                                                                    |
| `pnpm test`                                                        | **PASS** — 11 files, 35 tests (includes decimal-safe money tests)                                                                                                                                                                                                                           |
| Existing Chromium Item Code lookup against `http://localhost:3000` | **PASS — 1 test** (read-only authenticated search at an authorized branch)                                                                                                                                                                                                                  |
| Purchasing Playwright flow                                         | Added but **not run** by default; requires `E2E_PURCHASING_MUTATIONS=true` and a dedicated isolated local E2E DB because it posts a real receipt/stock movement                                                                                                                             |
| Full regression/concurrency suites                                 | Not run as part of this phase; see limitations                                                                                                                                                                                                                                              |

The earlier first pgTAP invocation ran all 64 assertions without failures but reported a mistaken expected test count of 65; the plan was corrected to 64 and the suite reran green. The local dev app was left running; no server was stopped or restarted.

## Known limitations and follow-up

- The new Playwright flow is intentionally gated. Do not enable it against the accumulated day-to-day local database; configure a separate disposable local E2E database first.
- Receipt concurrency was not stress-tested with two concurrent API calls. The RPC locks the purchase row and each inventory ledger movement remains transactional, but run a dedicated disposable-DB concurrency test before relying on a quantified concurrency claim.
- A full production build and full existing E2E/regression matrix were not run here. Previous-phase concerns remain: Google Fonts may require external network access during build, and prior E2E work recorded transfer-dispatch/mobile-CSV observations in the Phase 1/2 audit.
- Existing purchasing reports/dashboard already expose ordered purchase value and pending receipts. A dedicated report/export separating actual received value from ordered value is not added here; do not treat PO totals as cash paid or actual receipt value.
- No weighted-average costing, profitability, general-ledger accounting, or sales batch engine is part of this phase. The saved cost history is intended to support the later costing phase.
- No staging/production migration, release, push, or deployment is included.

## Files changed for Phase 3

- `src/features/purchasing/actions.ts`
- `src/features/purchasing/forms.tsx`
- `src/features/inventory/product-lookup.tsx`
- `src/app/api/app/product-lookup/route.ts`
- `src/app/app/purchases/page.tsx`
- `src/app/app/purchases/new/page.tsx`
- `src/app/app/purchases/[id]/page.tsx`
- `src/app/app/purchases/[id]/edit/page.tsx`
- `src/app/app/purchases/[id]/receive/page.tsx`
- `src/app/app/inventory/movements/page.tsx`
- `src/app/app/suppliers/[id]/page.tsx`
- `src/lib/money.ts`
- `supabase/migrations/20260925010000_purchasing_receipt_cost_refinement.sql`
- `supabase/migrations/20260925011000_disable_legacy_costless_receipt_rpc.sql`
- `supabase/migrations/20260925012000_supplier_payments_use_recognized_payable.sql`
- `supabase/migrations/20260925013000_allow_incomplete_purchase_order_drafts.sql`
- `supabase/tests/purchasing_phase4.sql`
- `tests/unit/money.test.ts`
- `tests/e2e/purchasing-phase3.spec.ts`

## Readiness

**PASS WITH LIMITATIONS for local Phase 3 implementation.** Do not call this a production release: the guarded purchasing E2E flow, concurrent receipt stress test, full regression matrix and production build remain outstanding. Phase 4 work should proceed only after this local scope is reviewed; no deployment has occurred.
