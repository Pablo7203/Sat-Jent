begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('36000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','daily-owner@test.invalid','',now(),'{}','{}',now(),now()),
('36000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','daily-manager@test.invalid','',now(),'{}','{}',now(),now()),
('36000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','daily-sales-role@test.invalid','',now(),'{}','{}',now(),now());
update public.profiles p set is_active=true,role_id=(select r.id from public.roles r where r.code=case p.id
  when '36000000-0000-4000-8000-000000000001'::uuid then 'OWNER'
  when '36000000-0000-4000-8000-000000000002'::uuid then 'BRANCH_MANAGER'
  else 'SALES' end) where p.id::text like '36000000%';
insert into public.branches(id,code,name,address,phone,is_active) values
('46000000-0000-4000-8000-000000000001','DS-A','Daily Sales Test Branch','Test','000',true);
insert into public.user_branches(user_id,branch_id) values
('36000000-0000-4000-8000-000000000002','46000000-0000-4000-8000-000000000001'),
('36000000-0000-4000-8000-000000000003','46000000-0000-4000-8000-000000000001');
insert into public.categories(id,name,slug) values('51600000-0000-4000-8000-000000000001','Daily Sales Test','daily-sales-test');
insert into public.units_of_measure(id,code,name,symbol,allows_decimal) values('53600000-0000-4000-8000-000000000001','DS-PC','Daily Sales Pieces','pc',false);
insert into public.products(id,name,category_id,unit_of_measure_id) values
('56600000-0000-4000-8000-000000000001','Daily Sales Product','51600000-0000-4000-8000-000000000001','53600000-0000-4000-8000-000000000001');
insert into public.product_variants(id,product_id,name,sku,is_default) values
('57600000-0000-4000-8000-000000000001','56600000-0000-4000-8000-000000000001','White','DS-PC-1',true);
update public.products set status='ACTIVE' where id='56600000-0000-4000-8000-000000000001';
insert into public.product_prices(variant_id,price_type,amount,effective_from) values
('57600000-0000-4000-8000-000000000001','RETAIL',10,now()-interval '1 day');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.post_opening_stock_batch('46000000-0000-4000-8000-000000000001','[{"variant_id":"57600000-0000-4000-8000-000000000001","quantity":10}]','Daily sales test stock')$$,'Owner can seed test stock through the opening-stock workflow');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select ok(public.has_permission('daily_sales.create') and public.has_permission('daily_sales.post'),'Branch Manager receives create and post access');
select ok(not public.has_permission('daily_sales.reverse'),'Branch Manager cannot reverse posted daily batches');
select is(has_table_privilege('authenticated','public.daily_sales_batches','INSERT'),false,'Authenticated users cannot directly insert daily batch headers');
select lives_ok($$select public.save_daily_sales_draft(null,'46000000-0000-4000-8000-000000000001',(now() at time zone 'Africa/Accra')::date,'Batch notes','STANDARD',null,null,'[{"variant_id":"57600000-0000-4000-8000-000000000001","quantity":2,"actual_unit_selling_price":10},{"variant_id":"57600000-0000-4000-8000-000000000001","quantity":3,"actual_unit_selling_price":10}]')$$,'Branch Manager can save repeated-variant lines as a draft');
select is((select status from public.daily_sales_batches where branch_id='46000000-0000-4000-8000-000000000001'),'DRAFT','New batch remains draft');
select is((select count(*) from public.daily_sales_batch_items),'2'::bigint,'Duplicate variants remain separate lines');
select is((select total_revenue from public.daily_sales_batches where branch_id='46000000-0000-4000-8000-000000000001'),50.00::numeric,'Draft total is derived from actual line prices');
select is((select quantity_on_hand from public.branch_inventory where branch_id='46000000-0000-4000-8000-000000000001' and variant_id='57600000-0000-4000-8000-000000000001'),10.000::numeric,'Draft does not change stock');
select is((select count(*) from public.stock_movements where reference_type='DAILY_SALES_BATCH'),'0'::bigint,'Draft creates no batch movements');

select lives_ok($$select public.post_daily_sales_batch((select id from public.daily_sales_batches where branch_id='46000000-0000-4000-8000-000000000001' and entry_kind='STANDARD'))$$,'Posting succeeds for an in-stock batch');
select is((select status from public.daily_sales_batches where branch_id='46000000-0000-4000-8000-000000000001' and entry_kind='STANDARD'),'POSTED','Batch status becomes posted');
select is((select quantity_on_hand from public.branch_inventory where branch_id='46000000-0000-4000-8000-000000000001' and variant_id='57600000-0000-4000-8000-000000000001'),5.000::numeric,'Posting deducts the combined quantity once');
select is((select count(*) from public.stock_movements where reference_type='DAILY_SALES_BATCH'),'2'::bigint,'Each repeated line has its own stock movement');
select lives_ok($$select public.post_daily_sales_batch((select id from public.daily_sales_batches where branch_id='46000000-0000-4000-8000-000000000001' and entry_kind='STANDARD'))$$,'Posting the same batch again is idempotent');
select is((select count(*) from public.stock_movements where reference_type='DAILY_SALES_BATCH'),'2'::bigint,'Idempotent repost creates no extra movements');
select lives_ok($$select public.save_daily_sales_draft(null,'46000000-0000-4000-8000-000000000001',(now() at time zone 'Africa/Accra')::date,null,'ADDITIONAL','Late till reconciliation',null,'[{"variant_id":"57600000-0000-4000-8000-000000000001","quantity":4,"actual_unit_selling_price":10},{"variant_id":"57600000-0000-4000-8000-000000000001","quantity":2,"actual_unit_selling_price":10}]')$$,'Additional batch draft can contain stock-short lines for review');
select throws_ok($$select public.post_daily_sales_batch((select id from public.daily_sales_batches where entry_kind='ADDITIONAL' and branch_id='46000000-0000-4000-8000-000000000001'))$$,'P0001','Insufficient stock for Daily Sales Product (DS-PC-1): available 5.000, requested 6.000','Combined shortage rejects the whole batch');
select is((select quantity_on_hand from public.branch_inventory where branch_id='46000000-0000-4000-8000-000000000001' and variant_id='57600000-0000-4000-8000-000000000001'),5.000::numeric,'Insufficient-stock failure leaves stock unchanged');
select is((select count(*) from public.stock_movements where reference_type='DAILY_SALES_BATCH'),'2'::bigint,'Insufficient-stock failure rolls back every movement');
select is((select count(*) from public.reporting_sales((now() at time zone 'Africa/Accra')::date,(now() at time zone 'Africa/Accra')::date,'46000000-0000-4000-8000-000000000001',100,0) where sale_number like 'DS-%'),'1'::bigint,'Posted daily batch appears once in sales reporting');
select is((select amount_paid from public.reporting_sales((now() at time zone 'Africa/Accra')::date,(now() at time zone 'Africa/Accra')::date,'46000000-0000-4000-8000-000000000001',100,0) where sale_number like 'DS-%'),null::numeric,'Daily sales revenue does not fabricate collections');
select is((select balance_due from public.reporting_sales((now() at time zone 'Africa/Accra')::date,(now() at time zone 'Africa/Accra')::date,'46000000-0000-4000-8000-000000000001',100,0) where sale_number like 'DS-%'),null::numeric,'Daily sales revenue does not fabricate receivables');

select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.reverse_daily_sales_batch((select id from public.daily_sales_batches where branch_id='46000000-0000-4000-8000-000000000001' and entry_kind='STANDARD'),'Daily close was entered incorrectly')$$,'Owner can reverse a posted batch with a reason');
select is((select status from public.daily_sales_batches where branch_id='46000000-0000-4000-8000-000000000001' and entry_kind='STANDARD'),'REVERSED','Reversed batch remains in history');
select is((select quantity_on_hand from public.branch_inventory where branch_id='46000000-0000-4000-8000-000000000001' and variant_id='57600000-0000-4000-8000-000000000001'),10.000::numeric,'Reversal restores stock');
select is((select count(*) from public.stock_movements where reference_type='DAILY_SALES_BATCH'),'4'::bigint,'Reversal movements are separately auditable');
select is((select count(*) from public.reporting_sales((now() at time zone 'Africa/Accra')::date,(now() at time zone 'Africa/Accra')::date,'46000000-0000-4000-8000-000000000001',100,0) where sale_number like 'DS-%'),'0'::bigint,'Reversed batch is removed from active revenue reporting');
select lives_ok($$select public.save_daily_sales_draft(null,'46000000-0000-4000-8000-000000000001',(now() at time zone 'Africa/Accra')::date,null,'CORRECTION',null,(select id from public.daily_sales_batches where status='REVERSED' and branch_id='46000000-0000-4000-8000-000000000001'),'[{"variant_id":"57600000-0000-4000-8000-000000000001","quantity":1,"actual_unit_selling_price":10}]')$$,'Owner can prepare a linked correction for a reversed batch');
select is((select correction_of_batch_id from public.daily_sales_batches where entry_kind='CORRECTION' and branch_id='46000000-0000-4000-8000-000000000001'),(select id from public.daily_sales_batches where status='REVERSED' and branch_id='46000000-0000-4000-8000-000000000001'),'Correction remains linked to the original reversed batch');

set local role postgres;
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.assert_daily_sales_date((now() at time zone 'Africa/Accra')::date - 1)$$,'P0001','Only a Super Admin or Owner may backdate transactions','Branch Manager cannot backdate a sales batch');
select set_config('request.jwt.claims','{"sub":"36000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.assert_daily_sales_date((now() at time zone 'Africa/Accra')::date - 1)$$,'Owner may use a previous business date');
select throws_ok($$select public.assert_daily_sales_date((now() at time zone 'Africa/Accra')::date + 1)$$,'P0001','Future transaction dates are not permitted','Future dates are rejected even for the Owner');

select * from finish();
rollback;
