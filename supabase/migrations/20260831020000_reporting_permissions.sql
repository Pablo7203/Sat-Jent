-- SAT-J Ent Phase 7: reporting and dashboard capabilities.
insert into public.permissions(id,code,description) values
('20000000-0000-4000-8000-000000000601','reports.branch.read','Read predefined reports for authorized branches'),
('20000000-0000-4000-8000-000000000602','reports.company.read','Read company-wide management reports'),
('20000000-0000-4000-8000-000000000603','reports.export','Export authorized report data'),
('20000000-0000-4000-8000-000000000604','dashboard.branch.read','Read operational dashboards for authorized branches'),
('20000000-0000-4000-8000-000000000605','dashboard.company.read','Read the company executive dashboard')
on conflict(code) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code in('SUPER_ADMIN','OWNER') and p.code in('reports.branch.read','reports.company.read','reports.export','dashboard.branch.read','dashboard.company.read'))
 or (r.code='BRANCH_MANAGER' and p.code in('reports.branch.read','reports.export','dashboard.branch.read'))
 or (r.code in('SALES','INVENTORY') and p.code='dashboard.branch.read')
on conflict do nothing;
