# Public website

Phase 8 adds a server-rendered public website inside the existing Next.js application. Public routes are `/`, `/products`, `/products/[slug]`, `/categories/[slug]`, `/about`, `/branches`, `/contact`, `/quote`, and `/privacy`. Internal routes remain under `/app` with the authenticated shell.

## Safe data layer

Anonymous callers receive data only through explicit security-definer functions. Catalogue and product functions require `status = ACTIVE` and `is_public = true`. Their JSON contains only public descriptions, categories, brands, units, active variants, attributes, approved imagery, optional retail price, and a derived availability label. They never return costs, suppliers, price history, raw stock, customers, sales, purchases, audit data, or employees.

The image bucket is private. Anonymous storage reads succeed only for an image registered to an active public product, and server pages generate short-lived signed URLs through that anonymous policy.

`show_price_online` controls numeric price exposure inside PostgreSQL. False returns `null` even when an internal price exists. Availability is Available when an active-branch balance exceeds minimum, Limited availability when only low positive stock exists, and Currently unavailable at zero company stock. Exact quantities are never projected.

## Catalogue, quotations and SEO

Catalogue state is URL-driven with public-safe search, category/brand filters, sorting, and server pagination. Product pages provide images, valid variants, attributes, pricing, availability, related products, quote and configured WhatsApp actions.

Quotation submission validates fields and public references, applies a honeypot and five-minute phone rate limit, generates `RFQ-YYYY-NNNNNN`, and forces `NEW`. Anonymous users receive only the reference and cannot read or update requests. Staff status changes are permission/branch checked and audited.

Public pages are server rendered. Canonicals, Open Graph basics, public-only sitemap, and robots exclusions are implemented. Only the menu and quotation form hydrate. This phase contains no cart, checkout, payment, delivery, or customer accounts.

## Catalogue attribute filters

Attribute filters are derived from the exact selected category's Phase 2 `category_attributes` configuration. The closure implementation intentionally retains exact-category matching rather than including descendants. Filters are single-select. Different attributes use AND semantics and must match together on one active variant. PostgreSQL applies the attribute predicate before result counting and pagination. Only active SELECT values used by active variants of active public products are projected publicly.

## Structured data

The homepage emits an Organization and one LocalBusiness per configured public branch. Category and product pages emit BreadcrumbList data; product pages emit Product data and an Offer only when every active displayed variant has the same visible retail price. Product images are intentionally omitted because the private-storage signed URLs expire after one hour and are not crawler-stable. Hidden prices, raw stock quantities, internal identifiers, and private branches are never serialized.
