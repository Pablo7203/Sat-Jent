begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.categories(id,name,slug) values
  ('51a00000-0000-4000-8000-000000000001','Image Guard Category','image-guard-category');
insert into public.units_of_measure(id,code,name,symbol) values
  ('53a00000-0000-4000-8000-000000000001','IMG','Image Guard Unit','pc');
insert into public.products(id,name,category_id,unit_of_measure_id) values
  ('56a00000-0000-4000-8000-000000000001','Image Guard Product','51a00000-0000-4000-8000-000000000001','53a00000-0000-4000-8000-000000000001');

select throws_ok(
  $$update public.products set is_public=true where id='56a00000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Upload at least one product image before making a product public',
  'A product without images cannot become public'
);
insert into public.product_images(product_id,storage_path) values
  ('56a00000-0000-4000-8000-000000000001','products/56a00000-0000-4000-8000-000000000001/guard.webp');
select lives_ok(
  $$update public.products set is_public=true where id='56a00000-0000-4000-8000-000000000001'$$,
  'A product with an image can become public'
);
select throws_ok(
  $$delete from public.product_images where product_id='56a00000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Make the product internal before removing its final image',
  'The final image on a public product cannot be removed'
);

select * from finish();
rollback;
