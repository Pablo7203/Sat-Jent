# SAT-J Commerce — Product direction

This folder is an isolated continuation of SAT-J Ent. The original SAT-J project remains untouched. The working copy contains the commerce source and migrations; secrets and build artifacts stay out of Git.

## Product goal

Turn SAT-J’s existing multi-branch management application into a unified commerce platform:

- **Customer storefront:** product discovery, branch-aware basket and checkout, customer order tracking and project enquiries.
- **Staff operations:** product, pricing and inventory administration; purchasing and receiving; fulfilment; customer support; reporting and branch performance.
- **Shared operational data:** orders, products, stock, branch fulfilment and payments should use trusted server/database workflows and one source of truth.

SAT-J operates three branches. Delivery coverage, delivery fees, refunds and customer policies still need SAT-J's rules before the storefront can make those promises.

## Product principles

1. Protect and extend the working management system; do not recreate its inventory, purchasing, transfer, role or reporting logic in the browser.
2. Treat displayed prices and stock as read-only projections. Checkout rechecks price, branch and stock in PostgreSQL.
3. Keep payment, picking, dispatch and customer collection/delivery as explicit states.
4. Do not expose private costs, customer data, exact stock or internal transaction records through public RPCs.
5. Keep the storefront useful on mobile, accessible, quick to browse and clear about units, variant choices and branch availability.
6. Use synthetic data in design and testing until SAT-J authorises the use of business records.

## Implemented

### Customer checkout and payment

- Customers can choose branch collection or delivery.
- Paystack-hosted online payment and pay on delivery are available for delivery orders.
- Prices and branch stock are rechecked on the server. Paystack payments are verified through its transaction API and signed webhooks before an order is marked paid.
- Tracking links use random bearer tokens; the database stores only a hash. Public tracking reveals order status and item names, not customer contact details or delivery address.

### Staff fulfilment

- Staff with the existing store_orders.update permission can move an order through preparation, ready for collection or out for delivery, then delivered.
- Paystack orders cannot move through fulfilment until payment is verified.
- A pay-on-delivery order cannot be marked delivered until an employee confirms cash collection.
- The previous enquiry workflow remains available and is kept separate from paid or pay-on-delivery checkout orders.

## Remaining work before operational use

- Web checkout checks available branch stock but does not reserve it. It also does not automatically create a POS sale or inventory movement, so POS sales and stock reports will not include web orders automatically.
- Delivery coverage and delivery fees are not calculated.
- Refunds, order cancellation after online payment, customer notifications and branch-level delivery assignment are not implemented.
- The new Supabase migration must be applied to the intended staging database, and Paystack test credentials plus the webhook URL must be configured in Vercel before exercising hosted payments.

## Delivery sequence

### Foundation

- Separate working copy and project identity.
- Storefront homepage, navigation, catalogue and product detail.
- Branch-specific public stock and price projections remain the source for browsing.

### Buying journey

- Persistent basket and branch-aware checkout.
- Pay on delivery and Paystack hosted checkout with server verification.
- Customer-safe status tracking and employee fulfilment updates.
- Next: transactional stock reservation and integration with the existing sales and inventory ledger.

### Release readiness

- Confirm delivery areas, fees, refund handling and customer communication rules with SAT-J.
- Apply migrations to an isolated staging database and configure Paystack test keys and webhook.
- Review customer and staff usability, security, concurrency, accessibility and responsive layouts.
- Complete the stock-reservation/POS integration before treating the store as an operational sales channel.

## Current implementation slice

The checkout, Paystack verification, customer tracking and staff status history are implemented in the app. Stock is checked at checkout, but not reserved or deducted by the web-order flow. The web-order and existing POS accounting workflows still need to be connected before the system is used for live inventory reporting.
