begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
('30000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','super@test.invalid','',now(),'{}','{"full_name":"Super Test"}',now(),now()),
('30000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner@test.invalid','',now(),'{}','{"full_name":"Owner Test"}',now(),now()),
('30000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','salesa@test.invalid','',now(),'{}','{"full_name":"Sales A"}',now(),now()),
('30000000-0000-4000-8000-000000000004','00000000-0000-0000-8000-000000000000','authenticated','authenticated','managerb@test.invalid','',now(),'{}','{"full_name":"Manager B"}',now(),now()),
('30000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-phase1-inactive@test.invalid','',now(),'{}','{"full_name":"Inactive"}',now(),now()),
('30000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','unassigned@test.invalid','',now(),'{}','{"full_name":"Unassigned"}',now(),now()),
('30000000-0000-4000-8000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-safety-admin@test.invalid','',now(),'{}','{"full_name":"Safety Admin"}',now(),now());
update public.profiles set role_id='10000000-0000-4000-8000-000000000001',is_active=true where id='30000000-0000-4000-8000-000000000007';

update public.profiles set role_id = case id
 when '30000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000001'
 when '30000000-0000-4000-8000-000000000002' then '10000000-0000-4000-8000-000000000002'
 when '30000000-0000-4000-8000-000000000004' then '10000000-0000-4000-8000-000000000003'
 else '10000000-0000-4000-8000-000000000004' end::uuid,
 is_active = id <> '30000000-0000-4000-8000-000000000005';
insert into public.branches(id,code,name,address,phone) values
('40000000-0000-4000-8000-000000000001','TEST-A','Branch A','Test only','000'),
('40000000-0000-4000-8000-000000000002','TEST-B','Branch B','Test only','000'),
('40000000-0000-4000-8000-000000000003','TEST-C','Branch C','Test only','000');
insert into public.user_branches(user_id,branch_id) values
('30000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001'),
('30000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select ok(public.can_access_branch('40000000-0000-4000-8000-000000000001'), 'Sales A can access assigned Branch A');
select ok(not public.can_access_branch('40000000-0000-4000-8000-000000000002'), 'Sales A cannot tamper into Branch B');
select is((select count(*) from public.branches), 1::bigint, 'RLS only returns assigned branch to Sales A');
select ok(not public.has_permission('users.manage'), 'Sales cannot manage users');
select ok(public.has_permission('app.access'), 'Sales retains application access without reading permission mappings');
select throws_ok($$update public.profiles set role_id='10000000-0000-4000-8000-000000000001' where id=auth.uid()$$,'P0001','Users can only update their own contact details','Employees cannot change their own role after self-service profile updates were introduced');
select is((select role_id from public.profiles where id=auth.uid()), '10000000-0000-4000-8000-000000000004'::uuid, 'Sales cannot escalate own role');
select throws_ok($$insert into public.user_branches(user_id,branch_id) values('30000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000002')$$, '42501', null, 'Sales cannot self-assign Branch B');
select throws_ok($$insert into public.role_permissions(role_id,permission_id) values('10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000005')$$, '42501', null, 'Sales cannot alter role permissions');

select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.branches where id in ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003')), 3::bigint, 'Super Admin reads all fixture branches');
select ok(public.has_permission('users.manage'), 'Super Admin can manage users');

select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.branches where id in ('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003')), 3::bigint, 'Owner reads all fixture branches');
select ok(not public.has_permission('users.manage'), 'Owner cannot perform Super Admin user mutations');

select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select is((select count(*) from public.branches), 0::bigint, 'Inactive session cannot read protected branches');
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select is((select count(*) from public.branches), 0::bigint, 'Unassigned branch user cannot read arbitrary branches');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((select count(*) from public.profiles), 0::bigint, 'Anonymous users cannot read profiles');

select * from finish();
rollback;
