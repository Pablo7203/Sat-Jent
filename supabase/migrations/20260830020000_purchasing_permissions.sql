-- SAT-J Ent Phase 4: purchasing capability grants.
insert into public.permissions(id,code,description) values
('20000000-0000-4000-8000-000000000301','suppliers.read','Read supplier master records'),
('20000000-0000-4000-8000-000000000302','suppliers.create','Create suppliers'),
('20000000-0000-4000-8000-000000000303','suppliers.update','Update suppliers'),
('20000000-0000-4000-8000-000000000304','suppliers.archive','Archive and reactivate suppliers'),
('20000000-0000-4000-8000-000000000305','purchases.read','Read purchases in authorized branches'),
('20000000-0000-4000-8000-000000000306','purchases.create','Create purchases in authorized branches'),
('20000000-0000-4000-8000-000000000307','purchases.update','Update draft purchases in authorized branches'),
('20000000-0000-4000-8000-000000000308','purchases.receive','Receive purchases into authorized branches'),
('20000000-0000-4000-8000-000000000309','purchases.cancel','Cancel eligible purchases'),
('20000000-0000-4000-8000-000000000310','supplier_payments.read','Read supplier payments in authorized branches'),
('20000000-0000-4000-8000-000000000311','supplier_payments.create','Record supplier payments in authorized branches')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code in ('SUPER_ADMIN','OWNER') and (p.code like 'suppliers.%' or p.code like 'purchases.%' or p.code like 'supplier_payments.%'))
 or (r.code='BRANCH_MANAGER' and p.code in ('suppliers.read','suppliers.create','suppliers.update','purchases.read','purchases.create','purchases.update','purchases.receive','purchases.cancel','supplier_payments.read','supplier_payments.create'))
 or (r.code='INVENTORY' and p.code in ('suppliers.read','purchases.read','purchases.receive'))
on conflict do nothing;
