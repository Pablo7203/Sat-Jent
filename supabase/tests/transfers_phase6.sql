begin;create extension if not exists pgtap with schema extensions;select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('35000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager-a6@test.invalid','',now(),'{}','{}',now(),now()),
('35000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inventory-a6@test.invalid','',now(),'{}','{}',now(),now()),
('35000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inventory-b6@test.invalid','',now(),'{}','{}',now(),now()),
('35000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inventory-c6@test.invalid','',now(),'{}','{}',now(),now()),
('35000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sales6@test.invalid','',now(),'{}','{}',now(),now()),
('35000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inactive6@test.invalid','',now(),'{}','{}',now(),now()),
('35000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner6@test.invalid','',now(),'{}','{}',now(),now());
update public.profiles set role_id=case when id='35000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000003'::uuid when id='35000000-0000-4000-8000-000000000005' then '10000000-0000-4000-8000-000000000004'::uuid when id='35000000-0000-4000-8000-000000000007' then '10000000-0000-4000-8000-000000000002'::uuid else '10000000-0000-4000-8000-000000000005'::uuid end,is_active=id<>'35000000-0000-4000-8000-000000000006' where id::text like '35000000%';
insert into public.branches(id,code,name,address,phone,is_active) values
('45000000-0000-4000-8000-000000000001','TR-A','Transfer A','Test','000',true),
('45000000-0000-4000-8000-000000000002','TR-B','Transfer B','Test','000',true),
('45000000-0000-4000-8000-000000000003','TR-C','Transfer C','Test','000',true),
('45000000-0000-4000-8000-000000000004','TR-X','Transfer Inactive','Test','000',false);
insert into public.user_branches(user_id,branch_id) values
('35000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001'),
('35000000-0000-4000-8000-000000000002','45000000-0000-4000-8000-000000000001'),
('35000000-0000-4000-8000-000000000003','45000000-0000-4000-8000-000000000002'),
('35000000-0000-4000-8000-000000000004','45000000-0000-4000-8000-000000000003'),
('35000000-0000-4000-8000-000000000005','45000000-0000-4000-8000-000000000001'),
('35000000-0000-4000-8000-000000000006','45000000-0000-4000-8000-000000000001');
insert into public.categories(id,name,slug) values('51500000-0000-4000-8000-000000000001','Transfer Test','transfer-test');
insert into public.units_of_measure(id,code,name,symbol,allows_decimal) values('53500000-0000-4000-8000-000000000001','T6PC','Transfer Pieces','pc',false);
insert into public.products(id,name,category_id,unit_of_measure_id) values
('56500000-0000-4000-8000-000000000001','Transfer Product A','51500000-0000-4000-8000-000000000001','53500000-0000-4000-8000-000000000001'),
('56500000-0000-4000-8000-000000000002','Transfer Product B','51500000-0000-4000-8000-000000000001','53500000-0000-4000-8000-000000000001');
insert into public.product_variants(id,product_id,name,sku,is_default) values
('57500000-0000-4000-8000-000000000001','56500000-0000-4000-8000-000000000001','Standard','TRF-A',true),
('57500000-0000-4000-8000-000000000002','56500000-0000-4000-8000-000000000002','Standard','TRF-B',true);
update public.products set status='ACTIVE' where id::text like '56500000%';

set local role authenticated;select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
select lives_ok($$select public.post_opening_stock_batch('45000000-0000-4000-8000-000000000001','[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":100},{"variant_id":"57500000-0000-4000-8000-000000000002","quantity":5}]','Transfer source')$$,'Source opening stock posts');
select lives_ok($$select public.post_opening_stock_batch('45000000-0000-4000-8000-000000000002','[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":20},{"variant_id":"57500000-0000-4000-8000-000000000002","quantity":2}]','Transfer destination')$$,'Destination opening stock posts');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select ok(public.has_permission('transfers.create'),'Inventory role can create transfers');
select ok(not public.has_permission('transfers.approve'),'Inventory role cannot approve transfers');
select lives_ok($$select public.create_transfer('45000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000002','Main lifecycle',false,'[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":30}]')$$,'Draft transfer creates');
select ok((select transfer_number like 'TRF-%' from public.stock_transfers where notes='Main lifecycle'),'Transfer number generated');
select is((select status::text from public.stock_transfers where notes='Main lifecycle'),'DRAFT','New transfer is draft');
select is((select quantity_on_hand from public.branch_inventory where branch_id='45000000-0000-4000-8000-000000000001' and variant_id='57500000-0000-4000-8000-000000000001'),100.000::numeric,'Draft leaves source unchanged');
select is((select count(*) from public.stock_movements where movement_type in('TRANSFER_OUT','TRANSFER_IN')),0::bigint,'Draft creates no transfer movement');
select lives_ok($$select public.update_draft_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'45000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000002','Main lifecycle','[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":30}]')$$,'Draft can be edited');
select lives_ok($$select public.request_transfer((select id from public.stock_transfers where notes='Main lifecycle'))$$,'Draft submits as request');
select is((select status::text from public.stock_transfers where notes='Main lifecycle'),'REQUESTED','Transfer is requested');
select is((select quantity_on_hand from public.branch_inventory where branch_id='45000000-0000-4000-8000-000000000001' and variant_id='57500000-0000-4000-8000-000000000001'),100.000::numeric,'Request leaves stock unchanged');
select throws_ok($$select public.approve_transfer((select id from public.stock_transfers where notes='Main lifecycle'))$$,'P0001','Only an authorized source branch manager can approve this transfer','Inventory role cannot approve');
select throws_ok($$select public.dispatch_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'85000000-0000-4000-8000-000000000001')$$,'P0001','Only an approved transfer can be dispatched','Dispatch before approval rejected');
select throws_ok($$select public.receive_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'86000000-0000-4000-8000-000000000001')$$,'P0001','Only a dispatched transfer can be received','Receipt before dispatch rejected');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.approve_transfer((select id from public.stock_transfers where notes='Main lifecycle'))$$,'Source manager approves');
select is((select approved_quantity from public.stock_transfer_items where transfer_id=(select id from public.stock_transfers where notes='Main lifecycle')),30.000::numeric,'Approval uses requested quantity');
select is((select quantity_on_hand from public.branch_inventory where branch_id='45000000-0000-4000-8000-000000000001' and variant_id='57500000-0000-4000-8000-000000000001'),100.000::numeric,'Approval leaves source unchanged');
select lives_ok($$select public.dispatch_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'85000000-0000-4000-8000-000000000002')$$,'Approved transfer dispatches');
select is((select quantity_on_hand from public.branch_inventory where branch_id='45000000-0000-4000-8000-000000000001' and variant_id='57500000-0000-4000-8000-000000000001'),70.000::numeric,'Dispatch reduces source to 70');
set local role postgres;
select is((select quantity_on_hand from public.branch_inventory where branch_id='45000000-0000-4000-8000-000000000002' and variant_id='57500000-0000-4000-8000-000000000001'),20.000::numeric,'Dispatch does not change destination');
set local role authenticated;select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select quantity_delta from public.stock_movements where movement_type='TRANSFER_OUT' and reference_id=(select id from public.stock_transfers where notes='Main lifecycle')),(-30.000)::numeric,'TRANSFER_OUT is negative 30');
select is((select in_transit_quantity from public.transfer_in_transit where transfer_id=(select id from public.stock_transfers where notes='Main lifecycle')),30.000::numeric,'Thirty units are in transit');
select lives_ok($$select public.dispatch_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'85000000-0000-4000-8000-000000000002')$$,'Same dispatch operation is idempotent');
select is((select count(*) from public.stock_movements where movement_type='TRANSFER_OUT' and reference_id=(select id from public.stock_transfers where notes='Main lifecycle')),1::bigint,'Duplicate dispatch creates one movement');
select throws_ok($$select public.cancel_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'Too late')$$,'P0001','A dispatched transfer cannot be cancelled','Dispatched transfer cannot cancel');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.receive_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'86000000-0000-4000-8000-000000000002')$$,'P0001','Only the destination branch can confirm receipt','Source-only user cannot receive');
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.stock_transfers where notes='Main lifecycle'),1::bigint,'Destination user reads transfer');
select throws_ok($$select public.dispatch_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'85000000-0000-4000-8000-000000000003')$$,'P0001','Only an approved transfer can be dispatched','Destination cannot redispatch');
select lives_ok($$select public.receive_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'86000000-0000-4000-8000-000000000003')$$,'Destination receives transfer');
select is((select quantity_on_hand from public.branch_inventory where branch_id='45000000-0000-4000-8000-000000000002' and variant_id='57500000-0000-4000-8000-000000000001'),50.000::numeric,'Receipt increases destination to 50');
select is((select quantity_delta from public.stock_movements where movement_type='TRANSFER_IN' and reference_id=(select id from public.stock_transfers where notes='Main lifecycle')),30.000::numeric,'TRANSFER_IN is positive 30');
select is((select count(*) from public.transfer_in_transit where transfer_id=(select id from public.stock_transfers where notes='Main lifecycle')),0::bigint,'Receipt clears in-transit view');
select lives_ok($$select public.receive_transfer((select id from public.stock_transfers where notes='Main lifecycle'),'86000000-0000-4000-8000-000000000003')$$,'Same receipt operation is idempotent');
select is((select count(*) from public.stock_movements where movement_type='TRANSFER_IN' and reference_id=(select id from public.stock_transfers where notes='Main lifecycle')),1::bigint,'Duplicate receipt creates one movement');
set local role postgres;
select is((select sum(quantity_delta) from public.stock_movements where reference_type='STOCK_TRANSFER' and reference_id=(select id from public.stock_transfers where notes='Main lifecycle')),0.000::numeric,'Completed transfer conserves company stock');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*) from public.stock_transfers where notes='Main lifecycle'),0::bigint,'Unrelated branch cannot read transfer');
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.create_transfer('45000000-0000-4000-8000-000000000002','45000000-0000-4000-8000-000000000001','Fake source',true,'[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":1}]')$$,'P0001','You do not have permission to create a transfer from this branch','Fake source branch denied');
select throws_ok($$select public.create_transfer('45000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','Same branch',false,'[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":1}]')$$,'P0001','Source and destination branches must be different','Same branch rejected');
select throws_ok($$select public.create_transfer('45000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000004','Inactive destination',false,'[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":1}]')$$,'P0001','Transfers require two active branches','Inactive destination rejected');
select throws_ok($$insert into public.stock_movements(branch_id,variant_id,movement_type,quantity_delta,balance_before,balance_after,reference_type,performed_by) values('45000000-0000-4000-8000-000000000001','57500000-0000-4000-8000-000000000001','TRANSFER_OUT',-1,70,69,'STOCK_TRANSFER','35000000-0000-4000-8000-000000000002')$$,'42501',null,'Direct TRANSFER_OUT denied');
select throws_ok($$insert into public.stock_movements(branch_id,variant_id,movement_type,quantity_delta,balance_before,balance_after,reference_type,performed_by) values('45000000-0000-4000-8000-000000000002','57500000-0000-4000-8000-000000000001','TRANSFER_IN',1,50,51,'STOCK_TRANSFER','35000000-0000-4000-8000-000000000002')$$,'42501',null,'Direct TRANSFER_IN denied');
select throws_ok($$update public.stock_transfers set status='RECEIVED' where notes='Main lifecycle'$$,'42501',null,'Direct transfer status mutation denied');
select throws_ok($$update public.branch_inventory set quantity_on_hand=999$$,'42501',null,'Direct stock mutation remains denied');

select lives_ok($$select public.create_transfer('45000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000002','Cancel draft',false,'[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":1}]')$$,'Cancellation draft creates');
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated"}',true);select lives_ok($$select public.cancel_transfer((select id from public.stock_transfers where notes='Cancel draft'),'No longer required')$$,'Draft cancellation succeeds');select is((select status::text from public.stock_transfers where notes='Cancel draft'),'CANCELLED','Draft is cancelled without stock movement');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000002","role":"authenticated"}',true);select lives_ok($$select public.create_transfer('45000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000002','Atomic insufficient',true,'[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":1},{"variant_id":"57500000-0000-4000-8000-000000000002","quantity":6}]')$$,'Insufficient multi-item request creates');select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000001","role":"authenticated"}',true);select lives_ok($$select public.approve_transfer((select id from public.stock_transfers where notes='Atomic insufficient'))$$,'Insufficient request can be approved');select throws_ok($$select public.dispatch_transfer((select id from public.stock_transfers where notes='Atomic insufficient'),'85000000-0000-4000-8000-000000000004')$$,'P0001','There is not enough stock to complete this operation','Insufficient source rejects dispatch');select is((select quantity_on_hand from public.branch_inventory where branch_id='45000000-0000-4000-8000-000000000001' and variant_id='57500000-0000-4000-8000-000000000001'),70.000::numeric,'Multi-item failure rolls back sufficient first item');select is((select status::text from public.stock_transfers where notes='Atomic insufficient'),'APPROVED','Failed dispatch remains approved');

select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000005","role":"authenticated"}',true);select throws_ok($$select public.create_transfer('45000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000002','Sales attack',false,'[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":1}]')$$,'P0001','You do not have permission to create a transfer from this branch','Sales cannot create transfers');
select set_config('request.jwt.claims','{"sub":"35000000-0000-4000-8000-000000000006","role":"authenticated"}',true);select is((select count(*) from public.stock_transfers),0::bigint,'Inactive user cannot read transfers');select throws_ok($$select public.create_transfer('45000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000002','Inactive attack',false,'[{"variant_id":"57500000-0000-4000-8000-000000000001","quantity":1}]')$$,'P0001','You do not have permission to create a transfer from this branch','Inactive user cannot create');
set local role anon;select set_config('request.jwt.claims','{"role":"anon"}',true);select is((select count(*) from public.stock_transfers),0::bigint,'Anonymous cannot read transfer headers');select is((select count(*) from public.stock_transfer_items),0::bigint,'Anonymous cannot read transfer items');
set local role postgres;select is((select count(*) from public.transfer_integrity_issues()),0::bigint,'Transfer quantity, movement and conservation checks reconcile');select is((select count(*) from public.inventory_integrity_issues()),0::bigint,'Source and destination ledgers reconcile');select ok((select count(*)>=7 from public.audit_logs where action like 'transfer.%'),'Transfer lifecycle events are audited');
select * from finish();rollback;
