-- Phase 6 continuation: post customer and supplier cash flows to branch accounts.
alter table public.customer_payments add column financial_account_id uuid references public.financial_accounts(id) on delete restrict;
alter table public.supplier_payments
  add column financial_account_id uuid references public.financial_accounts(id) on delete restrict,
  add column status text not null default 'POSTED' check(status in ('POSTED','REVERSED')),
  add column reversed_at timestamptz,
  add column reversed_by uuid references auth.users(id) on delete restrict,
  add column reversal_reason text,
  add constraint supplier_payment_reversal_state check (
    (status='POSTED' and reversed_at is null and reversed_by is null and reversal_reason is null)
    or (status='REVERSED' and reversed_at is not null and reversed_by is not null and char_length(trim(reversal_reason))>=3));

insert into public.permissions(id,code,description) values
 ('20000000-0000-4000-8000-000000000811','finance.reconcile','Reconcile assigned financial accounts'),
 ('20000000-0000-4000-8000-000000000812','reports.profitability.read','Read profitability and profit-and-loss reports')
on conflict(code) do update set description=excluded.description;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code in ('SUPER_ADMIN','OWNER') and p.code in ('finance.reconcile','reports.profitability.read'))
 or (r.code in ('SALES','BRANCH_MANAGER') and p.code='finance.accounts.read') on conflict do nothing;

create function public.resolve_payment_financial_account(target_branch uuid,target_method public.supplier_payment_method)
returns uuid language plpgsql security definer set search_path='' as $$
declare requested uuid := nullif(current_setting('app.financial_account_id',true),'')::uuid;
declare expected_type text; candidate uuid; account_count integer;
begin
 expected_type:=case target_method when 'CASH' then 'CASH' when 'MOBILE_MONEY' then 'MOBILE_MONEY' when 'BANK_TRANSFER' then 'BANK' when 'CARD_POS' then 'CARD_CLEARING' else 'OTHER' end;
 if requested is not null then
  if not exists(select 1 from public.financial_accounts a join public.financial_account_branches ab on ab.account_id=a.id where a.id=requested and a.is_active and a.account_type=expected_type and ab.branch_id=target_branch) then raise exception 'Choose an active account of the matching payment type assigned to this branch'; end if;
  return requested;
 end if;
 select min(a.id),count(*) into candidate,account_count from public.financial_accounts a join public.financial_account_branches ab on ab.account_id=a.id where a.is_active and a.account_type=expected_type and ab.branch_id=target_branch;
 if candidate is null or account_count<>1 then raise exception 'Select a financial account for this payment'; end if;
 return candidate;
end;$$;

create function public.post_customer_payment_to_ledger() returns trigger language plpgsql security definer set search_path='' as $$
declare acct uuid;
begin
 if new.status<>'POSTED' then return new; end if;
 acct:=coalesce(new.financial_account_id,public.resolve_payment_financial_account(new.branch_id,new.payment_method)); new.financial_account_id:=acct;
 insert into public.financial_movements(account_id,branch_id,operation_key,movement_kind,direction,amount,reference_type,reference_id,effective_date,memo,recorded_by)
 values(acct,new.branch_id,new.operation_key,'CUSTOMER_COLLECTION','IN',new.amount,'CUSTOMER_PAYMENT',new.id,(new.payment_date at time zone 'Africa/Accra')::date,new.payment_number,new.recorded_by);
 return new;
end;$$;
create trigger customer_payment_ledger_before_insert before insert on public.customer_payments for each row execute function public.post_customer_payment_to_ledger();

create function public.reverse_customer_payment_ledger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='POSTED' and new.status='REVERSED' then
  insert into public.financial_movements(account_id,branch_id,operation_key,movement_kind,direction,amount,reference_type,reference_id,effective_date,memo,recorded_by)
  values(old.financial_account_id,old.branch_id,md5(old.id::text||':customer-payment-reversal')::uuid,'ADJUSTMENT','OUT',old.amount,'CUSTOMER_PAYMENT_REVERSAL',old.id,(new.reversed_at at time zone 'Africa/Accra')::date,old.payment_number,new.reversed_by);
 end if; return new;
end;$$;
create trigger customer_payment_ledger_after_reversal after update of status on public.customer_payments for each row execute function public.reverse_customer_payment_ledger();

create function public.post_supplier_payment_to_ledger() returns trigger language plpgsql security definer set search_path='' as $$
declare acct uuid;
begin
 if new.status<>'POSTED' then return new; end if;
 acct:=coalesce(new.financial_account_id,public.resolve_payment_financial_account(new.branch_id,new.payment_method)); new.financial_account_id:=acct;
 insert into public.financial_movements(account_id,branch_id,operation_key,movement_kind,direction,amount,reference_type,reference_id,effective_date,memo,recorded_by)
 values(acct,new.branch_id,new.operation_key,'SUPPLIER_PAYMENT','OUT',new.amount,'SUPPLIER_PAYMENT',new.id,new.payment_date,new.payment_number,new.recorded_by);
 return new;
end;$$;
create trigger supplier_payment_ledger_before_insert before insert on public.supplier_payments for each row execute function public.post_supplier_payment_to_ledger();

create function public.reverse_supplier_payment(target_payment uuid,reversal_note text) returns void language plpgsql security definer set search_path='' as $$
declare p public.supplier_payments%rowtype; purchase_row public.purchases%rowtype; op uuid;
begin
 select * into p from public.supplier_payments where id=target_payment for update; if not found then raise exception 'Supplier payment not found'; end if;
 if not public.has_permission('supplier_payments.create') or not public.can_access_branch(p.branch_id) then raise exception 'You do not have permission to reverse this payment'; end if;
 if char_length(trim(coalesce(reversal_note,'')))<3 then raise exception 'Provide a reversal reason'; end if;
 if p.status<>'POSTED' then raise exception 'Only posted payments can be reversed'; end if;
 select * into purchase_row from public.purchases where id=p.purchase_id for update;
 if not found or purchase_row.amount_paid<p.amount then raise exception 'Purchase payment balance is inconsistent'; end if;
 update public.purchases set amount_paid=amount_paid-p.amount,balance_due=payable_value-(amount_paid-p.amount),
  payment_status=case when amount_paid-p.amount=0 then 'UNPAID'::public.purchase_payment_status else 'PARTIALLY_PAID'::public.purchase_payment_status end,updated_by=auth.uid() where id=purchase_row.id;
 update public.supplier_payments set status='REVERSED',reversed_at=now(),reversed_by=auth.uid(),reversal_reason=trim(reversal_note) where id=p.id;
 op:=md5(p.id::text||':supplier-payment-reversal')::uuid;
 insert into public.financial_movements(account_id,branch_id,operation_key,movement_kind,direction,amount,reference_type,reference_id,effective_date,memo,recorded_by)
 values(p.financial_account_id,p.branch_id,op,'ADJUSTMENT','IN',p.amount,'SUPPLIER_PAYMENT_REVERSAL',p.id,(now() at time zone 'Africa/Accra')::date,trim(reversal_note),auth.uid());
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),p.branch_id,'supplier_payment.reversed','supplier_payments',p.id,jsonb_build_object('purchase_id',p.purchase_id,'amount',p.amount,'reason',trim(reversal_note)));
end;$$;

create view public.financial_account_balances with (security_invoker=true) as
select a.id account_id,a.code,a.name,a.account_type,ab.branch_id,coalesce(sum(case when m.direction='IN' then m.amount else -m.amount end),0)::numeric(14,2) book_balance
from public.financial_accounts a join public.financial_account_branches ab on ab.account_id=a.id
left join public.financial_movements m on m.account_id=a.id and m.branch_id=ab.branch_id group by a.id,a.code,a.name,a.account_type,ab.branch_id;
revoke all on public.financial_account_balances from public,anon,authenticated;
grant select on public.financial_account_balances to authenticated;

create table public.financial_account_openings(account_id uuid not null references public.financial_accounts(id) on delete restrict,branch_id uuid not null references public.branches(id) on delete restrict,operation_key uuid not null unique,created_at timestamptz not null default now(),primary key(account_id,branch_id));
alter table public.financial_account_openings enable row level security;
revoke all on public.financial_account_openings from public,anon,authenticated;
create function public.initialize_financial_account(target_account uuid,target_branch uuid,operation_id uuid,opening_amount numeric,opening_on date,opening_note text) returns void language plpgsql security definer set search_path='' as $$
declare existing public.financial_account_openings%rowtype;
begin
 if not public.has_permission('finance.accounts.manage') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to initialize this account'; end if;
 if operation_id is null or opening_amount is null or opening_amount<0 or opening_amount<>round(opening_amount,2) then raise exception 'Enter a valid opening balance'; end if;
 if opening_on is null or opening_on>(now() at time zone 'Africa/Accra')::date then raise exception 'Choose a valid opening date'; end if;
 if char_length(trim(coalesce(opening_note,'')))<5 then raise exception 'Describe the source of the opening balance'; end if;
 if not exists(select 1 from public.financial_accounts a join public.financial_account_branches ab on ab.account_id=a.id where a.id=target_account and a.is_active and ab.branch_id=target_branch) then raise exception 'Account is not assigned to this branch'; end if;
 select * into existing from public.financial_account_openings where account_id=target_account and branch_id=target_branch;
 if found then if existing.operation_key=operation_id then return; else raise exception 'An opening balance has already been posted for this account and branch'; end if; end if;
 insert into public.financial_account_openings(account_id,branch_id,operation_key) values(target_account,target_branch,operation_id);
 if opening_amount>0 then insert into public.financial_movements(account_id,branch_id,operation_key,movement_kind,direction,amount,reference_type,reference_id,effective_date,memo,recorded_by)
 values(target_account,target_branch,operation_id,'OPENING_BALANCE','IN',opening_amount,'FINANCIAL_ACCOUNT_OPENING',target_account,opening_on,trim(opening_note),auth.uid()); end if;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),target_branch,'finance.account_opening_posted','financial_accounts',target_account,jsonb_build_object('amount',opening_amount,'effective_date',opening_on,'source',trim(opening_note)));
end;$$;

create table public.financial_reconciliations (
 id uuid primary key default gen_random_uuid(),account_id uuid not null references public.financial_accounts(id) on delete restrict,
 branch_id uuid not null references public.branches(id) on delete restrict,statement_date date not null,
 statement_balance numeric(14,2) not null,book_balance numeric(14,2) not null,variance numeric(14,2) not null,
 status text not null check(status in ('MATCHED','VARIANCE_RECORDED')),notes text,
 reconciled_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now());
alter table public.financial_reconciliations enable row level security;
create policy financial_reconciliations_read on public.financial_reconciliations for select to authenticated using(public.has_permission('finance.reconcile') and public.can_access_branch(branch_id));
revoke all on public.financial_reconciliations from public,anon,authenticated; grant select on public.financial_reconciliations to authenticated;

create function public.record_financial_reconciliation(target_account uuid,target_branch uuid,statement_on date,statement_amount numeric,reconciliation_note text)
returns uuid language plpgsql security definer set search_path='' as $$
declare book numeric(14,2); variance numeric(14,2); new_id uuid;
begin
 if not public.has_permission('finance.reconcile') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to reconcile this account'; end if;
 if statement_on is null or statement_on>(now() at time zone 'Africa/Accra')::date then raise exception 'Choose a valid statement date'; end if;
 if statement_amount is null or statement_amount<>round(statement_amount,2) then raise exception 'Enter a valid statement balance'; end if;
 if not exists(select 1 from public.financial_accounts a join public.financial_account_branches ab on ab.account_id=a.id where a.id=target_account and a.is_active and ab.branch_id=target_branch) then raise exception 'Account is not assigned to this branch'; end if;
 select coalesce(sum(case when direction='IN' then amount else -amount end),0)::numeric(14,2) into book from public.financial_movements where account_id=target_account and branch_id=target_branch and effective_date<=statement_on;
 variance:=round(statement_amount-book,2);
 if variance<>0 and char_length(trim(coalesce(reconciliation_note,'')))<5 then raise exception 'Explain the statement variance'; end if;
 insert into public.financial_reconciliations(account_id,branch_id,statement_date,statement_balance,book_balance,variance,status,notes,reconciled_by)
 values(target_account,target_branch,statement_on,statement_amount,book,variance,case when variance=0 then 'MATCHED' else 'VARIANCE_RECORDED' end,nullif(trim(reconciliation_note),''),auth.uid()) returning id into new_id;
 if variance<>0 then insert into public.financial_movements(account_id,branch_id,operation_key,movement_kind,direction,amount,reference_type,reference_id,effective_date,memo,recorded_by)
  values(target_account,target_branch,md5(new_id::text||':reconciliation')::uuid,'ADJUSTMENT',case when variance>0 then 'IN'::public.financial_direction else 'OUT'::public.financial_direction end,abs(variance),'FINANCIAL_RECONCILIATION',new_id,statement_on,trim(reconciliation_note),auth.uid()); end if;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),target_branch,'finance.account_reconciled','financial_reconciliations',new_id,jsonb_build_object('account_id',target_account,'statement_date',statement_on,'book_balance',book,'statement_balance',statement_amount,'variance',variance));
 return new_id;
end;$$;

create function public.reporting_profit_and_loss(date_from date,date_to date,target_branch uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare sales_revenue numeric(14,2); known_cogs numeric(14,2); missing_lines bigint; exp_total numeric(14,2);
begin
 if date_from is null or date_to is null or date_from>date_to or date_to-date_from>366 then raise exception 'Choose a valid report range of up to 367 days'; end if;
 if not public.has_permission('reports.profitability.read') then raise exception 'You do not have permission to read profitability reports'; end if;
 if target_branch is not null and not public.can_access_branch(target_branch) then raise exception 'You cannot report on this branch'; end if;
 select coalesce(sum(revenue),0),coalesce(sum(cost_of_goods_sold) filter(where cost_status='COMPLETE'),0),count(*) filter(where cost_status<>'COMPLETE')
 into sales_revenue,known_cogs,missing_lines from public.sales_profitability_events e where e.business_date between date_from and date_to
 and (target_branch is null or e.branch_id=target_branch) and (target_branch is not null or public.can_access_branch(e.branch_id));
 select coalesce(sum(e.amount),0) into exp_total from public.expenses e where e.status in ('APPROVED','PARTIALLY_PAID','PAID') and e.expense_date between date_from and date_to
 and (target_branch is null or e.branch_id=target_branch) and (target_branch is not null or public.can_access_branch(e.branch_id));
 return jsonb_build_object('date_from',date_from,'date_to',date_to,'branch_id',target_branch,'revenue',sales_revenue,'known_cogs',known_cogs,
 'unvalued_sale_lines',missing_lines,'gross_profit',case when missing_lines=0 then sales_revenue-known_cogs else null end,'approved_expenses',exp_total,
 'operating_profit',case when missing_lines=0 then sales_revenue-known_cogs-exp_total else null end,'cost_complete',missing_lines=0);
end;$$;

revoke all on function public.resolve_payment_financial_account(uuid,public.supplier_payment_method),public.post_customer_payment_to_ledger(),public.reverse_customer_payment_ledger(),public.post_supplier_payment_to_ledger(),public.reverse_supplier_payment(uuid,text),public.record_financial_reconciliation(uuid,uuid,date,numeric,text),public.reporting_profit_and_loss(date,date,uuid) from public,anon;
revoke all on function public.initialize_financial_account(uuid,uuid,uuid,numeric,date,text) from public,anon;
grant execute on function public.initialize_financial_account(uuid,uuid,uuid,numeric,date,text),public.reverse_supplier_payment(uuid,text),public.record_financial_reconciliation(uuid,uuid,date,numeric,text),public.reporting_profit_and_loss(date,date,uuid) to authenticated;
comment on table public.financial_movements is 'Append-only cash ledger for operating collections, supplier and expense payments, and reconciliation adjustments.';
