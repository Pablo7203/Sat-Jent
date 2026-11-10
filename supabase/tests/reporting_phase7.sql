begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('37000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner7@test.invalid','',now(),'{}','{}',now(),now()),
('37000000-0000-4000-8000-000000000002','00000000-0000-0000-8000-000000000000','authenticated','authenticated','manager7@test.invalid','',now(),'{}','{}',now(),now()),
('37000000-0000-4000-8000-000000000003','00000000-0000-0000-8000-000000000000','authenticated','authenticated','sales7@test.invalid','',now(),'{}','{}',now(),now());
update public.profiles set role_id=case when id='37000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000002'::uuid when id='37000000-0000-4000-8000-000000000002' then '10000000-0000-4000-8000-000000000003'::uuid else '10000000-0000-4000-8000-000000000004'::uuid end,is_active=true where id::text like '37000000%';
insert into public.branches(id,code,name,address,phone) values('47000000-0000-4000-8000-000000000001','REP-A','Reporting A','Test','000'),('47000000-0000-4000-8000-000000000002','REP-B','Reporting B','Test','000');
insert into public.user_branches(user_id,branch_id) values('37000000-0000-4000-8000-000000000002','47000000-0000-4000-8000-000000000001'),('37000000-0000-4000-8000-000000000003','47000000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"37000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok(public.has_permission('dashboard.company.read'),'Owner receives company dashboard permission');
select ok(public.has_permission('reports.export'),'Owner can export reports');
select lives_ok($$select public.dashboard_summary('2026-08-01','2026-08-31',null)$$,'Owner loads company dashboard');
select lives_ok($$select * from public.reporting_sales('2026-08-01','2026-08-31',null,50,0)$$,'Owner loads company sales report');
select lives_ok($$select * from public.reporting_sales_periods('2026-08-01','2026-08-31',null,'week')$$,'Owner loads Monday-based weekly trend');
select lives_ok($$select * from public.reporting_product_filter_options(null)$$,'Owner loads product report filters');

select set_config('request.jwt.claims','{"sub":"37000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select ok(public.has_permission('dashboard.branch.read'),'Manager receives branch dashboard permission');
select lives_ok($$select public.dashboard_summary('2026-08-01','2026-08-31','47000000-0000-4000-8000-000000000001')$$,'Manager loads assigned branch dashboard');
select lives_ok($$select * from public.reporting_sales_periods('2026-08-01','2026-08-31','47000000-0000-4000-8000-000000000001','month')$$,'Manager loads assigned branch monthly trend');
select throws_ok($$select * from public.reporting_product_filter_options('47000000-0000-4000-8000-000000000002')$$,'P0001','You do not have access to this report scope','Manager cannot load product filters for another branch');
select throws_ok($$select public.dashboard_summary('2026-08-01','2026-08-31','47000000-0000-4000-8000-000000000002')$$,'P0001','You do not have access to this dashboard scope','Manager cannot load another branch');
select throws_ok($$select public.dashboard_summary('2026-08-01','2026-08-31',null)$$,'P0001','You do not have access to this dashboard scope','Manager cannot load company dashboard');
select lives_ok($$select * from public.reporting_receivable_aging('2026-08-31','47000000-0000-4000-8000-000000000001')$$,'Manager loads assigned receivable aging');

select set_config('request.jwt.claims','{"sub":"37000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select ok(public.has_permission('dashboard.branch.read'),'Sales receives branch dashboard permission');
select ok(not public.has_permission('reports.export'),'Sales cannot export management reports');
select lives_ok($$select public.dashboard_summary('2026-08-01','2026-08-31','47000000-0000-4000-8000-000000000001')$$,'Sales loads restricted dashboard');
select lives_ok($$select * from public.reporting_sales_periods('2026-08-01','2026-08-31','47000000-0000-4000-8000-000000000001','day')$$,'Sales loads only the authorized operational trend');
select throws_ok($$select * from public.reporting_sales('2026-08-01','2026-08-31','47000000-0000-4000-8000-000000000001',50,0)$$,'P0001','You do not have access to this report scope','Sales cannot open management report');
select throws_ok($$select public.dashboard_summary('2026-09-01','2026-08-01','47000000-0000-4000-8000-000000000001')$$,'P0001','Choose a valid reporting date range of no more than two years','Invalid dashboard range is rejected');
select * from finish();
rollback;
