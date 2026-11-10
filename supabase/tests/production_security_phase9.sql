begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select ok((select relrowsecurity from pg_class where oid='public.purchasing_number_sequences'::regclass),'Purchasing number sequence has RLS');
select ok((select relrowsecurity from pg_class where oid='public.sales_number_sequences'::regclass),'Sales number sequence has RLS');
select ok(not has_table_privilege('anon','public.purchasing_number_sequences','SELECT'),'Anonymous cannot read purchasing sequences');
select ok(not has_table_privilege('authenticated','public.sales_number_sequences','UPDATE'),'Authenticated users cannot alter sales sequences');
select ok(has_function_privilege('anon','public.public_catalogue(text,text,text,text,integer,integer,jsonb)','EXECUTE'),'Public catalogue remains an anonymous API');
select ok(has_function_privilege('authenticated','public.create_sale(uuid,uuid,date,text,numeric,text,jsonb)','EXECUTE'),'Authenticated sales API remains available');
select ok(not has_function_privilege('anon','public.inventory_apply_movement(uuid,uuid,public.stock_movement_type,numeric,text,uuid,text,text)','EXECUTE'),'Anonymous cannot execute inventory internals');
select ok(not has_function_privilege('authenticated','public.inventory_apply_movement(uuid,uuid,public.stock_movement_type,numeric,text,uuid,text,text)','EXECUTE'),'Authenticated users cannot execute inventory internals');
select ok(not has_function_privilege('anon','public.next_sales_number(text)','EXECUTE'),'Anonymous cannot allocate sales numbers');
select ok(not has_function_privilege('authenticated','public.next_purchasing_number(text)','EXECUTE'),'Authenticated users cannot directly allocate purchasing numbers');
select ok(not has_function_privilege('anon','public.configure_employee_access(uuid,uuid,uuid[],boolean)','EXECUTE'),'Anonymous cannot configure employee access');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not ('search_path=""'=any(coalesce(p.proconfig,'{}'::text[])))),'Every security-definer function pins an empty search path');

select * from finish();
rollback;
