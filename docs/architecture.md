# SAT-J Ent Architecture

Phase 8 adds a server-rendered public surface alongside, not inside, the authenticated `/app` shell. Anonymous data access uses narrow security-definer JSON projections. The storage bucket is private with object reads restricted to imagery registered against active public products. Public quotations are write-only and internal status transitions remain permission, branch, and audit controlled.

Phase 4 adds an inbound purchasing context. Reads use branch-aware RLS; commands use narrow database transactions. `receive_purchase` composes with private Phase 3 inventory mutation so GRNs and `PURCHASE_RECEIPT` ledger entries commit or roll back together. Balances are controlled or derived, never user-editable accounting fields.

Phase 5 adds the outbound sales context. Effective price resolution, immutable item snapshots, row-locked inventory reduction, optional initial payment, receivable state, and receipt generation share one completion transaction. Later payment, reversal, and cancellation are separate locked commands. `SALE` and `SALE_REVERSAL` remain part of the Phase 3 ledger.

Phase 6 adds inter-branch transfers using the same immutable inventory ledger. Dispatch and receipt are separate locked transactions: `TRANSFER_OUT` reduces the source, derived in-transit state represents the physical journey, and `TRANSFER_IN` increases the destination. Operation keys prevent repeated dispatch or receipt. No editable transit balance exists.

## Modular monolith

SAT-J Ent is one well-structured Next.js application. The App Router hosts the temporary public landing page and internal portal, while cohesive feature folders will contain later business capabilities. This preserves simple deployments and transactions without premature microservices, message brokers, GraphQL, CQRS, event sourcing, Redis, Kafka, or a separate API server.

## Platform responsibilities

- **Next.js:** routing, rendering, accessible UI, server-side workflow orchestration, and trusted boundaries.
- **Supabase:** PostgreSQL, authentication, object storage, and managed platform integration.
- **PostgreSQL:** authoritative business datastore and final integrity boundary.

Server Components are preferred. Client Components are limited to browser APIs, interaction, local state, and hooks. Sensitive future queries should run in trusted server-side code or through RLS-protected access; no generic API abstraction is required merely for appearance.

## Security and branch isolation

Phase 1 uses cookie-based Supabase SSR with `proxy.ts` refreshing tokens through verified claims. A server-only authorization layer verifies identity, active profile, system role, permissions, and branch assignments close to protected data. PostgreSQL RLS repeats these controls through `has_permission` and `can_access_branch`. Service-role credentials remain isolated to Auth invitation/bootstrap operations and are never a general RLS bypass.

Profiles map one-to-one to `auth.users` and default inactive with no role. Roles have COMPANY or BRANCH scope. COMPANY roles see permitted company data; BRANCH roles require active `user_branches` assignments. The browser's selected branch is only UI context and never authorization proof.

Password recovery uses Supabase's PKCE code exchange at `/auth/callback`. Internal routes are dynamic and protected; authenticated accounts without a valid SAT-J Ent configuration are routed to `/access-denied`.

## Data and transaction rules

1. PostgreSQL is authoritative.
2. Operational data will be protected by RLS.
3. Inventory-affecting business transactions must be atomic.
4. Inventory will be ledger-driven; stock totals are derived or transactionally maintained from movements.
5. Critical workflows may use controlled PostgreSQL functions/RPC where atomicity benefits.
6. Important completed production records are never silently deleted; use explicit reversal/status workflows.
7. Shared-environment migrations are append-only and version controlled.
8. Record identifiers use UUIDs. Human transaction numbers (such as `SAL-2026-000001`) are separate identifiers implemented later.
9. Database timestamps are stored in UTC and displayed in the operational timezone, `Africa/Accra`.
10. The operating currency is GHS. Financial database values use precise decimals; JavaScript floating-point arithmetic is not used casually for money.

## Product master

Phase 2 introduces a company-wide catalogue. `products` describe a product while `product_variants` are the operational sellable units identified by case-insensitively unique SKUs and optional barcodes. Reference data is normalized and deactivated instead of hard-deleted. Effective-dated prices preserve history and are changed through an atomic PostgreSQL function. Product images use the public-read `product-images` bucket; authenticated writes require `product_images.manage` and a path owned by an existing product. See `product-master.md`.

## Inventory

Phase 3 inventory is identified by branch plus product variant. `branch_inventory` is a locked query balance; `stock_movements` is its immutable explanation. Only workflow-specific security-definer functions may call the private movement primitive. They validate permissions, branch access, active records, unit precision, count locks, and non-negative results before updating the balance and ledger atomically. Company totals are derived, never stored. See `inventory.md`.

Business transaction dates are database-authoritative. Super Admin and Owner roles may record missed sales, purchases, and customer or supplier payments using today or an earlier date. Other roles are fixed to today, and future transaction dates are rejected for every role.

## Validation

Client validation improves usability. Server validation provides security. Database constraints preserve integrity. No business workflow may rely exclusively on the client.

## Environment strategy

Local, preview/staging, and production use distinct credentials and data. Browser-safe configuration uses the `NEXT_PUBLIC_` prefix. Private credentials never enter client components, logs, API responses, or error messages. Production credentials are not routine local-development credentials.

## Migrations

All material schema changes are timestamped SQL migrations in `supabase/migrations`. Dashboard-only schema edits are prohibited. Deployed history is immutable; fixes use a new migration. Phase 0 intentionally contains no fake business schema.

## Testing philosophy

Fast unit/component tests cover pure validation and reusable UI. Integration tests will cover Supabase boundaries. Playwright covers critical user journeys and responsive route smoke tests. CI requires typecheck, lint, unit tests, and production build; browser tests run separately due to binary cost.

## Security headers

The application sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict-origin referrer policy, and disables camera, microphone, and geolocation permissions. CSP is deferred until real Supabase, Vercel, image, and script origins can be tested without breaking the application.
