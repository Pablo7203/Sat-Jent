-- Match the server-side catalogue lookup's code and variant-name predicates.
create index product_variants_sku_prefix_idx
  on public.product_variants (lower(btrim(sku)) text_pattern_ops);

create index product_variants_sku_trgm_idx
  on public.product_variants using gin (lower(btrim(sku)) extensions.gin_trgm_ops);

create index product_variants_name_trgm_idx
  on public.product_variants using gin (lower(name) extensions.gin_trgm_ops);
