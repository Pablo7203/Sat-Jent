-- SAT-J Ent Phase 6: inter-branch transfer capabilities.
insert into public.permissions(id,code,description) values
('20000000-0000-4000-8000-000000000501','transfers.read','Read transfers involving authorized branches'),
('20000000-0000-4000-8000-000000000502','transfers.create','Create and edit draft transfers from authorized source branches'),
('20000000-0000-4000-8000-000000000503','transfers.approve','Approve requested transfers from authorized source branches'),
('20000000-0000-4000-8000-000000000504','transfers.dispatch','Dispatch approved transfers from authorized source branches'),
('20000000-0000-4000-8000-000000000505','transfers.receive','Receive dispatched transfers into authorized destination branches'),
('20000000-0000-4000-8000-000000000506','transfers.cancel','Cancel transfers before dispatch from authorized source branches')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code in('SUPER_ADMIN','OWNER','BRANCH_MANAGER') and p.code like 'transfers.%')
 or (r.code='INVENTORY' and p.code in('transfers.read','transfers.create','transfers.dispatch','transfers.receive'))
 or (r.code='SALES' and p.code='transfers.read')
on conflict do nothing;
