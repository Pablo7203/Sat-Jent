begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('31000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','catalog-super@test.invalid','',now(),'{}','{}',now(),now()),
('31000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','catalog-sales@test.invalid','',now(),'{}','{}',now(),now()),
('31000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','catalog-inactive@test.invalid','',now(),'{}','{}',now(),now()),
('31000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','catalog-safety-admin@test.invalid','',now(),'{}','{}',now(),now());
update public.profiles set role_id='10000000-0000-4000-8000-000000000001',is_active=true where id='31000000-0000-4000-8000-000000000004';
update public.profiles set role_id=case id when '31000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000001'::uuid else '10000000-0000-4000-8000-000000000004'::uuid end,
 is_active=id<>'31000000-0000-4000-8000-000000000003';

insert into public.categories(id,name,slug) values ('51000000-0000-4000-8000-000000000001','Test Appliances','test-appliances');
insert into public.brands(id,name,slug) values ('52000000-0000-4000-8000-000000000001','Test Brand','test-brand');
insert into public.units_of_measure(id,code,name,symbol) values ('53000000-0000-4000-8000-000000000001','PCS','Pieces','pc');
insert into public.attributes(id,code,name,data_type) values ('54000000-0000-4000-8000-000000000001','COLOUR','Colour','SELECT');
insert into public.attribute_values(id,attribute_id,value) values ('55000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','Black');
insert into public.category_attributes(category_id,attribute_id,is_required) values ('51000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',true);
insert into public.products(id,name,category_id,brand_id,unit_of_measure_id) values ('56000000-0000-4000-8000-000000000001','Test Kettle','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001');
insert into public.product_variants(id,product_id,name,sku,barcode,is_default) values ('57000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001','Black','KTL-001','123456789',true);
insert into public.variant_attribute_values(variant_id,attribute_id,attribute_value_id) values ('57000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000001');
insert into public.product_prices(variant_id,price_type,amount,effective_from) values ('57000000-0000-4000-8000-000000000001','RETAIL',100,'2026-01-01');

select throws_ok($$insert into public.product_variants(product_id,name,sku) values ('56000000-0000-4000-8000-000000000001','Duplicate','ktl-001')$$, '23505', null, 'SKU uniqueness is case-insensitive');
select throws_ok($$insert into public.product_prices(variant_id,price_type,amount,effective_from) values ('57000000-0000-4000-8000-000000000001','RETAIL',110,'2026-02-01')$$, 'P0001', 'Price effective periods cannot overlap for the same variant, branch, and type', 'Overlapping prices are rejected');
select lives_ok($$update public.products set status='ACTIVE' where id='56000000-0000-4000-8000-000000000001'$$, 'A complete product satisfies activation invariants');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok(public.has_permission('products.create'), 'Super Admin can create products');
select ok(public.has_permission('product_images.manage'), 'Super Admin can manage product images');
select is((select count(*) from public.products where id='56000000-0000-4000-8000-000000000001'),1::bigint,'Super Admin reads the product catalogue');
update public.products set status='DRAFT' where id='56000000-0000-4000-8000-000000000001';
update public.products set status='ACTIVE' where id='56000000-0000-4000-8000-000000000001';
select is((select status::text from public.products where id='56000000-0000-4000-8000-000000000001'),'ACTIVE','Ready product can be activated');
select lives_ok($$select public.change_product_price('57000000-0000-4000-8000-000000000001',null,'RETAIL',120,'2026-03-01')$$,'Price workflow closes the former record and adds a new one');
select is((select count(*) from public.product_prices where variant_id='57000000-0000-4000-8000-000000000001'),2::bigint,'Price history is preserved');
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id,metadata) values ('product-images','products/56000000-0000-4000-8000-000000000001/test.png','31000000-0000-4000-8000-000000000001','{"mimetype":"image/png"}')$$,'Authorized image upload path is accepted');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values ('product-images','wrong/56000000-0000-4000-8000-000000000001/test.png','31000000-0000-4000-8000-000000000001')$$,'42501',null,'Images outside the product prefix are rejected');
select throws_ok($$insert into public.product_images(product_id,storage_path) values ('56000000-0000-4000-8000-000000000001','products/56000000-0000-4000-8000-000000000099/foreign.png')$$,'P0001','Image path must belong to its product','Cross-product image metadata is rejected');

select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select ok(public.has_permission('products.read'),'Sales can read products');
select ok(not public.has_permission('products.update'),'Sales cannot update products');
select is((select count(*) from public.products where id='56000000-0000-4000-8000-000000000001'),1::bigint,'Sales reads the company-wide catalogue');
update public.products set name='Tampered' where id='56000000-0000-4000-8000-000000000001';
select is((select name from public.products where id='56000000-0000-4000-8000-000000000001'),'Test Kettle','Sales product mutation affects no rows under RLS');
select throws_ok($$insert into public.products(name,category_id,unit_of_measure_id) values ('Unauthorized','51000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001')$$,'42501',null,'Sales cannot create a product');
select throws_ok($$insert into public.categories(name,slug) values ('Unauthorized','unauthorized')$$,'42501',null,'Sales cannot create a category');
update public.product_prices set amount=999 where variant_id='57000000-0000-4000-8000-000000000001' and effective_to is null;
select is((select amount from public.product_prices where variant_id='57000000-0000-4000-8000-000000000001' and effective_to is null),120.00::numeric,'Sales cannot update a current price');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values ('product-images','products/56000000-0000-4000-8000-000000000001/sales.png','31000000-0000-4000-8000-000000000002')$$,'42501',null,'Sales image upload is blocked');

select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.products),0::bigint,'Inactive user cannot read products');
select is((select count(*) from public.categories),0::bigint,'Inactive user cannot read categories');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select count(*) from public.products),0::bigint,'Anonymous user cannot read product metadata');
select is((select count(*) from storage.objects where bucket_id='product-images' and name like 'products/56000000-0000-4000-8000-000000000001/%'),0::bigint,'Images for non-public products are not anonymously readable');

select * from finish();
rollback;
