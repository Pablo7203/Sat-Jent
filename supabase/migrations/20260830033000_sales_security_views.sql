-- SAT-J Ent Phase 5: RLS, operational statements and receivable projections.
alter table public.customers enable row level security;alter table public.sales enable row level security;alter table public.sale_items enable row level security;alter table public.customer_payments enable row level security;
create policy customers_read on public.customers for select to authenticated using(public.has_permission('customers.read'));
create policy sales_read on public.sales for select to authenticated using(public.has_permission('sales.read') and public.can_access_branch(branch_id));
create policy sale_items_read on public.sale_items for select to authenticated using(public.has_permission('sales.read') and exists(select 1 from public.sales s where s.id=sale_id and public.can_access_branch(s.branch_id)));
create policy customer_payments_read on public.customer_payments for select to authenticated using(public.has_permission('customer_payments.read') and public.can_access_branch(branch_id));
grant select on public.customers,public.sales,public.sale_items,public.customer_payments to authenticated;
revoke insert,update,delete on public.customers,public.sales,public.sale_items,public.customer_payments from anon,authenticated;

create view public.sales_statement with(security_invoker=true) as select s.*,c.customer_code,c.name customer_name,c.phone customer_phone,c.is_walk_in,b.name branch_name,b.address branch_address,b.phone branch_phone from public.sales s join public.customers c on c.id=s.customer_id join public.branches b on b.id=s.branch_id;
grant select on public.sales_statement to authenticated;
create view public.receivables with(security_invoker=true) as select s.id sale_id,s.sale_number,s.receipt_number,s.branch_id,b.name branch_name,s.customer_id,c.customer_code,c.name customer_name,c.phone customer_phone,s.sale_date,s.payment_due_date,s.total_amount,s.amount_paid,s.balance_due,s.payment_status,(case when s.payment_due_date is not null and s.payment_due_date<current_date then current_date-s.payment_due_date else 0 end) days_overdue from public.sales s join public.customers c on c.id=s.customer_id join public.branches b on b.id=s.branch_id where s.status='COMPLETED' and s.balance_due>0 and not c.is_walk_in;
grant select on public.receivables to authenticated;
create view public.customer_balances with(security_invoker=true) as select c.id customer_id,coalesce(sum(s.balance_due) filter(where s.status='COMPLETED'),0)::numeric(14,2) outstanding_balance from public.customers c left join public.sales s on s.customer_id=c.id group by c.id;
grant select on public.customer_balances to authenticated;

create function public.sales_integrity_issues() returns table(sale_id uuid,issue text) language sql stable security definer set search_path='' as $$
 select s.id,'PAYMENT_RECONCILIATION' from public.sales s where s.status='COMPLETED' and (s.amount_paid<>(select coalesce(sum(p.amount),0) from public.customer_payments p where p.sale_id=s.id and p.status='POSTED') or s.balance_due<>s.total_amount-s.amount_paid)
 union all select s.id,'ITEM_TOTAL_RECONCILIATION' from public.sales s where s.subtotal<>(select coalesce(sum(i.line_total),0) from public.sale_items i where i.sale_id=s.id)
$$;
revoke all on function public.sales_integrity_issues() from public;
