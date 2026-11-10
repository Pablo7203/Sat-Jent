begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(
  not has_function_privilege(
    'anon',
    'public.submit_quotation(text,text,text,text,uuid,uuid,numeric,uuid,text,public.quotation_source,text)'::regprocedure,
    'EXECUTE'
  ),
  'Anonymous visitors cannot create legacy public quotation requests'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.submit_quotation_request(text,text,text,text,jsonb,uuid,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'Anonymous visitors cannot create multi-product quotation requests'
);

select * from finish();
rollback;
