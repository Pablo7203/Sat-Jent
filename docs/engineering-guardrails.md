# Engineering Guardrails

## Public website guardrails

Never expose raw product rows, product cost, supplier/customer/transaction data, raw inventory, stock movements, hidden prices, or quotation records anonymously. Never trust public quote status or publish fake contact details and claims. Always use reviewed public projections, validate quotes server-side, preserve visibility rules, optimize imagery/metadata, and keep cart, checkout, payment, delivery, and customer accounts out of Phase 8.

## Purchasing guardrails

Never increase stock on purchase creation/order, bypass the Phase 3 movement system, edit posted GRNs, delete movements, over-receive, trust client totals/balances, overpay, hard-delete suppliers with history, or rewrite payments. Always validate branch and permission, use variants and precise decimals, post only on receipt, make receipt/payment transactions atomic and idempotent, preserve history, and audit actions.

## Sales guardrails

Never reduce stock for a draft, trust browser stock or totals, recalculate historical prices from current pricing, allow Walk-In debt, permit direct movements or negative inventory, delete completed sales/payments, cancel or restore twice, overpay, or accept unauthorized overrides. Always re-check inventory under lock, complete atomically, snapshot prices and display labels, preserve payment/movement history, validate branch and permission, reconcile receivables, and test concurrent selling.

These rules apply to future engineers and Codex sessions working on SAT-J Ent.

## Security

Never:

- Disable RLS to work around a permission problem.
- Expose service-role keys or any private credential to browser code.
- Commit credentials or production environment files.
- Trust client-supplied authorization, role, branch, pricing, or ownership information.
- Return private internal fields through public endpoints.
- Log passwords, access/refresh tokens, authorization headers, cookies, keys, or secrets.
- Use the service-role client for ordinary business queries or to bypass a failing RLS policy.
- Treat `getSession()` or a client-selected branch as authoritative authorization.

## Data

Never:

- Mutate inventory without ledger records after inventory exists.
- Silently delete completed financial transactions.
- Rewrite migrations deployed to a shared environment.
- Use floating-point database columns or casual JavaScript floats for financial values.

Always store timestamps in UTC, display them in `Africa/Accra`, use precise GHS values, use UUID primary identifiers, and keep human-readable transaction numbers separate.

## Development

### Inventory integrity

- Never directly edit `branch_inventory.quantity_on_hand`, insert/delete/update ledger movements, allow negative stock, accept arbitrary client movement types, or silently repair reconciliation failures.
- Never authorize a branch from browser state or track stock against an abstract product.
- Always lock the branch/variant row, validate unit precision and branch permission, create the movement, and update the balance atomically.
- Completed adjustments and counts cannot post twice. In-progress counts lock included variants against conflicting mutations.
- Concurrency behavior must be tested with simultaneous database requests.

Always:

- Inspect existing code and Git state before editing.
- Reuse established conventions and keep feature boundaries cohesive.
- Prefer Server Components and keep secrets/server logic server-side.
- Validate untrusted input on the server and enforce integrity in PostgreSQL.
- Call centralized `requirePermission`/`requireBranchAccess` checks inside every sensitive Server Action.
- Prove authorization changes with real PostgreSQL/RLS tests before beginning a dependent phase.
- Add proportionate tests for changes.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- Run relevant Playwright tests when browser behavior changes.
- Report incomplete work and external setup accurately.

Do not add microservices, brokers, state frameworks, repository layers, or other infrastructure without a demonstrated requirement and an explicit architecture decision.

## Logging and errors

User-facing errors are actionable and do not expose stack traces or internals. Server logs may contain stable event names, request/correlation IDs, safe record IDs, status codes, and sanitized diagnostics. They must never contain credentials, authentication material, raw cookies, full payment details, or sensitive personal data.

## Stock transfer guardrails

Never decrease source stock before dispatch, increase destination stock before receipt, transfer within one branch, insert transfer movements directly, dispatch without source authority, receive without destination authority, allow negative inventory, cancel a dispatched transfer, repeat dispatch or receipt, count transit as destination availability, or mutate received quantities.

Always validate permission and branch direction, lock the transfer, process inventory rows deterministically through the Phase 3 ledger, dispatch and receive atomically, preserve movements, and reconcile source, destination, transit, and company totals.
