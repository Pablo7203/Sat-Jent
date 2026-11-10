begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('61000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase2-owner@test.invalid','',now(),'{}','{}',now(),now()),
('61000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase2-manager@test.invalid','',now(),'{}','{}',now(),now());
update public.profiles set role_id='10000000-0000-4000-8000-000000000001',is_active=true where id='61000000-0000-4000-8000-000000000001';
update public.profiles set role_id='10000000-0000-4000-8000-000000000003',is_active=true where id='61000000-0000-4000-8000-000000000002';

insert into public.branches(id,code,name,address,phone) values
('62000000-0000-4000-8000-000000000001','P2-A','Phase Two Branch A','Test address','000'),
('62000000-0000-4000-8000-000000000002','P2-B','Phase Two Branch B','Test address','000');
insert into public.user_branches(user_id,branch_id) values
('61000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001');
insert into public.categories(id,name,slug) values('63000000-0000-4000-8000-000000000001','Phase Two Tiles','phase-two-tiles');
insert into public.units_of_measure(id,code,name,symbol) values('64000000-0000-4000-8000-000000000001','P2BOX','Phase Two Box','box');
insert into public.products(id,name,category_id,unit_of_measure_id) values
('65000000-0000-4000-8000-000000000001','Phase Two Porcelain Tile','63000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001');
insert into public.product_variants(id,product_id,name,sku,is_default) values
('66000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001','60 × 60 · White',E'  P2-TILE-001\t',true);
update public.products set status='ACTIVE' where id='65000000-0000-4000-8000-000000000001';
insert into public.product_prices(variant_id,branch_id,price_type,amount,effective_from) values
('66000000-0000-4000-8000-000000000001',null,'RETAIL',250,'2026-01-01'),
('66000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','RETAIL',240,'2026-01-01');

select is(
  (select i.indisunique from pg_index i where i.indexrelid = 'public.product_variants_sku_ci_unique'::regclass),
  true,
  'Item Code uniqueness is enforced case-insensitively across all variants'
);
select ok(
  exists (select 1 from pg_trigger t where t.tgrelid='public.product_variants'::regclass and t.tgname='guard_variant_item_code_change' and not t.tgisinternal),
  'Direct Item Code updates are guarded by the database'
);
select is(has_function_privilege('anon','public.update_variant_item_code(uuid,text,boolean)','EXECUTE'),false,'Anonymous users cannot change Item Codes');
select is(has_function_privilege('authenticated','public.update_variant_item_code(uuid,text,boolean)','EXECUTE'),true,'Authenticated users can call the permission-checked Item Code workflow');
select is(has_function_privilege('anon','public.search_inventory_products(text,uuid,integer)','EXECUTE'),false,'Anonymous users cannot search internal stock');
select is(has_function_privilege('authenticated','public.search_inventory_products(text,uuid,integer)','EXECUTE'),true,'Authenticated employees can call the branch-scoped inventory search');
select is((select sku from public.product_variants where id='66000000-0000-4000-8000-000000000001'),'P2-TILE-001','Surrounding spaces and tabs are normalized in the stored Item Code');
select throws_ok($$insert into public.product_variants(product_id,name,sku) values ('65000000-0000-4000-8000-000000000001','Duplicate',' p2-tile-001 ')$$,'23505',null,'Duplicate Item Code is rejected even with different case and whitespace');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.post_opening_stock_batch('62000000-0000-4000-8000-000000000001','[{"variant_id":"66000000-0000-4000-8000-000000000001","quantity":10,"minimum_stock_level":2}]','Phase 2 test stock')$$,'Owner initializes branch A through the existing stock ledger');
select lives_ok($$select public.post_opening_stock_batch('62000000-0000-4000-8000-000000000002','[{"variant_id":"66000000-0000-4000-8000-000000000001","quantity":4,"minimum_stock_level":1}]','Phase 2 test stock')$$,'Owner initializes branch B through the existing stock ledger');
select is((select quantity_on_hand from public.search_inventory_products('P2-TILE-001','62000000-0000-4000-8000-000000000001',12)),10.000::numeric,'Selected branch A lookup returns only branch A quantity');
select is((select standard_selling_price from public.search_inventory_products('P2-TILE-001','62000000-0000-4000-8000-000000000001',12)),240.00::numeric,'Branch price override is used when effective');
select is((select standard_selling_price from public.search_inventory_products('P2-TILE-001','62000000-0000-4000-8000-000000000002',12)),250.00::numeric,'Company standard price is used when branch has no override');
select is((select quantity_on_hand from public.search_inventory_products('P2-TILE-001',null,12)),14.000::numeric,'All-branch search sums authorized branch stock');
select is((select jsonb_array_length(branch_breakdown) from public.search_inventory_products('P2-TILE-001',null,12)),2,'Owner all-branch result includes the actual branch breakdown');
select throws_ok($$update public.product_variants set sku='DIRECT-CHANGE' where id='66000000-0000-4000-8000-000000000001'$$,'P0001','Item Codes must be changed through the audited Item Code workflow','Direct table update cannot bypass audited code changes');
select throws_ok($$select public.update_variant_item_code('66000000-0000-4000-8000-000000000001','P2-TILE-002',false)$$,'P0001','This item has history. Confirm that historical records keep their original snapshots.','Historical code change requires explicit confirmation');
select is(public.update_variant_item_code('66000000-0000-4000-8000-000000000001','P2-TILE-002',true),true,'Confirmed code update reports that historical records exist');
select is((select variant_id from public.search_inventory_products('P2-TILE-002','62000000-0000-4000-8000-000000000001',12)),'66000000-0000-4000-8000-000000000001'::uuid,'Code correction keeps the same variant UUID and branch stock relationship');

select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.change_product_price('66000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002','RETAIL',230,now())$$,'P0001','You cannot update prices for this branch','Branch-restricted employee cannot change another branch price');
select throws_ok($$select * from public.search_inventory_products('P2-TILE-002','62000000-0000-4000-8000-000000000002',12)$$,'P0001','You cannot access the selected branch','Branch-restricted employee cannot query another branch');
select is((select quantity_on_hand from public.search_inventory_products('P2-TILE-002',null,12)),10.000::numeric,'All-branch totals for restricted employees include only their authorized branches');
select is((select jsonb_array_length(branch_breakdown) from public.search_inventory_products('P2-TILE-002',null,12)),1,'Restricted employee cannot see another branch in the branch breakdown');

select * from finish();
rollback;
