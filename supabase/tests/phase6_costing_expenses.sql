begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('63000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'phase6-owner@test.invalid', '', now(), '{}', '{}', now(), now());
update public.profiles set role_id = (select id from public.roles where code = 'SUPER_ADMIN'), is_active = true
where id = '63000000-0000-4000-8000-000000000001';
insert into public.branches(id, code, name, address, phone)
values ('64000000-0000-4000-8000-000000000001', 'P6-A', 'Phase 6 Test Branch', 'Test', '000');
insert into public.categories(id, name, slug)
values ('65000000-0000-4000-8000-000000000001', 'Phase 6 Tiles', 'phase-6-tiles');
insert into public.units_of_measure(id, code, name, symbol, allows_decimal)
values ('66000000-0000-4000-8000-000000000001', 'P6BOX', 'Boxes', 'box', false);
insert into public.products(id, name, category_id, unit_of_measure_id)
values ('67000000-0000-4000-8000-000000000001', 'Phase 6 Tile', '65000000-0000-4000-8000-000000000001', '66000000-0000-4000-8000-000000000001');
insert into public.product_variants(id, product_id, name, sku, is_default)
values ('68000000-0000-4000-8000-000000000001', '67000000-0000-4000-8000-000000000001', '60 x 60', 'P6-TILE', true);
update public.products set status = 'ACTIVE' where id = '67000000-0000-4000-8000-000000000001';
insert into public.product_prices(variant_id, price_type, amount, effective_from)
values ('68000000-0000-4000-8000-000000000001', 'RETAIL', 20, now() - interval '1 day');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"63000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.create_supplier('Phase 6 Cost Supplier', null, null, null, null, null, null)$$,
  'Owner can create a supplier for a receipt-cost integration test');
select lives_ok($$select public.save_purchase_order(null,
  (select id from public.suppliers where name='Phase 6 Cost Supplier'),
  '64000000-0000-4000-8000-000000000001', current_date, null, null, null, 0, 0,
  '[{"variant_id":"68000000-0000-4000-8000-000000000001","quantity":10,"unit_cost":9,"discount_amount":0}]', true)$$,
  'A purchase order is available to receive at actual cost');
select lives_ok($$select public.post_goods_receipt(
  (select id from public.purchases where supplier_id=(select id from public.suppliers where name='Phase 6 Cost Supplier')),
  '69000000-0000-4000-8000-000000000001', null, null, current_date,
  jsonb_build_array(jsonb_build_object('purchase_item_id',
    (select id from public.purchase_items where purchase_id=(select id from public.purchases where supplier_id=(select id from public.suppliers where name='Phase 6 Cost Supplier'))),
    'quantity', 10, 'actual_unit_cost', 12)),
  '[]'::jsonb)$$, 'Receipt cost posts atomically into inventory costing');
select is((select weighted_average_cost from public.branch_inventory_costs where branch_id='64000000-0000-4000-8000-000000000001' and variant_id='68000000-0000-4000-8000-000000000001'), 12.000000::numeric,
  'The actual receipt cost, not the PO estimate, establishes WAC');
select is((select inventory_value from public.branch_inventory_costs where branch_id='64000000-0000-4000-8000-000000000001' and variant_id='68000000-0000-4000-8000-000000000001'), 120.0000::numeric,
  'Receipt inventory value is quantity times actual unit cost');

set local role postgres;
insert into public.customers(id, customer_code, customer_type, name, is_walk_in)
values ('6a000000-0000-4000-8000-000000000001', 'P6-CUS', 'INDIVIDUAL', 'Phase 6 Customer', false);
insert into public.sales(id, sale_number, branch_id, customer_id, created_by)
values ('6b000000-0000-4000-8000-000000000001', 'P6-SALE', '64000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001');
insert into public.sale_items(id, sale_id, variant_id, quantity, price_type, suggested_unit_price, unit_price,
  line_total, product_name_snapshot, variant_name_snapshot, sku_snapshot, unit_snapshot)
values ('6c000000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000001',
  '68000000-0000-4000-8000-000000000001', 2, 'RETAIL', 20, 20, 40, 'Phase 6 Tile', '60 x 60', 'P6-TILE', 'box');
do $$ declare movement uuid;
begin
  movement := public.inventory_apply_movement('64000000-0000-4000-8000-000000000001',
    '68000000-0000-4000-8000-000000000001', 'SALE', -2, 'SALE', '6b000000-0000-4000-8000-000000000001', 'P6-SALE', null);
  update public.sale_items set stock_movement_id=movement where id='6c000000-0000-4000-8000-000000000001';
  update public.sales set status='COMPLETED' where id='6b000000-0000-4000-8000-000000000001';
end $$;
select is((select cost_total_snapshot from public.sale_items where id='6c000000-0000-4000-8000-000000000001'), 24.0000::numeric,
  'Sale line captures COGS at the WAC that was active when stock left');
select is((select gross_profit from public.sales_profitability_events where line_id='6c000000-0000-4000-8000-000000000001'), 16.0000::numeric,
  'Profitability view derives gross profit from actual revenue less complete COGS');

select lives_ok($$select public.create_financial_account('P6-CASH','Phase 6 Cash','CASH',array['64000000-0000-4000-8000-000000000001'::uuid])$$,
  'Owner can create an account assigned to a branch');
select lives_ok($$select public.decide_expense(
  public.create_expense('64000000-0000-4000-8000-000000000001',
    (select id from public.expense_categories where code='TRANSPORT'), 'Delivery to branch',
    (now() at time zone 'Africa/Accra')::date, 50, 'Courier', null, 'Test receipt'), true, null)$$,
  'Expense workflow can create and approve an expense');
select throws_ok($$update public.expenses set receipt_object_path='65000000-0000-4000-8000-000000000001/receipt.pdf' where description='Delivery to branch'$$,
  '23514', null, 'An expense cannot point at another branch receipt object');
select lives_ok($$select public.pay_expense((select id from public.expenses where description='Delivery to branch'),
  (select id from public.financial_accounts where code='P6-CASH'),
  '6d000000-0000-4000-8000-000000000001', 50, (now() at time zone 'Africa/Accra')::date, 'P6-REF', null)$$,
  'Paying an approved expense posts a financial ledger movement');
select is((select movement_kind::text || '/' || direction::text || '/' || amount::text from public.financial_movements
  where operation_key='6d000000-0000-4000-8000-000000000001'), 'EXPENSE_PAYMENT/OUT/50.00',
  'Expense payment is reflected exactly once as an account outflow');

select lives_ok($$select public.complete_sale_with_account(
  public.create_sale('64000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001',current_date,null,'Ledger customer sale',0,'',
    '[{"variant_id":"68000000-0000-4000-8000-000000000001","quantity":1,"price_type":"RETAIL","discount_amount":0}]'::jsonb),
  '6e000000-0000-4000-8000-000000000001',10,'CASH',null,null,current_date,
  (select id from public.financial_accounts where code='P6-CASH'))$$,
  'Completing a partially paid sale requires and posts the selected financial account');
select is((select movement_kind::text||'/'||direction::text||'/'||amount::text from public.financial_movements where operation_key='6e000000-0000-4000-8000-000000000001'),
  'CUSTOMER_COLLECTION/IN/10.00','Customer collections enter the immutable account ledger once');
select lives_ok($$select public.initialize_financial_account((select id from public.financial_accounts where code='P6-CASH'),
  '64000000-0000-4000-8000-000000000001','6f000000-0000-4000-8000-000000000001',100,(now() at time zone 'Africa/Accra')::date,'Counted cash at setup')$$,
  'Account opening balance can be posted once with a source note');
select is((select book_balance from public.financial_account_balances where code='P6-CASH'),60.00::numeric,
  'Account balance reconciles opening cash, collection and expense payment');
select lives_ok($$select public.record_financial_reconciliation((select id from public.financial_accounts where code='P6-CASH'),
  '64000000-0000-4000-8000-000000000001',(now() at time zone 'Africa/Accra')::date,60,'Statement checked')$$,
  'Matching account statement can be reconciled');
select is((select status from public.financial_reconciliations order by created_at desc limit 1),'MATCHED',
  'Matched reconciliation records a zero variance');
select is((public.reporting_profit_and_loss((now() at time zone 'Africa/Accra')::date,(now() at time zone 'Africa/Accra')::date,'64000000-0000-4000-8000-000000000001')->>'gross_profit')::numeric,24.00::numeric,
  'Profit-and-loss report sums recognized revenue and known WAC');
select is((public.reporting_profit_and_loss((now() at time zone 'Africa/Accra')::date,(now() at time zone 'Africa/Accra')::date,'64000000-0000-4000-8000-000000000001')->>'operating_profit')::numeric,-26.00::numeric,
  'Profit-and-loss report subtracts approved expenses');
select is((public.reporting_profit_and_loss((now() at time zone 'Africa/Accra')::date,(now() at time zone 'Africa/Accra')::date,'64000000-0000-4000-8000-000000000001')->>'cost_complete')::boolean,true,
  'P&L explicitly indicates complete recognized costs before historical correction');
select lives_ok($$select public.initialize_inventory_cost('64000000-0000-4000-8000-000000000001','68000000-0000-4000-8000-000000000001',12,'Current verified stocktake')$$,
  'Documented physical stocktake provides a cost baseline');
select lives_ok($$select public.save_purchase_order(null,public.create_supplier('Phase 6 Backdate Supplier',null,null,null,null,null,null),
  '64000000-0000-4000-8000-000000000001',current_date,null,null,null,0,0,
  '[{"variant_id":"68000000-0000-4000-8000-000000000001","quantity":2,"unit_cost":18,"discount_amount":0}]'::jsonb,true)$$,
  'Purchase document can be prepared for a prior-date receipt replay case');
select lives_ok($$select public.post_goods_receipt((select id from public.purchases where supplier_id=(select id from public.suppliers where name='Phase 6 Backdate Supplier')),
  '6f000000-0000-4000-8000-000000000002',null,null,(now() at time zone 'Africa/Accra')::date-1,
  jsonb_build_array(jsonb_build_object('purchase_item_id',(select id from public.purchase_items where purchase_id=(select id from public.purchases where supplier_id=(select id from public.suppliers where name='Phase 6 Backdate Supplier'))),
    'quantity',2,'actual_unit_cost',18)),'[]'::jsonb)$$,
  'A receipt posted earlier than the cost baseline completes its stock workflow');
-- This pgTAP file is one database transaction, so NOW() is transaction-scoped
-- and equal for the baseline and receipt. Advance the journal-arrival instant
-- to model the later request that occurs in production.
update public.inventory_cost_events set created_at=clock_timestamp() where stock_movement_id in (
  select gri.stock_movement_id from public.goods_receipt_items gri join public.goods_receipts gr on gr.id=gri.goods_receipt_id
  join public.purchases p on p.id=gr.purchase_id join public.suppliers s on s.id=p.supplier_id where s.name='Phase 6 Backdate Supplier');
select public.replay_inventory_cost('64000000-0000-4000-8000-000000000001','68000000-0000-4000-8000-000000000001');
select is((select cost_status::text from public.branch_inventory_costs where branch_id='64000000-0000-4000-8000-000000000001' and variant_id='68000000-0000-4000-8000-000000000001'),'MISSING',
  'Backdated receipt crossing the baseline makes current WAC explicitly unvalued');
select is((select cost_status::text from public.sale_items where id='6c000000-0000-4000-8000-000000000001'),'MISSING',
  'Chronological replay clears previously derived sale cost snapshots when no valid opening history exists');
select is((public.reporting_profit_and_loss((now() at time zone 'Africa/Accra')::date,(now() at time zone 'Africa/Accra')::date,'64000000-0000-4000-8000-000000000001')->>'gross_profit'),null,
  'P&L withholds gross profit when historical cost replay is incomplete');
select is((public.reporting_profit_and_loss((now() at time zone 'Africa/Accra')::date,(now() at time zone 'Africa/Accra')::date,'64000000-0000-4000-8000-000000000001')->>'unvalued_sale_lines')::integer,2,
  'P&L reports the exact number of sale lines with unvalued cost');

select * from finish();
rollback;
