# SAT-J Commerce

An isolated commerce and store operations project for SAT-J Ent. It starts from the existing three-branch SAT-J management application and adds a customer-facing storefront in the same project. The original SAT-J folder is kept separate.

## Current capabilities

- Public home page, catalogue, product details, category browsing, branch information and contact pages.
- A protected staff portal for catalogue, inventory, purchasing, sales, transfers, customers and reporting.
- Customer checkout for branch collection or delivery, with Paystack online payment or pay on delivery.
- Server-verified Paystack transactions, private customer order tracking links, and a permission-scoped staff order queue with fulfilment status history.
- Public catalogue data is read through curated database functions. Internal costs, private records and exact inventory remain in the staff system.
- Storefront pages are enabled by default in this project. Set PUBLIC_WEBSITE_ENABLED=false to take them offline.

Web checkout rechecks branch availability and current prices in PostgreSQL. It does not reserve stock or automatically post the order into the existing POS sales and inventory ledger, so POS sales and stock reports will not include these orders automatically. Delivery coverage and fees are also not configured because SAT-J has not provided those rules yet.

## Configure Paystack

Set these server-only variables in .env.local for development and in the SAT-J Vercel project for each environment:

- PAYSTACK_SECRET_KEY: the Paystack API secret key. Never expose it with a NEXT_PUBLIC_ variable.
- PAYSTACK_WEBHOOK_SECRET: the signing secret configured for the Paystack webhook.

Paystack's callback URL is generated from the active SAT-J site origin. Configure the webhook in the Paystack dashboard to point to:

https://<your-sat-j-domain>/api/webhooks/paystack

Use Paystack test credentials in development and staging. Paystack transactions are initialized and verified by server routes; a browser redirect alone cannot mark an order paid.

## Run locally

1. Install the supported Node.js 22 and pnpm 10 versions.
2. Copy .env.example to .env.local and configure a dedicated Supabase URL, publishable key, site URL, server-only service role key, and Paystack test keys.
3. Apply the reviewed migrations to an isolated development database with pnpm db:reset.
4. Configure the three SAT-J branches, public catalogue products, selling prices and branch stock in that isolated environment. Set “Show on public website” for branches and products intended to appear to customers.
5. Start the site with pnpm dev.

Never copy production credentials or customer records into local development. Use synthetic data until SAT-J has approved a safe data workflow.

## Commerce roadmap

See [docs/commerce-roadmap.md](docs/commerce-roadmap.md) for current implementation and remaining decisions before an operational launch.
