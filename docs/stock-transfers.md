# Stock transfers

Phase 6 moves variant stock between branches through `DRAFT → REQUESTED → APPROVED → DISPATCHED → RECEIVED`. An un-dispatched transfer may instead become `CANCELLED`. Source and destination must differ and both must be active when a transfer is created.

## Inventory behaviour

- Draft, request, and approval do not reserve or alter inventory.
- Dispatch validates current source stock and writes a negative `TRANSFER_OUT` through the Phase 3 ledger transaction.
- Dispatched quantity is in transit and unavailable at either branch.
- Full receipt writes an equal positive `TRANSFER_IN` at the destination.
- A received transfer therefore has zero net company movement.

In-transit stock is derived as `dispatched_quantity - received_quantity`. It is not an editable balance and is never included in destination `quantity_on_hand` before receipt.

## Quantities and lifecycle protection

Transfers are variant-based and a variant appears once per transfer. Phase 3 unit rules govern decimal quantities. Approval accepts requested quantities in full. Phase 6 deliberately supports only full dispatch and full receipt.

Dispatch and receipt lock the transfer and invoke the shared inventory row-locking function in variant order. Operation UUIDs make identical retries idempotent. A failure on any item rolls back the entire operation. Dispatched and received transfers cannot be edited, and a dispatched transfer cannot be cancelled.

## Branch authorization

- Creation, approval, dispatch, and cancellation require source-branch access.
- Receipt requires destination-branch access.
- Reading requires access to either branch plus `transfers.read`.
- The destination may be any active company branch during creation.
- Normal users cannot write transfer records, statuses, inventory balances, or transfer movements directly.

`SUPER_ADMIN` and `OWNER` have all transfer permissions. `BRANCH_MANAGER` has all within assigned scope. `INVENTORY` can read, create, dispatch, and receive, but cannot approve or cancel. `SALES` has read-only transfer access.
