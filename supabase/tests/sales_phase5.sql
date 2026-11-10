begin;create extension if not exists pgtap with schema extensions;select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('34000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager5@test.invalid','',now(),'{}','{}',now(),now()),
('34000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sales5@test.invalid','',now(),'{}','{}',now(),now()),
('34000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inventory5@test.invalid','',now(),'{}','{}',now(),now()),
('34000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','inactive5@test.invalid','',now(),'{}','{}',now(),now()),
('34000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner5@test.invalid','',now(),'{}','{}',now(),now());
update public.profiles set role_id=case id when '34000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000003'::uuid when '34000000-0000-4000-8000-000000000002' then '10000000-0000-4000-8000-000000000004'::uuid when '34000000-0000-4000-8000-000000000003' then '10000000-0000-4000-8000-000000000005'::uuid when '34000000-0000-4000-8000-000000000005' then '10000000-0000-4000-8000-000000000002'::uuid else '10000000-0000-4000-8000-000000000004'::uuid end,is_active=id<>'34000000-0000-4000-8000-000000000004' where id::text like '34000000%';
insert into public.branches(id,code,name,address,phone) values('43000000-0000-4000-8000-000000000001','SAL-A','Sales A','Test A','000'),('43000000-0000-4000-8000-000000000002','SAL-B','Sales B','Test B','000');
insert into public.financial_accounts(id,code,name,account_type,created_by) values
('44000000-0000-4000-8000-000000000001','S5-CASH-A','Sales A Cash','CASH','34000000-0000-4000-8000-000000000005'),('44000000-0000-4000-8000-000000000002','S5-MM-A','Sales A Mobile','MOBILE_MONEY','34000000-0000-4000-8000-000000000005'),('44000000-0000-4000-8000-000000000003','S5-BANK-A','Sales A Bank','BANK','34000000-0000-4000-8000-000000000005'),
('44000000-0000-4000-8000-000000000004','S5-CASH-B','Sales B Cash','CASH','34000000-0000-4000-8000-000000000005'),('44000000-0000-4000-8000-000000000005','S5-MM-B','Sales B Mobile','MOBILE_MONEY','34000000-0000-4000-8000-000000000005'),('44000000-0000-4000-8000-000000000006','S5-BANK-B','Sales B Bank','BANK','34000000-0000-4000-8000-000000000005');
insert into public.financial_account_branches(account_id,branch_id) values
('44000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001'),('44000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000001'),('44000000-0000-4000-8000-000000000003','43000000-0000-4000-8000-000000000001'),
('44000000-0000-4000-8000-000000000004','43000000-0000-4000-8000-000000000002'),('44000000-0000-4000-8000-000000000005','43000000-0000-4000-8000-000000000002'),('44000000-0000-4000-8000-000000000006','43000000-0000-4000-8000-000000000002');
insert into public.user_branches(user_id,branch_id) select u,'43000000-0000-4000-8000-000000000001'::uuid from(values('34000000-0000-4000-8000-000000000001'::uuid),('34000000-0000-4000-8000-000000000002'::uuid),('34000000-0000-4000-8000-000000000003'::uuid),('34000000-0000-4000-8000-000000000004'::uuid))x(u);
insert into public.categories(id,name,slug) values('51300000-0000-4000-8000-000000000001','Sales Test','sales-test');insert into public.units_of_measure(id,code,name,symbol,allows_decimal) values('53300000-0000-4000-8000-000000000001','S5PC','Sales Pieces','pc',false),('53300000-0000-4000-8000-000000000002','S5M','Sales Metres','m',true);
insert into public.products(id,name,category_id,unit_of_measure_id) values('56300000-0000-4000-8000-000000000001','Sales Product A','51300000-0000-4000-8000-000000000001','53300000-0000-4000-8000-000000000001'),('56300000-0000-4000-8000-000000000002','Sales Product B','51300000-0000-4000-8000-000000000001','53300000-0000-4000-8000-000000000001');insert into public.product_variants(id,product_id,name,sku,is_default) values('57300000-0000-4000-8000-000000000001','56300000-0000-4000-8000-000000000001','Standard','SAL-A',true),('57300000-0000-4000-8000-000000000002','56300000-0000-4000-8000-000000000002','Standard','SAL-B',true);update public.products set status='ACTIVE' where id::text like '56300000%';insert into public.product_prices(variant_id,price_type,amount) values('57300000-0000-4000-8000-000000000001','RETAIL',100),('57300000-0000-4000-8000-000000000002','RETAIL',50),('57300000-0000-4000-8000-000000000001','WHOLESALE',90);

set local role authenticated;select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok(public.has_permission('sales.cancel'),'Manager has sale cancellation permission');select lives_ok($$select public.create_customer('Named Customer','CONTRACTOR','Build Co','0201111111','named@test.invalid',null,null)$$,'Named customer creates');select is((select count(*) from public.customers where is_walk_in),1::bigint,'Exactly one Walk-In customer exists');select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000005","role":"authenticated"}',true);select throws_ok($$select public.set_customer_active('90000000-0000-4000-8000-000000000001',false)$$,'P0001','The Walk-In Customer cannot be archived','Walk-In customer is protected');select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.post_opening_stock_batch('43000000-0000-4000-8000-000000000001','[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":50},{"variant_id":"57300000-0000-4000-8000-000000000002","quantity":5}]','Sales opening')$$,'Opening stock establishes sale fixtures');

select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.create_sale('43000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001',null,'Paid walk-in',0,null,'[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":10,"price_type":"RETAIL","discount_amount":0}]')$$,'Draft Walk-In sale creates');select is((select quantity_on_hand from public.branch_inventory where variant_id='57300000-0000-4000-8000-000000000001'),50.000::numeric,'Draft does not reduce stock');select is((select count(*) from public.stock_movements where movement_type='SALE'),0::bigint,'Draft creates no SALE movement');select is((select receipt_number from public.sales where notes='Paid walk-in'),null,'Draft has no receipt');
select throws_ok($$select public.complete_sale((select id from public.sales where notes='Paid walk-in'),'82000000-0000-4000-8000-000000000001',200,'CASH',null,null)$$,'P0001','A named customer is required for a credit sale','Walk-In partial payment rejected');select is((select quantity_on_hand from public.branch_inventory where variant_id='57300000-0000-4000-8000-000000000001'),50.000::numeric,'Rejected Walk-In credit leaves stock unchanged');
select lives_ok($$select public.complete_sale((select id from public.sales where notes='Paid walk-in'),'82000000-0000-4000-8000-000000000002',1000,'CASH','CASH-1',null)$$,'Fully paid sale completes');select is((select quantity_on_hand from public.branch_inventory where variant_id='57300000-0000-4000-8000-000000000001'),40.000::numeric,'Completed sale reduces stock to 40');select is((select quantity_delta from public.stock_movements where movement_type='SALE'),(-10.000)::numeric,'SALE movement is negative 10');select is((select status::text||'/'||payment_status::text||'/'||amount_paid::text||'/'||balance_due::text from public.sales where notes='Paid walk-in'),'COMPLETED/PAID/1000.00/0.00','Paid sale fields reconcile');select ok((select receipt_number like 'RCP-%' from public.sales where notes='Paid walk-in'),'Receipt number generated');select lives_ok($$select public.complete_sale((select id from public.sales where notes='Paid walk-in'),'82000000-0000-4000-8000-000000000002',1000,'CASH',null,null)$$,'Duplicate completion returns existing sale');select is((select count(*) from public.stock_movements where movement_type='SALE'),1::bigint,'Duplicate completion does not duplicate stock movement');select is((select count(*) from public.customer_payments where sale_id=(select id from public.sales where notes='Paid walk-in')),1::bigint,'Duplicate completion does not duplicate payment');

select lives_ok($$select public.create_sale('43000000-0000-4000-8000-000000000001',(select id from public.customers where name='Named Customer'),current_date+30,'Partial credit',0,null,'[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":5,"price_type":"RETAIL","discount_amount":0}]')$$,'Named customer sale draft creates');select lives_ok($$select public.complete_sale((select id from public.sales where notes='Partial credit'),'82000000-0000-4000-8000-000000000003',200,'MOBILE_MONEY','MM-1',null)$$,'Partial credit sale completes');select is((select payment_status::text||'/'||balance_due::text from public.sales where notes='Partial credit'),'PARTIALLY_PAID/300.00','Partial receivable is 300');select is((select balance_due from public.receivables where sale_number=(select sale_number from public.sales where notes='Partial credit')),300.00::numeric,'Receivable view exposes 300');
select lives_ok($$select public.record_customer_payment((select id from public.customers where name='Named Customer'),(select id from public.sales where notes='Partial credit'),'43000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',100,'BANK_TRANSFER','BANK-1',now(),null)$$,'Later payment records');select is((select balance_due from public.sales where notes='Partial credit'),200.00::numeric,'Later payment reduces balance to 200');select lives_ok($$select public.record_customer_payment((select id from public.customers where name='Named Customer'),(select id from public.sales where notes='Partial credit'),'43000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',100,'BANK_TRANSFER','BANK-1',now(),null)$$,'Duplicate later payment is idempotent');select is((select balance_due from public.sales where notes='Partial credit'),200.00::numeric,'Duplicate payment leaves balance unchanged');select throws_ok($$select public.record_customer_payment((select id from public.customers where name='Named Customer'),(select id from public.sales where notes='Partial credit'),'43000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002',201,'CASH',null,now(),null)$$,'P0001','The payment exceeds the outstanding balance','Overpayment rejected');select lives_ok($$select public.record_customer_payment((select id from public.customers where name='Named Customer'),(select id from public.sales where notes='Partial credit'),'43000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000003',200,'CASH','FINAL',now(),null)$$,'Final payment records');select is((select payment_status::text||'/'||balance_due::text from public.sales where notes='Partial credit'),'PAID/0.00','Final payment settles sale');

select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000001","role":"authenticated"}',true);select lives_ok($$select public.reverse_customer_payment((select id from public.customer_payments where payment_reference='FINAL'),'Incorrect amount')$$,'Payment reversal succeeds');select is((select status::text from public.customer_payments where payment_reference='FINAL'),'REVERSED','Original payment remains marked reversed');select is((select payment_status::text||'/'||balance_due::text from public.sales where notes='Partial credit'),'PARTIALLY_PAID/200.00','Reversal restores balance');select throws_ok($$select public.reverse_customer_payment((select id from public.customer_payments where payment_reference='FINAL'),'Again')$$,'P0001','Only a posted payment can be reversed','Double reversal rejected');select throws_ok($$select public.cancel_sale((select id from public.sales where notes='Partial credit'),'Wrong sale')$$,'P0001','Reverse the posted payments before cancelling this sale','Sale with active payment cannot cancel');

select lives_ok($$select public.create_sale('43000000-0000-4000-8000-000000000001',(select id from public.customers where name='Named Customer'),null,'Cancellation test',0,null,'[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":3,"price_type":"RETAIL","discount_amount":0}]')$$,'Cancellation draft creates');select lives_ok($$select public.complete_sale((select id from public.sales where notes='Cancellation test'),'82000000-0000-4000-8000-000000000004',0,null,null,null)$$,'Unpaid named sale completes');select is((select quantity_on_hand from public.branch_inventory where variant_id='57300000-0000-4000-8000-000000000001'),32.000::numeric,'Cancellation fixture deducts three');select lives_ok($$select public.cancel_sale((select id from public.sales where notes='Cancellation test'),'Erroneous transaction')$$,'Completed unpaid sale cancels');select is((select quantity_on_hand from public.branch_inventory where variant_id='57300000-0000-4000-8000-000000000001'),35.000::numeric,'Cancellation restores inventory');select is((select count(*) from public.stock_movements where movement_type='SALE_REVERSAL' and reference_id=(select id from public.sales where notes='Cancellation test')),1::bigint,'SALE_REVERSAL preserves restoration');select throws_ok($$select public.cancel_sale((select id from public.sales where notes='Cancellation test'),'Again')$$,'P0001','This sale has already been cancelled','Second cancellation rejected');

select lives_ok($$select public.create_sale('43000000-0000-4000-8000-000000000001',(select id from public.customers where name='Named Customer'),null,'Insufficient multi',0,null,'[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":1,"price_type":"RETAIL","discount_amount":0},{"variant_id":"57300000-0000-4000-8000-000000000002","quantity":6,"price_type":"RETAIL","discount_amount":0}]')$$,'Multi-item insufficient draft creates');select throws_ok($$select public.complete_sale((select id from public.sales where notes='Insufficient multi'),'82000000-0000-4000-8000-000000000005',0,null,null,null)$$,'P0001','There is not enough stock to complete this operation','Insufficient second item rejects sale');select is((select quantity_on_hand from public.branch_inventory where variant_id='57300000-0000-4000-8000-000000000001'),35.000::numeric,'Multi-item failure rolls back first item');select is((select status::text from public.sales where notes='Insufficient multi'),'DRAFT','Failed sale remains draft');

select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000002","role":"authenticated"}',true);select throws_ok($$select public.create_sale('43000000-0000-4000-8000-000000000001',(select id from public.customers where name='Named Customer'),null,'Override attack',0,null,'[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":1,"price_type":"RETAIL","unit_price":50,"override_reason":"Attack","discount_amount":0}]')$$,'P0001','You do not have permission to override this price','Unauthorized price override denied');select throws_ok($$update public.branch_inventory set quantity_on_hand=999$$,'42501',null,'Direct stock update denied');select throws_ok($$insert into public.stock_movements(branch_id,variant_id,movement_type,quantity_delta,balance_before,balance_after,reference_type,performed_by) values('43000000-0000-4000-8000-000000000001','57300000-0000-4000-8000-000000000001','SALE',-1,35,34,'SALE','34000000-0000-4000-8000-000000000002')$$,'42501',null,'Direct SALE movement denied');select throws_ok($$update public.sales set total_amount=1 where notes='Paid walk-in'$$,'42501',null,'Completed sale direct mutation denied');select throws_ok($$delete from public.customer_payments$$,'42501',null,'Posted payment deletion denied');

select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000005","role":"authenticated"}',true);select lives_ok($$select public.create_sale('43000000-0000-4000-8000-000000000002',(select id from public.customers where name='Named Customer'),null,'Branch B sale',0,null,'[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":1,"price_type":"RETAIL","discount_amount":0}]')$$,'Owner creates Branch B sale');select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000002","role":"authenticated"}',true);select is((select count(*) from public.sales where notes='Branch B sale'),0::bigint,'Branch A SALES cannot read Branch B sale');select throws_ok($$select public.complete_sale((select id from public.sales where notes='Branch B sale'),'82000000-0000-4000-8000-000000000006',0,null,null,null)$$,'P0001','Sale not found','RLS hides cross-branch sale from completion lookup');select throws_ok($$select public.create_sale('43000000-0000-4000-8000-000000000002',(select id from public.customers where name='Named Customer'),null,'Cross branch',0,null,'[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":1,"price_type":"RETAIL","discount_amount":0}]')$$,'P0001','You do not have permission to create a sale for this branch','Cross-branch sale creation denied');

select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000003","role":"authenticated"}',true);select throws_ok($$select public.complete_sale((select id from public.sales where notes='Insufficient multi'),'82000000-0000-4000-8000-000000000007',0,null,null,null)$$,'P0001','You do not have permission to complete this sale','Inventory role cannot complete sales');select throws_ok($$select public.record_customer_payment((select id from public.customers where name='Named Customer'),(select id from public.sales where notes='Partial credit'),'43000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000004',1,'CASH',null,now(),null)$$,'P0001','You do not have permission to record this payment','Inventory role cannot record payments');
select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000004","role":"authenticated"}',true);select is((select count(*) from public.sales),0::bigint,'Inactive user cannot read sales');select is((select count(*) from public.receivables),0::bigint,'Inactive user cannot read receivables');set local role anon;select set_config('request.jwt.claims','{"role":"anon"}',true);select is((select count(*) from public.customers),0::bigint,'Anonymous cannot read customers');select is((select count(*) from public.sales),0::bigint,'Anonymous cannot read sales');
set local role postgres;select is((select count(*) from public.inventory_integrity_issues()),0::bigint,'Inventory ledger reconciles after sales and cancellation');select is((select count(*) from public.sales_integrity_issues() i join public.sales s on s.id=i.sale_id where s.created_by in('34000000-0000-4000-8000-000000000001','34000000-0000-4000-8000-000000000002','34000000-0000-4000-8000-000000000005')),0::bigint,'Payment and sale totals reconcile for this fixture');select is((select outstanding_balance from public.customer_balances where customer_id=(select id from public.customers where name='Named Customer')),200.00::numeric,'Customer balance equals outstanding completed sales');update public.product_prices set amount=250 where variant_id='57300000-0000-4000-8000-000000000001' and price_type='RETAIL';select is((select unit_price from public.sale_items where sale_id=(select id from public.sales where notes='Paid walk-in')),100.00::numeric,'Sale item preserves price snapshot after current price changes');select ok((select count(*)>=10 from public.audit_logs where action like 'sale.%' or action like 'customer_payment.%' or action like 'customer.%'),'Sales and customer actions are audited');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok($$select public.create_sale(
  '43000000-0000-4000-8000-000000000001',
  (select id from public.customers where name='Named Customer'),
  null, 'Repeated item rows', 0, null,
  '[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":2,"price_type":"RETAIL","discount_amount":0},{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":3,"price_type":"RETAIL","discount_amount":0}]'
)$$, 'Same product can be entered on separate sale lines');
select is(
  (select count(*) from public.sale_items
   where sale_id=(select id from public.sales where notes='Repeated item rows')),
  2::bigint,
  'Repeated product lines are preserved as separate sale rows'
);
select is(
  (select total_amount from public.sales where notes='Repeated item rows'),
  1250.00::numeric,
  'Sale total includes every repeated product line'
);
select lives_ok($$select public.complete_sale(
  (select id from public.sales where notes='Repeated item rows'),
  '82000000-0000-4000-8000-000000000008', 0, null, null, null
)$$, 'Sale with repeated product lines can be completed');
select set_config('request.jwt.claims','{"sub":"34000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.create_sale(
  '43000000-0000-4000-8000-000000000001',
  (select id from public.customers where name='Named Customer'),
  null, 'Price override without reason', 0, null,
  '[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":1,"price_type":"RETAIL","unit_price":200,"discount_amount":0}]'
)$$, 'Authorized price override does not require a reason');
select ok(
  (select si.price_override_reason is null
   from public.sale_items si
   join public.sales s on s.id=si.sale_id
   where s.notes='Price override without reason'),
  'Price override is saved without a reason field'
);
select lives_ok($$select public.create_sale(
  '43000000-0000-4000-8000-000000000001',
  (select id from public.customers where name='Named Customer'),
  null, 'Retail-only sale', 0, null,
  '[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":1,"price_type":"WHOLESALE","discount_amount":0}]'
)$$, 'Sale creation always uses retail pricing even if a caller supplies wholesale');
select is(
  (select si.price_type::text || '/' || si.unit_price::text
   from public.sale_items si
   join public.sales s on s.id=si.sale_id
   where s.notes='Retail-only sale'),
  'RETAIL/250.00',
  'Sale line records the retail type and retail price'
);
select throws_ok($$select public.create_sale(
  '43000000-0000-4000-8000-000000000001',
  (select id from public.customers where name='Named Customer'),
  null, 'Sale discount rejected', 1, 'No longer supported',
  '[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":1,"discount_amount":0}]'
)$$, 'P0001', 'Sale-wide discounts are not supported', 'Sale-wide discounts are rejected by the database');
select throws_ok($$select public.create_sale(
  '43000000-0000-4000-8000-000000000001',
  (select id from public.customers where name='Named Customer'),
  null, 'Line discount rejected', 0, null,
  '[{"variant_id":"57300000-0000-4000-8000-000000000001","quantity":1,"discount_amount":1}]'
)$$, 'P0001', 'Line discounts are not supported', 'Line discounts are rejected by the database');
set local role postgres;
select ok(
  not exists (
    select 1 from pg_constraint
    where conrelid='public.sale_items'::regclass
      and conname='sale_items_sale_id_variant_id_key'
  ),
  'Database no longer blocks repeated product variants on a sale'
);
select is(
  (select quantity_on_hand from public.branch_inventory
   where variant_id='57300000-0000-4000-8000-000000000001'),
  30.000::numeric,
  'Completion deducts the combined quantity from repeated product lines'
);
select is((select count(*) from public.inventory_integrity_issues()),0::bigint,'Repeated product sale keeps inventory ledger reconciled');
select is((select count(*) from public.sales_integrity_issues() i join public.sales s on s.id=i.sale_id where s.created_by='34000000-0000-4000-8000-000000000002'),0::bigint,'Repeated product sale keeps totals reconciled');
select is((select count(*) from public.financial_movements where operation_key='82000000-0000-4000-8000-000000000002' and movement_kind='CUSTOMER_COLLECTION' and direction='IN'),1::bigint,'Initial sale payment posts one customer collection ledger movement');
select is((select count(*) from public.financial_movements where operation_key=md5((select id::text from public.customer_payments where payment_reference='FINAL')||':customer-payment-reversal')::uuid and reference_type='CUSTOMER_PAYMENT_REVERSAL' and direction='OUT'),1::bigint,'Customer payment reversal posts a compensating ledger outflow');
select * from finish();rollback;
