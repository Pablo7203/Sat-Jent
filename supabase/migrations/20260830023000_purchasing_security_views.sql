-- SAT-J Ent Phase 4: branch-aware reads and immutable commercial history.
alter table public.suppliers enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.supplier_payments enable row level security;

create policy suppliers_read on public.suppliers for select to authenticated using(public.has_permission('suppliers.read'));
create policy purchases_read on public.purchases for select to authenticated using(public.has_permission('purchases.read') and public.can_access_branch(branch_id));
create policy purchase_items_read on public.purchase_items for select to authenticated using(public.has_permission('purchases.read') and exists(select 1 from public.purchases p where p.id=purchase_id and public.can_access_branch(p.branch_id)));
create policy goods_receipts_read on public.goods_receipts for select to authenticated using(public.has_permission('purchases.read') and public.can_access_branch(branch_id));
create policy goods_receipt_items_read on public.goods_receipt_items for select to authenticated using(public.has_permission('purchases.read') and exists(select 1 from public.goods_receipts r where r.id=goods_receipt_id and public.can_access_branch(r.branch_id)));
create policy supplier_payments_read on public.supplier_payments for select to authenticated using(public.has_permission('supplier_payments.read') and public.can_access_branch(branch_id));

grant select on public.suppliers,public.purchases,public.purchase_items,public.goods_receipts,public.goods_receipt_items,public.supplier_payments to authenticated;
revoke insert,update,delete on public.suppliers,public.purchases,public.purchase_items,public.goods_receipts,public.goods_receipt_items,public.supplier_payments from anon,authenticated;

create view public.supplier_balances with(security_invoker=true) as
select s.id supplier_id,coalesce(sum(p.balance_due) filter(where p.status<>'CANCELLED'),0)::numeric(14,2) outstanding_balance
from public.suppliers s left join public.purchases p on p.supplier_id=s.id group by s.id;
grant select on public.supplier_balances to authenticated;

create view public.purchase_statement with(security_invoker=true) as
select p.*,s.supplier_code,s.name supplier_name,b.name branch_name
from public.purchases p join public.suppliers s on s.id=p.supplier_id join public.branches b on b.id=p.branch_id;
grant select on public.purchase_statement to authenticated;

revoke all on function public.create_supplier(text,text,text,text,text,text,text),public.update_supplier(uuid,text,text,text,text,text,text,text),public.set_supplier_active(uuid,boolean),public.create_purchase(uuid,uuid,date,date,text,text,numeric,numeric,jsonb),public.order_purchase(uuid),public.cancel_purchase(uuid),public.receive_purchase(uuid,uuid,text,text,jsonb),public.record_supplier_payment(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,date,text) from public;
grant execute on function public.create_supplier(text,text,text,text,text,text,text),public.update_supplier(uuid,text,text,text,text,text,text,text),public.set_supplier_active(uuid,boolean),public.create_purchase(uuid,uuid,date,date,text,text,numeric,numeric,jsonb),public.order_purchase(uuid),public.cancel_purchase(uuid),public.receive_purchase(uuid,uuid,text,text,jsonb),public.record_supplier_payment(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,date,text) to authenticated;
