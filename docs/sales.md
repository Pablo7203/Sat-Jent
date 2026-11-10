# Sales

Phase 5 implements the outbound flow from customer selection through sale completion, inventory reduction, payment, receipt, receivable settlement, reversal, and controlled cancellation.

## Customers and Walk-In

Customers are company master records with concurrency-safe `CUS-000001` references and controlled types. Normal records may be archived but remain visible historically. One seeded `WALK-IN` system customer is protected from editing and archiving. Walk-In sales must be fully paid at completion; partial or credit sales require a named customer.

## Sale lifecycle and pricing

Sales are `DRAFT`, `COMPLETED`, or `CANCELLED`. Drafts create no receipt, payment, debt, or stock movement. Items reference product variants and snapshot product, variant, SKU, unit, suggested price, actual price, discounts, and totals. The price resolver chooses an effective branch price before the company default for the requested `RETAIL` or `WHOLESALE` type. Missing prices are errors. Overrides require `sales.price_override` plus a reason; discounts require `sales.discount` and a reason.

Line total is quantity multiplied by actual unit price, less line discount. Sale subtotal is the sum of line totals. Total is subtotal less sale discount plus tax; tax remains zero until configured.

## Atomic completion and inventory

`complete_sale` locks the draft, checks active customer and branch access, validates Walk-In/payment rules and sensitive pricing permissions, processes variants in deterministic order, and calls private `inventory_apply_movement` for negative `SALE` movements. The inventory core locks each balance and rejects negative stock. Initial payment, derived balance/status, `RCP` receipt, and audit event commit in the same transaction. The completion operation UUID makes retries idempotent.

## Payments and receivables

Customer payments are immutable `CPY` records using the same controlled payment methods as supplier payments. Multiple posted payments may settle a sale over time. Overpayment is rejected under a sale lock. Payment reversal marks the original record `REVERSED`, requires permission and a reason, and restores the sale balance atomically. Receivables and customer balances derive only from completed, accessible, named-customer sales. A balance is overdue when it is positive and its explicit due date precedes the current date.

## Cancellation

Drafts may be cancelled without inventory effects. A completed sale may be cancelled only by an authorized user after all posted payments have been reversed. Each original sale item receives an immutable positive `SALE_REVERSAL`; original `SALE` movements remain. Cancellation is for erroneous transactions, not customer returns or exchanges.

## Security and receipts

Sales, payments, and receivables require permission plus `can_access_branch`. Application roles have no direct write grants to transaction tables or inventory. The print receipt uses stored transaction snapshots rather than mutable catalogue prices. PDF generation is not introduced in this phase.
