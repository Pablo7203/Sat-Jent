# Stock transfer runbook

## Create and submit

1. Open **Stock transfers → New transfer**.
2. Choose an authorized source and a different active destination.
3. Add variants and requested quantities. Review the advisory source-stock list.
4. Save a draft for later editing or save and submit the request.

Drafts and requests do not change inventory.

## Approve and dispatch

A source branch manager reviews a `REQUESTED` transfer and approves the requested quantities. Approval does not reserve stock. At dispatch, source staff review the full quantity and explicitly confirm. Current stock is checked at that moment; if any item is short, nothing is dispatched.

Successful dispatch changes the status to `DISPATCHED`, writes `TRANSFER_OUT`, and exposes quantities as in transit. Destination available stock remains unchanged.

## Receive

Destination staff compare the physical delivery with every dispatched line before selecting **Confirm full receipt**. Successful receipt writes `TRANSFER_IN` and makes the stock available at the destination.

If goods are short or damaged, do not confirm receipt and do not edit stock manually. Keep the transfer in transit and escalate for a future discrepancy or return workflow. Phase 6 does not support short receipt.

## Cancellation and review

Authorized source managers can cancel `DRAFT`, `REQUESTED`, or `APPROVED` transfers with a reason. A dispatched transfer cannot be cancelled because its stock is already in transit. Use transfer filters and the inventory in-transit card to review outstanding deliveries.

Never directly edit inventory balances or insert movements. Those actions bypass locking, reconciliation, and audit controls and are denied by database privileges.
