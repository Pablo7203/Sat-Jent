# Inventory operations runbook

## Opening stock

Open Inventory → Opening stock, choose the active branch, enter several SKU quantities and optional minimum levels, add a confirmation note, and post once. Verify the balance and `OPENING_STOCK` movement. Correct a posted opening balance with a Data Correction adjustment; never post opening stock again.

## Adjustments

Create a draft for the branch and choose the reason. Damaged, Broken, and Missing are decreases; Found Stock is an increase; Data Correction and Other allow either direction. Add the required note, review availability, then complete. A failure leaves the whole draft unposted. Correct completed work with another adjustment.

## Stock counts

Create a count, choose variants, and start it to capture system quantities. Enter each physical quantity, review signed variances, then complete. Included variants are locked against conflicting manual mutations while active. A concurrency warning requires investigation or a restarted count.

## Investigation

Use Inventory → Movements to trace signed changes and before/after balances. Run `select * from public.inventory_integrity_issues();` through an authorized diagnostic session. Any result is an integrity incident: preserve evidence, investigate, and apply only an approved auditable correction.

Never directly update `quantity_on_hand`, insert or alter ledger rows, delete movements, use a service-role client for ordinary inventory work, or repair mismatches silently.
