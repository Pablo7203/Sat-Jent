-- Keep payment retries authorized and reconcile against the currently
-- recognized supplier payable, not the unreceived PO total.
create or replace function public.record_supplier_payment(
  target_supplier uuid,
  target_purchase uuid,
  target_branch uuid,
  operation_id uuid,
  payment_amount numeric,
  method public.supplier_payment_method,
  reference text,
  payment_on date,
  payment_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.purchases%rowtype;
  payment_id uuid;
  existing_id uuid;
  paid numeric(14,2);
  balance numeric(14,2);
  new_status public.purchase_payment_status;
begin
  if operation_id is null then raise exception 'A payment operation identifier is required'; end if;
  if not public.has_permission('supplier_payments.create')
    or not public.can_access_branch(target_branch) then
    raise exception 'You do not have permission to record this payment';
  end if;
  if target_purchase is null then raise exception 'Supplier prepayments are not supported in this phase'; end if;
  select * into p from public.purchases where id = target_purchase for update;
  if not found then raise exception 'Purchase not found'; end if;
  if p.branch_id <> target_branch or p.supplier_id <> target_supplier then
    raise exception 'Payment does not match the purchase supplier and branch';
  end if;

  select id into existing_id from public.supplier_payments
    where branch_id = target_branch and operation_key = operation_id;
  if found then
    if not exists(select 1 from public.supplier_payments sp
      where sp.id = existing_id and sp.purchase_id = p.id and sp.supplier_id = target_supplier) then
      raise exception 'Payment operation does not match this purchase';
    end if;
    return existing_id;
  end if;
  if p.status = 'CANCELLED' then raise exception 'A cancelled purchase cannot be paid'; end if;
  if payment_amount is null or payment_amount <= 0 or payment_amount <> round(payment_amount, 2) then
    raise exception 'Payment amount must be a valid amount greater than zero';
  end if;
  if payment_amount > p.balance_due then raise exception 'The payment amount exceeds the outstanding balance'; end if;

  insert into public.supplier_payments(
    payment_number, supplier_id, purchase_id, branch_id, operation_key, amount,
    payment_method, payment_reference, payment_date, notes, recorded_by
  ) values (
    public.next_purchasing_number('SPY'), target_supplier, p.id, target_branch,
    operation_id, payment_amount, method, nullif(trim(reference), ''),
    public.assert_transaction_date(payment_on), nullif(trim(payment_notes), ''), auth.uid()
  ) returning id into payment_id;
  paid := p.amount_paid + payment_amount;
  balance := p.payable_value - paid;
  new_status := case
    when balance = 0 and paid > 0 then 'PAID'::public.purchase_payment_status
    when paid > 0 then 'PARTIALLY_PAID'::public.purchase_payment_status
    else 'UNPAID'::public.purchase_payment_status
  end;
  update public.purchases set amount_paid = paid, balance_due = balance,
    payment_status = new_status, updated_by = auth.uid()
  where id = p.id;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), p.branch_id, 'supplier_payment.recorded', 'supplier_payments', payment_id,
    jsonb_build_object('purchase_id', p.id, 'supplier_id', target_supplier,
      'amount', payment_amount, 'recognized_payable', p.payable_value,
      'payment_number', (select sp.payment_number from public.supplier_payments sp where sp.id = payment_id)));
  return payment_id;
end;
$$;

revoke all on function public.record_supplier_payment(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,date,text)
  from public, anon, authenticated;
grant execute on function public.record_supplier_payment(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,date,text)
  to authenticated;
