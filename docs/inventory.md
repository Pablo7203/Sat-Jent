# Inventory architecture

Phase 4 adds `PURCHASE_RECEIPT`. Purchasing never directly updates `branch_inventory`; receiving calls `inventory_apply_movement`, which locks balance, writes before/after ledger evidence, and updates stock. The movement references its immutable GRN, which traces to purchase and supplier.

Phase 5 adds negative `SALE` and positive `SALE_REVERSAL` movements. Sale completion and controlled cancellation call the same private inventory primitive in deterministic variant order. Draft sales never affect inventory, concurrent overselling is rejected under row locks, and original sale movements are never edited or deleted.

Inventory is tracked for each branch and product variant. Products do not carry stock. `branch_inventory.quantity_on_hand` is a fast current balance, while signed immutable `stock_movements` explain every change with before/after balances, actor, time, reference, and reason.

Phase 3 movement types are opening stock, adjustment increase/decrease, and stock-count increase/decrease. The client cannot select arbitrary movement types. Later purchase, sale, return, and transfer modules must introduce their own permission-checked workflow functions before calling the private locked movement primitive.

Opening stock is an atomic multi-row onboarding operation. A branch/variant can be initialized only once; zero is allowed deliberately but creates no unnecessary movement. Corrections use adjustments or counts. Archived products, inactive variants, and inactive branches retain history but reject new normal mutations.

Adjustments are draft documents with one or more items and a direction-constrained reason. Only completion changes stock. The header is locked, all items are validated, balances are locked in variant order, and any failure rolls back every item. Completed adjustments cannot be edited or reposted.

Counts snapshot system balances when entering `IN_PROGRESS`. Included branch/variants reject opening stock and adjustments until reconciliation. Physical minus snapshot is the variance; non-zero variances create movements, while zero variance creates none. If an unexpected balance change is detected, completion fails and requires investigation or restart.

Quantities use `numeric(14,3)`. Units with `allows_decimal=false` reject fractional quantities. Negative balances are forbidden. Minimum levels are branch-specific. Zero is out of stock; a positive quantity at or below minimum is low stock; quantity above minimum is in stock.

Branch-scoped RLS combines `inventory.read` with `can_access_branch`. Direct balance and ledger writes have no application grants. `inventory_integrity_issues()` reports, but never repairs, differences between current balances and summed ledger deltas.

## Transfer movements and in-transit stock

`TRANSFER_OUT` is a negative source movement created only at dispatch. `TRANSFER_IN` is an equal positive destination movement created only at confirmed receipt. Between those events, stock is derived as in transit and is not part of either branch's available `quantity_on_hand`.
