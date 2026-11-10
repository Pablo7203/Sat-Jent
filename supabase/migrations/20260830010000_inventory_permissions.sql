-- SAT-J Ent Phase 3: inventory capability grants.
insert into public.permissions(id,code,description) values
('20000000-0000-4000-8000-000000000201','inventory.read','Read authorized branch inventory and movements'),
('20000000-0000-4000-8000-000000000202','inventory.opening_stock','Post opening stock in authorized branches'),
('20000000-0000-4000-8000-000000000203','inventory.adjust','Create and complete stock adjustments'),
('20000000-0000-4000-8000-000000000204','inventory.count','Create and reconcile physical stock counts'),
('20000000-0000-4000-8000-000000000205','inventory.settings.manage','Manage branch-specific minimum stock levels')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code in ('SUPER_ADMIN','OWNER','BRANCH_MANAGER','INVENTORY') and p.code like 'inventory.%')
   or (r.code='SALES' and p.code='inventory.read')
on conflict do nothing;
