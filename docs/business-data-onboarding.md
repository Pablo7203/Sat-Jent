# Business data onboarding

No real business records belong in migrations or demo seeds. The owner must approve branch, employee, role, category, unit, brand, product, SKU/barcode, price, public-visibility, and opening-balance source sheets before import.

Use [product-import.csv](templates/product-import.csv) as the mapping worksheet. Import reference data in dependency order: branches, users/access, units/categories/brands/attributes, products/variants, prices, and images. Validate uniqueness, required relationships, active status, numeric precision, public visibility, and price-display choices in staging before production entry. For a small catalogue, controlled entry through the application is safer than an unreviewed bulk script.

Use [opening-stock.csv](templates/opening-stock.csv) only after products and branches are final. Set `OPENING_STOCK_OPERATOR_EMAIL` and `OPENING_STOCK_OPERATOR_PASSWORD` for a dedicated authorized user, then run:

```sh
pnpm opening-stock:dry-run -- docs/templates/opening-stock.csv
pnpm opening-stock:apply -- approved-opening-stock.csv
```

Dry-run validates identity, branch access, SKU existence, active products, decimal rules, duplicates, and pre-existing inventory without writing. Apply posts through the authoritative opening-stock RPC, grouped atomically per branch. If a later branch fails, earlier successful branches remain posted; stop, retain the report, reconcile those branches, and never rerun them. After apply, compare every approved line and branch total to `branch_inventory` and `OPENING_STOCK` ledger movements, then obtain owner sign-off.

Existing receivables, supplier payables, cash/bank balances, and historical transactions have no dedicated opening-balance workflow in the current scope. Do not fabricate or insert them directly. The owner must choose a documented cutover policy (for example, start clean and manage legacy balances outside the system, or authorize a separately designed auditable feature) before go-live.
