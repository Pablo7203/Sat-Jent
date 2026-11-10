-- PostgreSQL has no min(uuid) aggregate; deterministically select the sole
-- compatible account, while refusing ambiguous implicit account selection.
create or replace function public.resolve_payment_financial_account(target_branch uuid,target_method public.supplier_payment_method)
returns uuid language plpgsql security definer set search_path='' as $$
declare requested uuid:=nullif(current_setting('app.financial_account_id',true),'')::uuid; expected_type text; candidate uuid; account_count integer;
begin
 expected_type:=case target_method when 'CASH' then 'CASH' when 'MOBILE_MONEY' then 'MOBILE_MONEY' when 'BANK_TRANSFER' then 'BANK' when 'CARD_POS' then 'CARD_CLEARING' else 'OTHER' end;
 if requested is not null then
  if not exists(select 1 from public.financial_accounts a join public.financial_account_branches ab on ab.account_id=a.id where a.id=requested and a.is_active and a.account_type=expected_type and ab.branch_id=target_branch) then raise exception 'Choose an active account of the matching payment type assigned to this branch'; end if;
  return requested;
 end if;
 select count(*) into account_count from public.financial_accounts a join public.financial_account_branches ab on ab.account_id=a.id where a.is_active and a.account_type=expected_type and ab.branch_id=target_branch;
 if account_count<>1 then raise exception 'Select a financial account for this payment'; end if;
 select a.id into candidate from public.financial_accounts a join public.financial_account_branches ab on ab.account_id=a.id where a.is_active and a.account_type=expected_type and ab.branch_id=target_branch order by a.created_at,a.id limit 1;
 return candidate;
end;$$;
revoke all on function public.resolve_payment_financial_account(uuid,public.supplier_payment_method) from public,anon,authenticated;
