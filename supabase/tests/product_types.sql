begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.categories(id, name, slug) values
  ('71000000-0000-4000-8000-000000000001', 'Product Type Test Tiles', 'product-type-test-tiles'),
  ('71000000-0000-4000-8000-000000000002', 'Product Type Test Doors', 'product-type-test-doors');
insert into public.units_of_measure(id, code, name, symbol) values
  ('72000000-0000-4000-8000-000000000001', 'PTBOX', 'Product Type Test Box', 'box');
insert into public.product_types(id, category_id, name, is_active) values
  ('73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'Floor tile', true),
  ('73000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', 'Inactive tile type', false);
insert into public.products(
  id, name, slug, category_id, product_type_id, unit_of_measure_id,
  status, is_public, show_price_online
) values (
  '74000000-0000-4000-8000-000000000001', 'Type Test Porcelain', 'type-test-porcelain',
  '71000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000001', 'DRAFT', false, false
);
insert into public.product_variants(id, product_id, name, sku, is_default) values
  ('75000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', '60 x 60', 'PT-TILE-001', true);
insert into public.product_images(product_id, storage_path) values
  ('74000000-0000-4000-8000-000000000001', 'products/74000000-0000-4000-8000-000000000001/floor-tile.webp');
update public.products set is_public = true, status = 'ACTIVE'
  where id = '74000000-0000-4000-8000-000000000001';

select is(
  (select product_type_id from public.products where id = '74000000-0000-4000-8000-000000000001'),
  '73000000-0000-4000-8000-000000000001'::uuid,
  'Product type is stored separately from and under its main category'
);
select is(
  (public.public_catalogue(null, 'product-type-test-tiles', null, 'name', 1, 12, '{}'::jsonb)
    -> 'items' -> 0 ->> 'product_type'),
  'Floor tile',
  'Public catalogue cards include an optional product type'
);
select is(
  (public.public_product('type-test-porcelain')->>'product_type'),
  'Floor tile',
  'Public product details include the optional product type'
);
select throws_ok($$
  insert into public.products(id, name, slug, category_id, product_type_id, unit_of_measure_id)
  values (
    '74000000-0000-4000-8000-000000000002', 'Mismatched Type Product',
    'mismatched-type-product', '71000000-0000-4000-8000-000000000002',
    '73000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000001'
  )
$$, 'P0001', 'A newly assigned product type must be active and belong to the selected category', 'Database rejects a type assigned to a different category');
select throws_ok($$
  insert into public.products(id, name, slug, category_id, product_type_id, unit_of_measure_id)
  values (
    '74000000-0000-4000-8000-000000000003', 'Inactive Type Product',
    'inactive-type-product', '71000000-0000-4000-8000-000000000001',
    '73000000-0000-4000-8000-000000000002', '72000000-0000-4000-8000-000000000001'
  )
$$, 'P0001', 'A newly assigned product type must be active and belong to the selected category', 'Database rejects a newly assigned inactive type');
select is(
  has_function_privilege('anon', 'public.create_product_with_default_variant(text,text,uuid,uuid,uuid,boolean,public.product_status,text,text,text,numeric,numeric,uuid)', 'EXECUTE'),
  false,
  'Anonymous users cannot create products with types'
);
select is(
  has_function_privilege('authenticated', 'public.create_product_with_default_variant(text,text,uuid,uuid,uuid,boolean,public.product_status,text,text,text,numeric,numeric,uuid)', 'EXECUTE'),
  true,
  'Authenticated users can call the permission-checked product workflow'
);

select * from finish();
rollback;
