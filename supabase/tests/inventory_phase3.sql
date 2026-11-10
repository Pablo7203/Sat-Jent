begin;
create extension if not exists pgtap with schema extensions;
select plan(39);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('32000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inv@test.invalid','',now(),'{}','{}',now(),now()),
('32000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','invsales@test.invalid','',now(),'{}','{}',now(),now()),
('32000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','invowner@test.invalid','',now(),'{}','{}',now(),now()),
('32000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','invinactive@test.invalid','',now(),'{}','{}',now(),now());
update public.profiles set role_id=case id when '32000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000005'::uuid when '32000000-0000-4000-8000-000000000002' then '10000000-0000-4000-8000-000000000004'::uuid when '32000000-0000-4000-8000-000000000003' then '10000000-0000-4000-8000-000000000002'::uuid else '10000000-0000-4000-8000-000000000005'::uuid end,is_active=id<>'32000000-0000-4000-8000-000000000004' where id in('32000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000002','32000000-0000-4000-8000-000000000003','32000000-0000-4000-8000-000000000004');
insert into public.branches(id,code,name,address,phone) values('41000000-0000-4000-8000-000000000001','INV-A','Inventory A','Test','000'),('41000000-0000-4000-8000-000000000002','INV-B','Inventory B','Test','000');
insert into public.user_branches(user_id,branch_id) values('32000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001'),('32000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001'),('32000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000001');
insert into public.categories(id,name,slug) values('51100000-0000-4000-8000-000000000001','Inventory Test','inventory-test');
insert into public.units_of_measure(id,code,name,symbol,allows_decimal) values('53100000-0000-4000-8000-000000000001','IPCS','Inventory Pieces','pc',false),('53100000-0000-4000-8000-000000000002','IMTR','Inventory Metres','m',true);
insert into public.products(id,name,category_id,unit_of_measure_id) values('56100000-0000-4000-8000-000000000001','Integer Product','51100000-0000-4000-8000-000000000001','53100000-0000-4000-8000-000000000001'),('56100000-0000-4000-8000-000000000002','Decimal Product','51100000-0000-4000-8000-000000000001','53100000-0000-4000-8000-000000000002');
insert into public.product_variants(id,product_id,name,sku,is_default) values('57100000-0000-4000-8000-000000000001','56100000-0000-4000-8000-000000000001','Standard','INV-INT',true),('57100000-0000-4000-8000-000000000002','56100000-0000-4000-8000-000000000002','Standard','INV-DEC',true);
update public.products set status='ACTIVE' where id in('56100000-0000-4000-8000-000000000001','56100000-0000-4000-8000-000000000002');

set local role authenticated;select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok(public.has_permission('inventory.opening_stock'),'Inventory Officer has opening permission');
select lives_ok($$select public.post_opening_stock_batch('41000000-0000-4000-8000-000000000001','[{"variant_id":"57100000-0000-4000-8000-000000000001","quantity":100,"minimum_stock_level":10}]','Verified opening')$$,'Opening stock posts');
select is((select quantity_on_hand from public.branch_inventory where branch_id='41000000-0000-4000-8000-000000000001' and variant_id='57100000-0000-4000-8000-000000000001'),100.000::numeric,'Opening balance is 100');
select is((select count(*) from public.stock_movements where movement_type='OPENING_STOCK'),1::bigint,'One opening movement exists');
select is((select balance_before from public.stock_movements where movement_type='OPENING_STOCK'),0.000::numeric,'Opening movement starts at zero');
select is((select balance_after from public.stock_movements where movement_type='OPENING_STOCK'),100.000::numeric,'Opening movement ends at 100');
select throws_ok($$select public.post_opening_stock_batch('41000000-0000-4000-8000-000000000001','[{"variant_id":"57100000-0000-4000-8000-000000000001","quantity":1}]',null)$$,'P0001','Opening stock has already been posted for an item','Duplicate opening is rejected');
select lives_ok($$select public.post_opening_stock_batch('41000000-0000-4000-8000-000000000001','[{"variant_id":"57100000-0000-4000-8000-000000000002","quantity":1.5}]','Decimal opening')$$,'Decimal-enabled unit accepts 1.5');
select throws_ok($$select public.validate_inventory_quantity('57100000-0000-4000-8000-000000000001',1.5,false)$$,'P0001','This unit requires a whole-number quantity','Integer unit rejects 1.5');

select lives_ok($$select public.create_stock_adjustment('41000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000006','Found during review','[{"variant_id":"57100000-0000-4000-8000-000000000001","quantity":10,"direction":"INCREASE"}]')$$,'Increase adjustment draft creates');
select lives_ok($$select public.complete_stock_adjustment((select id from public.stock_adjustments order by created_at desc limit 1))$$,'Increase adjustment completes');
select is((select quantity_on_hand from public.branch_inventory where variant_id='57100000-0000-4000-8000-000000000001'),110.000::numeric,'Increase produces 110');
select throws_ok($$select public.complete_stock_adjustment((select id from public.stock_adjustments order by created_at desc limit 1))$$,'P0001','Only draft adjustments can be completed','Completed adjustment cannot repost');
select lives_ok($$select public.create_stock_adjustment('41000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','Damaged in store','[{"variant_id":"57100000-0000-4000-8000-000000000001","quantity":20,"direction":"DECREASE"}]')$$,'Decrease draft creates');
select lives_ok($$select public.complete_stock_adjustment((select id from public.stock_adjustments where status='DRAFT' order by created_at desc limit 1))$$,'Decrease completes');
select is((select quantity_on_hand from public.branch_inventory where variant_id='57100000-0000-4000-8000-000000000001'),90.000::numeric,'Decrease produces 90');
select lives_ok($$select public.create_stock_adjustment('41000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','Invalid shortage','[{"variant_id":"57100000-0000-4000-8000-000000000001","quantity":91,"direction":"DECREASE"}]')$$,'Insufficient adjustment draft can be reviewed');
select throws_ok($$select public.complete_stock_adjustment((select id from public.stock_adjustments where status='DRAFT' order by created_at desc limit 1))$$,'P0001','There is not enough stock to complete this operation','Negative stock completion is rejected');
select is((select quantity_on_hand from public.branch_inventory where variant_id='57100000-0000-4000-8000-000000000001'),90.000::numeric,'Rejected decrease leaves balance unchanged');
select lives_ok($$select public.create_stock_adjustment('41000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000005','Atomic test','[{"variant_id":"57100000-0000-4000-8000-000000000001","quantity":1,"direction":"DECREASE"},{"variant_id":"57100000-0000-4000-8000-000000000002","quantity":2,"direction":"DECREASE"}]')$$,'Multi-item draft creates');
select throws_ok($$select public.complete_stock_adjustment((select id from public.stock_adjustments where status='DRAFT' and notes='Atomic test'))$$,'P0001','There is not enough stock to complete this operation','Invalid second item rolls back entire adjustment');
select is((select quantity_on_hand from public.branch_inventory where variant_id='57100000-0000-4000-8000-000000000001'),90.000::numeric,'First item also rolled back');

select lives_ok($$select public.create_stock_count('41000000-0000-4000-8000-000000000001','Shortage','["57100000-0000-4000-8000-000000000001"]')$$,'Count draft creates');
select lives_ok($$select public.start_stock_count((select id from public.stock_counts order by created_at desc limit 1))$$,'Count snapshot starts');
select lives_ok($$select public.set_stock_count_quantity((select i.id from public.stock_count_items i join public.stock_counts c on c.id=i.stock_count_id where c.status='IN_PROGRESS'),87,null)$$,'Physical quantity recorded');
select lives_ok($$select public.complete_stock_count((select id from public.stock_counts where status='IN_PROGRESS'))$$,'Shortage count completes');
select is((select quantity_on_hand from public.branch_inventory where variant_id='57100000-0000-4000-8000-000000000001'),87.000::numeric,'Count reconciles to 87');
select is((select quantity_delta from public.stock_movements where movement_type='STOCK_COUNT_DECREASE'),(-3.000)::numeric,'Shortage movement is -3');
select is((select count(*) from public.inventory_integrity_issues()),0::bigint,'Ledger and current balances reconcile');

select is((select count(*) from public.branch_inventory where branch_id='41000000-0000-4000-8000-000000000002'),0::bigint,'Cross-branch inventory read returns no rows');
select throws_ok($$select public.create_stock_adjustment('41000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000005','Attack','[{"variant_id":"57100000-0000-4000-8000-000000000001","quantity":1,"direction":"INCREASE"}]')$$,'P0001','You do not have permission to adjust this branch','Cross-branch adjustment is denied');
select throws_ok($$update public.branch_inventory set quantity_on_hand=999$$,'42501',null,'Direct balance update is denied');
select throws_ok($$insert into public.stock_movements(branch_id,variant_id,movement_type,quantity_delta,balance_before,balance_after,reference_type,performed_by) values('41000000-0000-4000-8000-000000000001','57100000-0000-4000-8000-000000000001','ADJUSTMENT_INCREASE',1,87,88,'STOCK_ADJUSTMENT','32000000-0000-4000-8000-000000000001')$$,'42501',null,'Direct ledger insert is denied');
select throws_ok($$delete from public.stock_movements$$,'42501',null,'Movement deletion is denied');

select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.branch_inventory),2::bigint,'Sales reads assigned-branch inventory');
select ok(not public.has_permission('inventory.adjust'),'Sales lacks adjustment permission');
select throws_ok($$select public.post_opening_stock_batch('41000000-0000-4000-8000-000000000001','[{"variant_id":"57100000-0000-4000-8000-000000000001","quantity":1}]',null)$$,'P0001','You do not have permission to initialize this branch','Sales cannot post opening stock');

select set_config('request.jwt.claims','{"sub":"32000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.branch_inventory),0::bigint,'Inactive user reads no inventory');
set local role anon;select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select count(*) from public.branch_inventory),0::bigint,'Anonymous access returns no inventory rows');
select * from finish();rollback;
