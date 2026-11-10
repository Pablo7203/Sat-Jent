# SAT-J Commerce — Product direction

This folder is an isolated continuation of SAT-J Ent. The original `SAT-J` project remains untouched. This working copy includes the source tree and current uncommitted project work, but excludes `.git`, installed dependencies, build caches, and `.env.local`.

## Product goal

Turn SAT-J’s existing multi-branch management application into a unified commerce platform:

- **Customer storefront:** product discovery, branch-aware basket and checkout, order request confirmation, account/order history and project enquiries.
- **Staff operations:** product, pricing and inventory administration; purchasing and receiving; fulfilment; customer support; reporting and branch performance.
- **Shared operational data:** orders, products, stock, branch fulfilment and payments should use trusted server/database workflows and one source of truth.

SAT-J operates three branches. Exact branch locations, delivery coverage, payment methods, fulfilment promises and customer policies need confirmation before they are published or enabled.

## Product principles

1. Protect and extend the working management system; do not recreate its inventory, purchasing, transfer, role or reporting logic in the browser.
2. Treat displayed prices and stock as read-only projections. Checkout must re-check price, branch and stock in PostgreSQL.
3. Keep order acceptance, payment, picking, dispatch and customer collection/delivery as explicit states.
4. Do not expose private costs, customer data, exact stock or internal transaction records through public RPCs.
5. Keep the storefront useful on mobile, accessible, quick to browse and clear about units, variant choices and branch availability.
6. Use synthetic data in design and testing until SAT-J authorises the use of business records.

## Delivery sequence

### Foundation

- Separate working copy and project identity.
- Storefront homepage, navigation, catalogue and product detail.
- Branch-specific public stock/price projections remain the source for browsing.

### Buying journey

- Persistent basket with variant and unit details.
- Checkout with a selected branch, contact information, availability revalidation, server-side rate limits, idempotent order request creation and a customer confirmation reference.
- Staff review of online requests and conversion into an existing sales draft; stock is only deducted by the existing sale completion transaction.
- Payment integration only after the provider, credentials, merchant account, refund rules and Ghana payment methods are confirmed.

### Staff commerce operations

- Permission-scoped online order queue and order detail.
- Accept/reject, picking, ready-for-collection, dispatch and completion states.
- Link accepted orders to inventory movements and payment records without double-posting.
- Customer communication and branch fulfilment reporting.

### Release readiness

- Customer and staff usability review, security/RLS tests, concurrency tests, accessibility and responsive checks.
- Isolated database test environment, staging deployment, backup/restore and operational training.
- Business approval of privacy, return/refund, collection/delivery, stock reservation and payment policies.

## First implementation slice

The storefront now includes the root home, public catalogue, persistent basket, branch-specific order request checkout, and a staff queue for review and sales-draft creation. Online payment and stock reservation are not included. Staff still confirm current price and stock through the existing sales workflow before completing a sale.
