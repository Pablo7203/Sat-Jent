# Purchasing

Phase 4 implements the inbound flow from supplier through purchase, physical receipt, inventory posting, and supplier payment.

## Supplier model

Suppliers are company master records with concurrency-safe `SUP-000001` references. Similar names are allowed. Archiving uses `is_active`; historical documents remain intact. Creation, updates, archive, and reactivation are audited.

## Purchase lifecycle and costs

Purchases use `DRAFT`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`, and `CANCELLED`. Items reference product variants. Drafting or ordering never changes stock. Quantities reuse Phase 3 unit rules; costs use `numeric(14,2)`. Database logic calculates lines, subtotal, purchase adjustments, total, payments, and balance. Purchase costs never overwrite selling prices and remain available for future valuation and COGS work.

Only unreceived draft or ordered purchases can be cancelled. Posted receipts and payments are immutable.

## Goods receiving

`receive_purchase` locks the purchase and lines, verifies permission and branch, rejects quantities above the remainder, creates a GRN, calls private `inventory_apply_movement`, records `PURCHASE_RECEIPT`, updates receipt state, and audits in one transaction. An operation UUID makes retries idempotent. Partial deliveries create separate GRNs and movements.

Incorrect receipts must not be edited. Preserve the evidence, document the error, and use a future controlled return/reversal workflow.

## Payments and balances

`record_supplier_payment` accepts positive purchase-specific payments using controlled methods. It locks and validates the purchase, rejects overpayment, records an immutable `SPY` document, and updates the controlled payment summary atomically. Supplier balance is a secured aggregate of non-cancelled purchase balances. Credits and prepayments are out of scope.

## Security

Supplier reads require `suppliers.read`. Operational reads require their permission plus `can_access_branch`. Writes use authenticated security-definer functions with empty search paths; application roles have no direct table writes. SALES has no purchasing access. INVENTORY can read suppliers and assigned-branch purchases and receive goods only.
