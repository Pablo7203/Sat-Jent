# Reporting model

Phase 7 reporting is an operational layer over the transaction ledger. PostgreSQL security-definer functions aggregate only after checking the caller's reporting permission and branch assignment; the browser never receives unrestricted rows.

## Metric definitions

- **Sales revenue** is `sales.total_amount` for completed sales whose `completed_at`, interpreted in `Africa/Accra`, falls in the selected inclusive range. Draft and cancelled sales are excluded.
- **Customer collections** are posted customer payments received in the selected period. Collections are cash receipts, not revenue.
- **Purchases** are non-cancelled purchase document totals dated in the selected period.
- **Supplier payments** are payments made in the period, not purchase value.
- **Receivables** are current positive balances on completed sales for named customers. Walk-ins are excluded from aging.
- **Inventory health** compares current branch inventory with its configured minimum; it is a point-in-time measure.
- **In transit** is dispatched quantity less received quantity on transfers currently dispatched.

Prior comparisons use the immediately preceding range of equal inclusive duration. A zero prior value becomes “no comparable prior data”; infinity is never shown.

Profit, margin, COGS, and inventory valuation are intentionally absent because no approved costing method exists. Product ranking is labelled **Product Line Value**: it uses historical sale-line snapshots and line totals before sale-level discounts, which are not allocated back to products. It must not be interpreted as net revenue.

## Security and exports

Company reports require `reports.company.read`; branch reports require `reports.branch.read` plus branch access. CSV also requires `reports.export`. Export calls the same scoped loader as the visible table, caps detailed sales at 1,000 rows, disables shared caching, escapes CSV content, and neutralizes spreadsheet formulas.

All period boundaries use the named `Africa/Accra` timezone. URLs preserve `from`, `to`, and optional `branch` filters.
