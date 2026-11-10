# Owner-focused redevelopment — Phase 1 audit

## Scope and safety

This phase refocuses the existing Next.js/Supabase application. It does not replace its architecture, delete business data, or edit an applied migration. Business database changes are limited to a new forward migration that revokes anonymous execution of the two public quotation-submission RPCs. Existing authenticated quotation-management operations remain available.

## Repository findings

- The application is a Next.js App Router monolith. `/app/**` is protected by `requireActiveProfile()` in the internal layout; sensitive server actions and data operations perform their own permission checks, and Supabase RLS/transaction RPCs remain the authoritative branch/security boundary.
- Existing operation routes cover products/catalogue setup, inventory adjustments/counts/opening stock/movements, purchase orders and receipts, sales and customer payments, transfers, reports, suppliers/customers, branches and user access. Automated coverage exists in Vitest, Playwright and `supabase/tests`.
- A dedicated goods-receiving page does not exist. Receipt creation is part of a purchase detail flow at `/app/purchases/[id]/receive`; this phase exposes an “Awaiting goods” queue on the existing purchase list rather than duplicating its transaction workflow.
- The dashboard uses the `dashboard_summary` reporting RPC with role-aware company/branch selection and validation against the employee's authorized branches. Existing verified metrics include sales, collections, inventory-health counts, transfers and product-line revenue. There is no authoritative net-profit metric or reliable slow-moving/not-sold analysis in the current dashboard contract.
- Product variants currently carry SKU and sellable-unit identity. SKU is the nearest existing implementation of the owner's future item code; there is not a second item-code field. This phase leaves the schema and SKU behavior unchanged for Phase 2 review.
- Existing sales are individual sale transactions. They remain labeled as ordinary sales; no end-of-day batch workflow is claimed or implemented.
- Theme preference is stored in local storage; the internal app defaults to light mode and applies the saved dark/light selection.

## Reuse and changes

- Reused the existing App Router shell, permission context, theme toggle, dashboard cards/charts/status components, `dashboard_summary` RPC, purchase statement, and goods-receipt action/detail route.
- Simplified the sidebar into General, Daily Operations, Management, and Settings. Links are rendered only when the corresponding existing permission is present. Website settings, public quotations and audit history are no longer primary navigation links; their implementation/data are preserved.
- Added a company/branch access-scope header. Dashboard branch filtering remains server-validated; there is not yet one persistent branch selector that scopes every module.
- Added a working “Awaiting goods” purchase filter for ordered and partially received orders, plus a pending-receipt dashboard count that relies on the existing purchase statement and authenticated RLS.
- Added owner-oriented shortcuts for recording a sale, opening inventory, creating a purchase, receiving stock, transferring stock, and opening reports. Dashboard best-seller wording explicitly describes the underlying product-line revenue ranking, not profit.
- Mobile navigation now behaves as a dialog: selection closes it, Escape closes it, focus is managed around opening/closing, and page scrolling is locked while open.

## Public-site shutdown

- The server-only `PUBLIC_WEBSITE_ENABLED` flag defaults to false. The root enters `/app` (which follows the existing auth guard); explicit server-rendered guards redirect public catalogue, category, company pages and quote routes to `/login`. `proxy.ts` carries an additional route gate.
- Disabled sitemap generation returns no URLs; robots disallows crawling. The site components, route code, product visibility fields, image records, settings and quotations are preserved.
- Anonymous execution was revoked for both quotation submission RPCs, preventing direct anonymous API writes. The existing curated public-read RPCs remain callable as a deliberately public-data API: they expose only approved public catalogue data, never private products, customer/supplier records, sales or exact stock. If the business needs those APIs disabled too, that requires a separate forward migration and coordinated restore procedure; this phase does not silently change the public-data policy.
- Re-enabling pages requires `PUBLIC_WEBSITE_ENABLED=true` and a restart/rebuild. Re-enabling public RFQ submission additionally requires a reviewed forward migration restoring anonymous `EXECUTE` for the two documented RPC signatures. The setting is server-only and must not be treated as database authorization.

## Data/security risks and boundaries

- No applied migration was rewritten. No transaction tables or historical rows were deleted or rewritten. No service-role query, RLS bypass, role change or branch authorization shortcut was introduced.
- Branch context is explicit at shell/dashboard level, but the existing application is page-scoped: the dashboard and reports can filter branches independently, and other operational pages keep their own authorized branch selectors. A persistent cross-module selector is deferred rather than simulated with frontend-only filtering.
- Purchases and receipts remain atomic in the existing database workflow. A pending-receipt count is display-only; opening an item still takes the employee through existing purchase permission checks.
- Public catalogue-read RPCs are still directly callable as curated public APIs even though their Next.js pages are disabled. This is a known residual exposure by design of existing `is_public` records, not access to private operational data.

## Phase 2 candidates

1. Confirm item-code requirements and whether current SKU uniqueness/format should become owner-controlled `TIL-001`-style codes without adding a duplicate identifier.
2. Improve product search and branch-specific inventory visibility while preserving RLS.
3. Review product-level buying costs and selling-price presentation without changing current cost valuation methods in this phase.
4. Design the batch end-of-day sales workflow separately, including drafts, posting, atomic stock deduction, price overrides and correction/audit rules.

## Verification

- Passed: `pnpm typecheck`, `pnpm lint`, and `pnpm test` (10 files, 31 tests).
- Passed: the focused owner-shell responsive E2E on Chromium at 360, 390, 768, 1024 and 1440 pixels; the authenticated sign-in, opening-stock, sale and transfer E2Es also passed in the focused run. The full suite was then run against accumulated local E2E data and had two failures: the desktop transfer E2E did not show a `DISPATCHED` state after confirming dispatch, and the mobile CSV-export E2E timed out waiting for a browser download event. Other enabled tests passed; public catalogue E2Es are intentionally skipped while the public-site flag is off.
- `pnpm build` could not download the existing Geist/DM Serif Google fonts because outbound access to `fonts.googleapis.com` is unavailable in this environment. Build completion therefore remains unverified here.
- The four pending forward migrations (`20260917023000`, `20260919010000`, `20260919020000`, `20260924010000`) were applied to the local Supabase database only; no reset was performed. The new `public_site_disabled.sql` test passed. The full SQL suite ran 318 assertions across 14 files, with failures in catalog/profile lifecycle, public-catalogue row-count, purchase/report reconciliation and sales/payment reconciliation tests. The local DB contains accumulated E2E-created records, which make those existing fixture/count/reconciliation assertions unreliable; rerun against a separately initialized test database before treating them as product regressions.
- Targeted Prettier checks and `git diff --check` pass for changed files. Repository-wide `format:check` still reports numerous unrelated pre-existing files outside this phase's changes.
