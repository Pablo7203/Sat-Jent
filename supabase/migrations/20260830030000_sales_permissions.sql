-- SAT-J Ent Phase 5: customer, sales, payment and receivable capabilities.
insert into public.permissions(id,code,description) values
('20000000-0000-4000-8000-000000000401','customers.read','Read customer master records'),
('20000000-0000-4000-8000-000000000402','customers.create','Create customers'),
('20000000-0000-4000-8000-000000000403','customers.update','Update customers'),
('20000000-0000-4000-8000-000000000404','customers.archive','Archive and reactivate customers'),
('20000000-0000-4000-8000-000000000405','sales.read','Read sales in authorized branches'),
('20000000-0000-4000-8000-000000000406','sales.create','Create sales in authorized branches'),
('20000000-0000-4000-8000-000000000407','sales.complete','Complete sales in authorized branches'),
('20000000-0000-4000-8000-000000000408','sales.cancel','Cancel eligible completed sales'),
('20000000-0000-4000-8000-000000000409','sales.price_override','Override resolved selling prices with a reason'),
('20000000-0000-4000-8000-000000000410','sales.discount','Apply sale or line discounts'),
('20000000-0000-4000-8000-000000000411','customer_payments.read','Read customer payments in authorized branches'),
('20000000-0000-4000-8000-000000000412','customer_payments.create','Record customer payments in authorized branches'),
('20000000-0000-4000-8000-000000000413','customer_payments.reverse','Reverse posted customer payments'),
('20000000-0000-4000-8000-000000000414','receivables.read','Read receivables in authorized branches')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code in('SUPER_ADMIN','OWNER') and (p.code like 'customers.%' or p.code like 'sales.%' or p.code like 'customer_payments.%' or p.code='receivables.read'))
 or (r.code='BRANCH_MANAGER' and p.code in('customers.read','customers.create','customers.update','sales.read','sales.create','sales.complete','sales.cancel','sales.price_override','sales.discount','customer_payments.read','customer_payments.create','customer_payments.reverse','receivables.read'))
 or (r.code='SALES' and p.code in('customers.read','customers.create','customers.update','sales.read','sales.create','sales.complete','customer_payments.read','customer_payments.create','receivables.read'))
 or (r.code='INVENTORY' and p.code='sales.read')
on conflict do nothing;
