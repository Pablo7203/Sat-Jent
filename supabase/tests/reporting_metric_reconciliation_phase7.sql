begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A deterministic two-branch business ledger. Inventory and transfer state is
-- created through the production workflows; commercial documents use their
-- authoritative posted-row architecture so every reporting term is explicit.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('37100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','reconcile-owner@test.invalid','',now(),'{}','{}',now(),now());
update public.profiles set role_id='10000000-0000-4000-8000-000000000002',is_active=true where id='37100000-0000-4000-8000-000000000001';
insert into public.branches(id,code,name,address,phone) values
('47100000-0000-4000-8000-000000000001','REC-A','Reconciliation Branch A','Test','000'),
('47100000-0000-4000-8000-000000000002','REC-B','Reconciliation Branch B','Test','000');
insert into public.financial_accounts(id,code,name,account_type,created_by) values
('48100000-0000-4000-8000-000000000001','REC-CASH-A','Reconciliation Cash A','CASH','37100000-0000-4000-8000-000000000001'),('48100000-0000-4000-8000-000000000002','REC-MM-A','Reconciliation Mobile A','MOBILE_MONEY','37100000-0000-4000-8000-000000000001'),('48100000-0000-4000-8000-000000000003','REC-BANK-A','Reconciliation Bank A','BANK','37100000-0000-4000-8000-000000000001'),
('48100000-0000-4000-8000-000000000004','REC-CASH-B','Reconciliation Cash B','CASH','37100000-0000-4000-8000-000000000001'),('48100000-0000-4000-8000-000000000005','REC-MM-B','Reconciliation Mobile B','MOBILE_MONEY','37100000-0000-4000-8000-000000000001'),('48100000-0000-4000-8000-000000000006','REC-BANK-B','Reconciliation Bank B','BANK','37100000-0000-4000-8000-000000000001'),
('48100000-0000-4000-8000-000000000007','REC-CARD-A','Reconciliation Card A','CARD_CLEARING','37100000-0000-4000-8000-000000000001');
insert into public.financial_account_branches(account_id,branch_id) values
('48100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000001'),('48100000-0000-4000-8000-000000000002','47100000-0000-4000-8000-000000000001'),('48100000-0000-4000-8000-000000000003','47100000-0000-4000-8000-000000000001'),
('48100000-0000-4000-8000-000000000004','47100000-0000-4000-8000-000000000002'),('48100000-0000-4000-8000-000000000005','47100000-0000-4000-8000-000000000002'),('48100000-0000-4000-8000-000000000006','47100000-0000-4000-8000-000000000002'),('48100000-0000-4000-8000-000000000007','47100000-0000-4000-8000-000000000001');
insert into public.categories(id,name,slug) values('61100000-0000-4000-8000-000000000001','Reconciliation Products','reconciliation-products');
insert into public.units_of_measure(id,code,name,symbol) values('62100000-0000-4000-8000-000000000001','RECPCS','Reconciliation Pieces','pc');
insert into public.products(id,name,category_id,unit_of_measure_id,status) values('64100000-0000-4000-8000-000000000001','Reconciliation Product','61100000-0000-4000-8000-000000000001','62100000-0000-4000-8000-000000000001','DRAFT');
insert into public.product_variants(id,product_id,name,sku,is_default) values
('65100000-0000-4000-8000-000000000001','64100000-0000-4000-8000-000000000001','Low','REC-LOW',true),
('65100000-0000-4000-8000-000000000002','64100000-0000-4000-8000-000000000001','Out','REC-OUT',false),
('65100000-0000-4000-8000-000000000003','64100000-0000-4000-8000-000000000001','Received','REC-RECEIVED',false),
('65100000-0000-4000-8000-000000000004','64100000-0000-4000-8000-000000000001','Transit','REC-TRANSIT',false);
update public.products set status='ACTIVE' where id='64100000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"37100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is(public.post_opening_stock_batch('47100000-0000-4000-8000-000000000001','[{"variant_id":"65100000-0000-4000-8000-000000000001","quantity":5,"minimum_stock_level":10},{"variant_id":"65100000-0000-4000-8000-000000000002","quantity":0,"minimum_stock_level":5},{"variant_id":"65100000-0000-4000-8000-000000000003","quantity":20,"minimum_stock_level":0},{"variant_id":"65100000-0000-4000-8000-000000000004","quantity":10,"minimum_stock_level":0}]'::jsonb,'Phase 7 reconciliation'),4,'Opening-stock workflow creates the exact inventory fixture');

create temporary table reconciliation_transfers(kind text primary key,id uuid);
insert into reconciliation_transfers values
('received',public.create_transfer('47100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000002','received control',true,'[{"variant_id":"65100000-0000-4000-8000-000000000003","quantity":4}]'::jsonb)),
('transit',public.create_transfer('47100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000002','in-transit metric',true,'[{"variant_id":"65100000-0000-4000-8000-000000000004","quantity":7}]'::jsonb)),
('cancelled',public.create_transfer('47100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000002','cancelled control',true,'[{"variant_id":"65100000-0000-4000-8000-000000000003","quantity":3}]'::jsonb));
select public.approve_transfer(id) from reconciliation_transfers;
select public.dispatch_transfer(id,case kind when 'received' then '77100000-0000-4000-8000-000000000001'::uuid when 'transit' then '77100000-0000-4000-8000-000000000002'::uuid end) from reconciliation_transfers where kind in('received','transit');
select public.receive_transfer(id,'77100000-0000-4000-8000-000000000003') from reconciliation_transfers where kind='received';
select public.cancel_transfer(id,'Excluded reconciliation control') from reconciliation_transfers where kind='cancelled';

reset role;
insert into public.customers(id,customer_code,customer_type,name,created_by) values
('91100000-0000-4000-8000-000000000001','REC-CUS-A','INDIVIDUAL','Reconciliation Customer A','37100000-0000-4000-8000-000000000001'),
('91100000-0000-4000-8000-000000000002','REC-CUS-B','INDIVIDUAL','Reconciliation Customer B','37100000-0000-4000-8000-000000000001');
insert into public.sales(id,sale_number,receipt_number,branch_id,customer_id,status,payment_status,sale_date,payment_due_date,subtotal,total_amount,amount_paid,balance_due,created_by,completed_by,completed_at) values
('81100000-0000-4000-8000-000000000001','REC-SAL-A1','REC-RCP-A1','47100000-0000-4000-8000-000000000001','91100000-0000-4000-8000-000000000001','COMPLETED','PARTIALLY_PAID','2026-08-15 12:00+00','2026-08-20',1000,1000,600,400,'37100000-0000-4000-8000-000000000001','37100000-0000-4000-8000-000000000001','2026-08-15 12:00+00'),
('81100000-0000-4000-8000-000000000002','REC-SAL-A2','REC-RCP-A2','47100000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','COMPLETED','PAID','2026-08-16 12:00+00',null,500,500,500,0,'37100000-0000-4000-8000-000000000001','37100000-0000-4000-8000-000000000001','2026-08-16 12:00+00'),
('81100000-0000-4000-8000-000000000003','REC-SAL-B1','REC-RCP-B1','47100000-0000-4000-8000-000000000002','91100000-0000-4000-8000-000000000002','COMPLETED','PARTIALLY_PAID','2026-08-17 12:00+00','2026-07-17',2000,2000,1000,1000,'37100000-0000-4000-8000-000000000001','37100000-0000-4000-8000-000000000001','2026-08-17 12:00+00'),
('81100000-0000-4000-8000-000000000004','REC-SAL-CANCEL','REC-RCP-CANCEL','47100000-0000-4000-8000-000000000001','91100000-0000-4000-8000-000000000001','CANCELLED','UNPAID','2026-08-18 12:00+00',null,900,900,0,900,'37100000-0000-4000-8000-000000000001',null,null),
('81100000-0000-4000-8000-000000000005','REC-SAL-OUTSIDE','REC-RCP-OUTSIDE','47100000-0000-4000-8000-000000000001','91100000-0000-4000-8000-000000000001','COMPLETED','PAID','2026-07-31 12:00+00',null,300,300,300,0,'37100000-0000-4000-8000-000000000001','37100000-0000-4000-8000-000000000001','2026-07-31 12:00+00');
insert into public.sale_items(sale_id,variant_id,quantity,suggested_unit_price,unit_price,line_total,product_name_snapshot,variant_name_snapshot,sku_snapshot,unit_snapshot) values
('81100000-0000-4000-8000-000000000001','65100000-0000-4000-8000-000000000001',1,1000,1000,1000,'Reconciliation Product','Low','REC-LOW','pc'),
('81100000-0000-4000-8000-000000000002','65100000-0000-4000-8000-000000000002',1,500,500,500,'Reconciliation Product','Out','REC-OUT','pc'),
('81100000-0000-4000-8000-000000000003','65100000-0000-4000-8000-000000000003',1,2000,2000,2000,'Reconciliation Product','Received','REC-RECEIVED','pc'),
('81100000-0000-4000-8000-000000000004','65100000-0000-4000-8000-000000000001',1,900,900,900,'Reconciliation Product','Low','REC-LOW','pc'),
('81100000-0000-4000-8000-000000000005','65100000-0000-4000-8000-000000000001',1,300,300,300,'Reconciliation Product','Low','REC-LOW','pc');
insert into public.customer_payments(id,payment_number,customer_id,sale_id,branch_id,operation_key,amount,payment_method,financial_account_id,payment_date,recorded_by) values
('82100000-0000-4000-8000-000000000001','REC-CPY-A-400','91100000-0000-4000-8000-000000000001','81100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000001','83100000-0000-4000-8000-000000000001',400,'CASH','48100000-0000-4000-8000-000000000001','2026-08-15 12:00+00','37100000-0000-4000-8000-000000000001'),
('82100000-0000-4000-8000-000000000002','REC-CPY-A-REV','91100000-0000-4000-8000-000000000001','81100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000001','83100000-0000-4000-8000-000000000002',200,'CARD_POS','48100000-0000-4000-8000-000000000007','2026-08-15 12:00+00','37100000-0000-4000-8000-000000000001'),
('82100000-0000-4000-8000-000000000003','REC-CPY-A-500','90000000-0000-4000-8000-000000000001','81100000-0000-4000-8000-000000000002','47100000-0000-4000-8000-000000000001','83100000-0000-4000-8000-000000000003',500,'MOBILE_MONEY','48100000-0000-4000-8000-000000000002','2026-08-16 12:00+00','37100000-0000-4000-8000-000000000001'),
('82100000-0000-4000-8000-000000000004','REC-CPY-B-1000','91100000-0000-4000-8000-000000000002','81100000-0000-4000-8000-000000000003','47100000-0000-4000-8000-000000000002','83100000-0000-4000-8000-000000000004',1000,'BANK_TRANSFER','48100000-0000-4000-8000-000000000006','2026-08-17 12:00+00','37100000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"37100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.reverse_customer_payment('82100000-0000-4000-8000-000000000002','Deterministic reversed-payment control')$$,'Production reversal workflow creates the reversed-payment exclusion');
reset role;
insert into public.suppliers(id,supplier_code,name,created_by) values('92100000-0000-4000-8000-000000000001','REC-SUP','Reconciliation Supplier','37100000-0000-4000-8000-000000000001');
insert into public.purchases(id,purchase_number,supplier_id,branch_id,purchase_date,status,payment_status,subtotal,total_amount,amount_paid,balance_due,created_by,payable_value) values
('84100000-0000-4000-8000-000000000001','REC-PUR-A','92100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000001','2026-08-10','ORDERED','PARTIALLY_PAID',1200,1200,500,700,'37100000-0000-4000-8000-000000000001',1200),
('84100000-0000-4000-8000-000000000002','REC-PUR-CANCEL','92100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000001','2026-08-11','CANCELLED','UNPAID',800,800,0,800,'37100000-0000-4000-8000-000000000001',800),
('84100000-0000-4000-8000-000000000003','REC-PUR-B','92100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000002','2026-08-12','ORDERED','PARTIALLY_PAID',2000,2000,750,1250,'37100000-0000-4000-8000-000000000001',2000);
insert into public.supplier_payments(payment_number,supplier_id,purchase_id,branch_id,operation_key,amount,payment_method,financial_account_id,payment_date,recorded_by) values
('REC-SPY-A','92100000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001','47100000-0000-4000-8000-000000000001','85100000-0000-4000-8000-000000000001',500,'CASH','48100000-0000-4000-8000-000000000001','2026-08-10','37100000-0000-4000-8000-000000000001'),
('REC-SPY-B','92100000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000003','47100000-0000-4000-8000-000000000002','85100000-0000-4000-8000-000000000002',750,'BANK_TRANSFER','48100000-0000-4000-8000-000000000006','2026-08-12','37100000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"37100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,sales_revenue}')::numeric,(select coalesce(sum(r.revenue),0) from public.reporting_branch_performance('2026-08-01','2026-08-31',null) r),'Company revenue reconciles to all active and historical branch revenue');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,sales_count}')::bigint,(select coalesce(sum(r.revenue_entries),0)::bigint from public.reporting_branch_performance('2026-08-01','2026-08-31',null) r),'Company sales count reconciles to all active and historical branches');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,collections}')::numeric,1900::numeric,'Company collections exclude the reversed payment');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,receivables}')::numeric,1600::numeric,'Company receivables reconcile to non-walk-in balances');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,purchase_value}')::numeric,3200::numeric,'Company purchase value excludes cancelled purchase');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,supplier_payments}')::numeric,1250::numeric,'Company supplier payments reconcile');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,supplier_balance}')::numeric,(select coalesce(sum((public.dashboard_summary('2026-08-01','2026-08-31',b.id)#>>'{kpis,supplier_balance}')::numeric),0) from public.branches b),'Company supplier balance reconciles across all branches');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,low_stock}')::integer,(select coalesce(sum((public.dashboard_summary('2026-08-01','2026-08-31',b.id)#>>'{kpis,low_stock}')::integer),0)::integer from public.branches b),'Company low-stock count reconciles across all branches');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,out_of_stock}')::integer,1,'Company out-of-stock count reconciles');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,in_transit}')::numeric,1::numeric,'In-transit KPI counts open transfer lines instead of summing unlike product units');

select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,sales_revenue}')::numeric,1500::numeric,'Branch A revenue reconciles');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,sales_count}')::integer,2,'Branch A sales count reconciles');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,collections}')::numeric,900::numeric,'Branch A collections reconcile');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,receivables}')::numeric,600::numeric,'Branch A receivables reconcile');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,purchase_value}')::numeric,1200::numeric,'Branch A purchase value reconciles');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,supplier_payments}')::numeric,500::numeric,'Branch A supplier payments reconcile');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,supplier_balance}')::numeric,700::numeric,'Branch A supplier balance reconciles');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,low_stock}')::integer,1,'Branch A low-stock count reconciles');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,out_of_stock}')::integer,1,'Branch A out-of-stock count reconciles');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{kpis,in_transit}')::numeric,1::numeric,'Branch A open transfer lines reconcile');
select results_eq($$select bucket,amount,sale_count from public.reporting_receivable_aging('2026-08-31',null) order by bucket$$,$$values ('DAYS_1_30'::text,600::numeric,1::bigint),('DAYS_31_60'::text,1000::numeric,1::bigint)$$,'Receivable aging buckets reconcile exactly');
select is((select count(*) from public.reporting_sales('2026-08-01','2026-08-31',null,100,0)),(public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,sales_count}')::bigint,'Sales report row count matches dashboard sales count');
select is((select sum(total_amount) from public.reporting_sales('2026-08-01','2026-08-31',null,100,0)),(public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,sales_revenue}')::numeric,'Sales report revenue matches dashboard revenue');
select is((select count(*) from public.customer_payments where status='REVERSED' and id='82100000-0000-4000-8000-000000000002'),1::bigint,'Fixture proves the production reversed-payment state exists');
select is((select count(*) from public.stock_transfers where status='RECEIVED' and id=(select id from reconciliation_transfers where kind='received')),1::bigint,'Fixture proves received transfer is excluded from in-transit');

-- A sale may be entered later with an earlier business date. Reports must use
-- sale_date while preserving completed_at as posting/audit time.
reset role;
insert into public.sales(id,sale_number,receipt_number,branch_id,customer_id,status,payment_status,sale_date,subtotal,total_amount,amount_paid,balance_due,created_by,completed_by,completed_at) values
('81100000-0000-4000-8000-000000000006','REC-SAL-BACKDATE','REC-RCP-BACKDATE','47100000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','COMPLETED','UNPAID','2026-08-20 12:00+00',75,75,0,75,'37100000-0000-4000-8000-000000000001','37100000-0000-4000-8000-000000000001','2026-09-01 12:00+00');
insert into public.sale_items(sale_id,variant_id,quantity,suggested_unit_price,unit_price,line_total,product_name_snapshot,variant_name_snapshot,sku_snapshot,unit_snapshot) values
('81100000-0000-4000-8000-000000000006','65100000-0000-4000-8000-000000000001',1,75,75,75,'Reconciliation Product','Low','REC-LOW','pc');
insert into public.daily_sales_batches(id,batch_number,branch_id,sales_date,status,entry_kind,total_revenue,created_by) values
('86100000-0000-4000-8000-000000000001','REC-BATCH-POSTED','47100000-0000-4000-8000-000000000001','2026-08-19','DRAFT','STANDARD',0,'37100000-0000-4000-8000-000000000001'),
('86100000-0000-4000-8000-000000000002','REC-BATCH-DRAFT','47100000-0000-4000-8000-000000000001','2026-08-25','DRAFT','STANDARD',0,'37100000-0000-4000-8000-000000000001');
insert into public.daily_sales_batch_items(batch_id,variant_id,quantity,standard_unit_price_snapshot,actual_unit_selling_price,line_total,product_name_snapshot,variant_name_snapshot,item_code_snapshot,unit_snapshot) values
('86100000-0000-4000-8000-000000000001','65100000-0000-4000-8000-000000000001',2,20,20,40,'Reconciliation Product','Low','REC-LOW','pc');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"37100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.post_daily_sales_batch('86100000-0000-4000-8000-000000000001');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"37100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
reset role;
select is((select business_date from public.sales_revenue_events where source_id='81100000-0000-4000-8000-000000000006'),'2026-08-20'::date,'A backdated sale is assigned to its Accra business date, not its later posting date');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"37100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.reporting_sales_periods('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001','month')),1::bigint,'Monthly trend emits one complete selected-period bucket for the fixture branch');
select is((select sum(revenue) from public.reporting_sales_periods('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001','month')),1615::numeric,'Monthly trend reconciles fixture branch sales and posted batches while excluding drafts');
select is((select sum(transaction_count)::bigint from public.reporting_sales_periods('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001','month')),4::bigint,'Monthly trend count reconciles to fixture-branch sales and posted batch entries');
select is((select sum(individual_sale_count)::bigint from public.reporting_sales_periods('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001','month')),3::bigint,'Monthly report distinguishes completed individual fixture sales');
select is((select sum(posted_batch_count)::bigint from public.reporting_sales_periods('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001','month')),1::bigint,'Monthly report distinguishes posted daily sales batches');
select ok((select collections is null from public.reporting_sales_periods('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001','month','DAILY_BATCH')),'Batch-only reporting does not imply untracked cash collections');
select is((public.dashboard_summary('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')#>>'{daily_sales_drafts}')::integer,1,'Dashboard highlights fixture-branch drafts without adding them to revenue');
select ok(public.dashboard_summary('2026-08-01','2026-08-31',null)#>'{kpis,units_sold}'='null'::jsonb,'Dashboard avoids summing unlike units of measure');
select is((public.dashboard_summary('2026-08-01','2026-08-31',null)#>>'{kpis,active_products}')::integer,(select count(*)::integer from public.products where status='ACTIVE'),'Dashboard active product KPI matches the active catalogue');
select is((select count(*) from public.reporting_product_performance('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001','NO_SALES','61100000-0000-4000-8000-000000000001',null,null,50,0)),2::bigint,'No-sales ranking includes stocked active fixture variants with no posted sales');
select is((select count(*) from public.reporting_inventory_current('47100000-0000-4000-8000-000000000001',50,0)),4::bigint,'Current inventory report lists each fixture-branch variant position');
select is((select sum(revenue) from public.reporting_branch_performance('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')),1615::numeric,'Branch performance revenue reconciles with fixture sales and posted batches');
select is((select sum(revenue_entries)::bigint from public.reporting_branch_performance('2026-08-01','2026-08-31','47100000-0000-4000-8000-000000000001')),4::bigint,'Branch performance entry counts reconcile with the fixture period');
select * from finish();
rollback;
