# SAT-J Owner-Focused Phase 2 Audit

**Scope:** Product and inventory refinement for the existing SAT-J application. This phase keeps the existing product, variant, price, inventory-ledger and transaction models; it does not replace them or backfill a parallel item-code system.

## Executive summary

Phase 2 adds an owner/staff-facing product identity and stock lookup flow, clarifies `product_variants.sku` as the owner-defined **Item Code**, improves product and inventory views around that identity, and enforces branch access for branch pricing at both the application and database boundaries. The permanent identity of an item remains the variant UUID. Existing sales, purchases, transfers, movements and audit history continue to point at that UUID; transaction snapshots are not rewritten when an Item Code is corrected.

The local database has received forward-only migrations through `20260924022000_guard_branch_price_changes.sql`. No database reset was used. No applied migration was edited. No commit, push or deployment was performed.

## Decisions grounded in the current schema

### Item Code and product identity

- An owner enters a human-readable Item Code in the existing variant SKU field. This avoids a second identifier with unclear precedence.
- The database trims leading/trailing whitespace on writes and enforces case-insensitive uniqueness across variants, including archived variants.
- Item Code changes must use the permission-checked `update_variant_item_code` RPC. The database blocks direct SKU updates; existing audit triggers capture old/new variant values.
- If the item has historical activity, the workflow requires explicit confirmation that historical transaction snapshots stay as they were. Variant UUIDs and ledger/history relationships remain unchanged.
- Product name, sellable variant/description, size, colour, unit, category, brand and images retain their existing fields and relationships. A variant represents a sellable product configuration (for example, a particular tile size/colour), not a separate product master.

### Pricing and branch inventory

- Existing effective prices remain authoritative: a current branch-specific price overrides the company-wide price; otherwise the company-wide price is used. The lookup does not invent price values.
- Price history continues to use effective dates. The product detail view exposes the effective-price period and currently accessible active branch scopes.
- The application validates the chosen active branch and requires branch access before calling the price-change RPC. The RPC now repeats the active-branch access check at the database boundary, before permission-sensitive work.
- Inventory remains ledger-derived. Search returns stock from the existing inventory projection, never writes balances, and respects row-level access. When the user selects a branch, the quantity/status are for that branch. In all-branch mode, totals and breakdown contain only branches the caller can access.
- The search response exposes a branch-safe quantity, minimum and availability status, not a count from inaccessible branches. It returns current standard retail pricing only where the caller has the appropriate price-read permission.

## What was implemented

1. **Database search/catalogue layer** — `sellable_product_catalog` represents sellable variants and relevant public/admin catalogue fields without flattening away the product-to-variant relationship. `search_inventory_products` finds active variants by exact/prefix/partial Item Code, barcode, product/variant name, category and brand, ranking exact code matches first; it returns current stock and applicable standard price in branch scope.
2. **Item Code controls** — normalized case-insensitive unique Item Codes, guarded direct updates, and an audited, history-aware code update RPC.
3. **Indexes** — B-tree prefix and trigram indexes support common Item Code and variant-name searches.
4. **Application lookup** — authenticated route at `/api/app/product-lookup` validates active branch scope and `inventory.read`, returns no-store responses and delegates data filtering to the database. The reusable lookup has a selected-branch control, debounce, keyboard-accessible combobox/listbox, live result announcement, Item Code, variant, unit, stock/status and available price. Selecting a result navigates to its inventory position when one exists, otherwise to product detail.
5. **Product/inventory pages** — product list now presents sellable variants with Item Code, variant attributes, unit, price (when authorized), filters and pagination. Inventory has the branch-aware lookup. Product detail presents the Item Code and audited editor, effective prices and authorized branch inventory/recent movements. Existing stock-ledger flows (opening stock, adjustments, counts and movement history) remain the write path.
6. **Terminology** — owner-facing labels on product, inventory, purchasing, sales and transfer surfaces say “Item Code”; underlying database/API compatibility fields remain `sku`.
7. **Price-scope defense** — branch price changes check the selected active accessible branch both in the server action and `change_product_price` RPC.

## Access and data-integrity boundaries

- Authenticated session and existing permission helpers remain in use; no service-role access was added to the user-facing lookup.
- Inventory search requires `inventory.read`; RLS and `can_access_branch` constrain branch projections and the RPC rejects a specifically selected inaccessible/inactive branch.
- Price display respects `product_prices.read`; price changes require `product_prices.manage` and, for branch prices, access to the active target branch.
- Item Code editing uses the existing product update permission model and database audit path.
- Product catalogue status and variant identifiers are not inferred from client input for inventory quantities; stock is queried from the server/database.

## Verification performed

| Check                                                                           | Result                                                                                                                                                                     |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local forward migrations                                                        | Applied through `20260924022000_guard_branch_price_changes.sql`                                                                                                            |
| Focused pgTAP `phase2_product_inventory.sql`                                    | **PASS — 23 assertions** (branch quantity/price precedence, all-branch scope, normalization/uniqueness, audited code changes, and unauthorized branch price/search denial) |
| Focused Chromium lookup E2E against the already-running `http://localhost:3000` | **PASS — 1 test** (search by Item Code at a selected branch and open the inventory position)                                                                               |
| `pnpm lint`                                                                     | **PASS**                                                                                                                                                                   |
| `pnpm typecheck`                                                                | **PASS**                                                                                                                                                                   |
| `pnpm test`                                                                     | **PASS — 10 files, 31 tests**                                                                                                                                              |

The local application server was not restarted or stopped. E2E used `PLAYWRIGHT_BASE_URL=http://localhost:3000`; the test did not start a second Next server or touch the existing `.next` lock.

## Known limits / follow-up

- The selected-branch lookup flow has a focused browser test. A full browser regression across every inventory, product, sales, purchasing and transfer screen was not run as part of this focused refinement. The repo has known pre-existing E2E limitations around transfer dispatch state and mobile CSV behavior (recorded in the Phase 1 audit); treat these separately from this phase's passing focused test.
- Existing E2E fixture data is intentionally retained. The full SQL suite has had failures when run against accumulated local E2E fixture state; no reset was used to obtain a green result. The focused Phase 2 SQL file is deterministic and transaction-rolled back.
- A production build may still require network availability for the configured Google fonts; this Phase 2 change did not alter that dependency.
- Existing pricing and variant permission policy remains in force; Phase 2 did not broaden role permissions.
- No production/staging data migration, commit, push, deployment or live release is included here.

## Suggested Phase 3 handoff

Before expanding catalogue operations, confirm the business vocabulary for variant descriptions and whether existing products should be migrated from informal SKU values to owner-assigned Item Codes. Keep UUIDs as durable references and preserve historical snapshots. Add any future import/edit tooling through permission-checked database operations and test it against the same cross-branch leakage and ledger invariants used here.
