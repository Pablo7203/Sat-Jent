# SAT-J Commerce

An isolated commerce and store operations project for SAT-J Ent. It starts from the existing three-branch SAT-J management application and adds a customer-facing storefront in the same project. The original `SAT-J` folder is kept separate.

## Current capabilities

- Public home page, catalogue, product details, category browsing, branch information and contact pages.
- A protected staff portal for catalogue, inventory, purchasing, sales, transfers, customers and reporting.
- A persistent basket and branch-specific order request checkout. Staff can review requests and create a sales draft in the protected portal.
- Public catalogue data is read through curated database functions. Internal costs, private records and exact inventory remain in the staff system.
- Storefront pages are enabled by default in this project. Set `PUBLIC_WEBSITE_ENABLED=false` to take them offline.

## Run locally

1. Install the supported Node.js 22 and pnpm 10 versions.
2. Copy `.env.example` to `.env.local` and configure a dedicated Supabase URL, publishable key, site URL and server-only service role key. The order-request API needs the service role key and never sends it to the browser.
3. Apply the reviewed migrations to an isolated development database with `pnpm db:reset`.
4. Configure the three real SAT-J branches, public catalogue products, selling prices and branch stock in that isolated environment. Set “Show on public website” for branches and products intended to appear to customers.
5. Start the site with `pnpm dev`.

Never copy production credentials or customer records into local development. Use synthetic data until SAT-J has approved a safe data workflow.

## Commerce roadmap

See [`docs/commerce-roadmap.md`](docs/commerce-roadmap.md) for the delivery sequence and the business decisions needed before online payment, stock reservation, delivery or customer order history can be enabled. Public quotation writes remain disabled.
