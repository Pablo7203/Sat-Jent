# Product master

## Scope

Phase 2 is the company-wide product catalogue. It contains categories, brands, units of measure, flexible attributes and allowed values, products, sellable variants, price history, and product images. It does not contain stock quantities, movements, purchasing, sales, or storefront behavior.

## Product and variant model

A product owns descriptive and classification data. Every operational sellable unit is a `product_variants` row, even when a product has only one option. SKU is required and unique without regard to case; barcode is optional and likewise unique. Only one default variant is allowed per product.

Products progress through `DRAFT`, `ACTIVE`, and `ARCHIVED`. Activation requires an active category and unit, at least one active variant with an SKU, and values for every category attribute marked required. Archival is reversible and requires `products.archive`. There are no product or variant hard-delete policies.

## Attributes

Attributes have `TEXT`, `NUMBER`, `BOOLEAN`, or `SELECT` types. Category mappings determine relevance and required status. A variant value trigger validates its typed column, category mapping, and—when applicable—active allowed value. Data types cannot change after use, and changing a product category is rejected if it would orphan existing attribute values.

## Pricing

Prices are `numeric(14,2)` GHS records with `RETAIL` or `WHOLESALE` type, optional branch scope, and half-open effective periods. Periods cannot overlap for the same variant, branch, and type. `change_product_price` closes the applicable current record and inserts its successor in one transaction, preserving history.

## Images

The `product-images` Supabase Storage bucket permits public reads by design. It accepts JPEG, PNG, WebP, and AVIF files up to 5 MB. Authenticated writes require `product_images.manage`; paths must start with `products/{product_id}/` and the product must exist. Application deletion verifies both the image row and product-owned prefix before removing the object and metadata.

## Authorization

Super Admin and Owner receive all Phase 2 permissions. Branch Manager, Sales, and Inventory receive read-only catalogue/reference/price permissions. Inactive and anonymous users cannot read catalogue metadata. RLS is enabled on every Phase 2 table, and Storage writes repeat the permission check.

## Operations and verification

Apply migrations with `pnpm db:reset` locally. Run `pnpm test:rls` for real PostgreSQL constraints, RLS, and Storage policies. `pnpm test:e2e:setup` prepares local identities and catalogue references; `pnpm test:e2e` exercises authenticated catalogue creation. The usual `typecheck`, `lint`, unit tests, database lint, and production build remain required.
