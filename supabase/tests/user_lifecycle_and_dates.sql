begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('39000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lifecycle-super@test.invalid','hash',now(),'{}','{}',now(),now()),
('39000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lifecycle-owner@test.invalid','hash',now(),'{}','{}',now(),now()),
('39000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lifecycle-sales@test.invalid','hash',now(),'{}','{}',now(),now());
update public.profiles set
  role_id = case id
    when '39000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000001'::uuid
    when '39000000-0000-4000-8000-000000000002' then '10000000-0000-4000-8000-000000000002'::uuid
    else '10000000-0000-4000-8000-000000000004'::uuid end,
  is_active = true,
  onboarding_completed_at = now()
where id::text like '39000000%';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"39000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is(public.assert_transaction_date(current_date), current_date, 'ordinary employee may use today');
select throws_ok($$select public.assert_transaction_date(current_date - 1)$$, 'P0001', 'Only a Super Admin or Owner may backdate transactions', 'ordinary employee cannot backdate');
select throws_ok($$select public.assert_transaction_date(current_date + 1)$$, 'P0001', 'Future transaction dates are not permitted', 'ordinary employee cannot use a future date');

select set_config('request.jwt.claims','{"sub":"39000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is(public.assert_transaction_date(current_date - 7), current_date - 7, 'Owner may backdate');
select throws_ok($$select public.assert_transaction_date(current_date + 1)$$, 'P0001', 'Future transaction dates are not permitted', 'Owner cannot use a future date');
select throws_ok($$select public.delete_employee_account('39000000-0000-4000-8000-000000000003')$$, 'P0001', 'Only a Super Admin may delete employees', 'Owner cannot delete employees');

select set_config('request.jwt.claims','{"sub":"39000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select lives_ok($$select public.delete_employee_account('39000000-0000-4000-8000-000000000003')$$, 'Super Admin can delete an employee without retained history');

select * from finish();
rollback;
