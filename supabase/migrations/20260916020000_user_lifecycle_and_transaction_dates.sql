-- Super Admin account deletion and controlled transaction backdating.

create function public.assert_transaction_date(value date)
returns date language plpgsql stable security definer set search_path = '' as $$
declare effective_date date := coalesce(value, current_date);
declare actor_role text;
begin
  if effective_date > current_date then
    raise exception 'Future transaction dates are not permitted';
  end if;
  if effective_date < current_date then
    select r.code into actor_role
    from public.profiles p join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active;
    if actor_role not in ('SUPER_ADMIN', 'OWNER') then
      raise exception 'Only a Super Admin or Owner may backdate transactions';
    end if;
  end if;
  return effective_date;
end;
$$;

revoke all on function public.assert_transaction_date(date) from public, anon;
grant execute on function public.assert_transaction_date(date) to authenticated;

create function public.enforce_transaction_date()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'sales' then
    new.sale_date := public.assert_transaction_date(new.sale_date::date)::timestamptz;
  elsif tg_table_name = 'customer_payments' then
    new.payment_date := public.assert_transaction_date(new.payment_date::date)::timestamptz;
  elsif tg_table_name = 'purchases' then
    new.purchase_date := public.assert_transaction_date(new.purchase_date);
  elsif tg_table_name = 'supplier_payments' then
    new.payment_date := public.assert_transaction_date(new.payment_date);
  end if;
  return new;
end;
$$;

create trigger sales_transaction_date_guard
before insert or update of sale_date on public.sales
for each row execute function public.enforce_transaction_date();
create trigger customer_payments_transaction_date_guard
before insert or update of payment_date on public.customer_payments
for each row execute function public.enforce_transaction_date();
create trigger purchases_transaction_date_guard
before insert or update of purchase_date on public.purchases
for each row execute function public.enforce_transaction_date();
create trigger supplier_payments_transaction_date_guard
before insert or update of payment_date on public.supplier_payments
for each row execute function public.enforce_transaction_date();

-- Keep the original sale workflow authoritative, then apply the validated
-- business date in the same transaction.
create function public.create_sale(
  target_branch uuid,
  target_customer uuid,
  sale_on date,
  due_on date,
  sale_notes text,
  sale_discount numeric,
  discount_reason text,
  items jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
declare effective_date date;
begin
  effective_date := public.assert_transaction_date(sale_on);
  new_id := public.create_sale(target_branch, target_customer, due_on, sale_notes, sale_discount, discount_reason, items);
  update public.sales set sale_date = effective_date::timestamptz where id = new_id;
  if effective_date < current_date then
    insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
    values(auth.uid(), target_branch, 'sale.backdated', 'sales', new_id, jsonb_build_object('transaction_date', effective_date));
  end if;
  return new_id;
end;
$$;

create function public.complete_sale(
  target_sale uuid,
  operation_id uuid,
  initial_payment numeric,
  method public.supplier_payment_method,
  payment_reference text,
  payment_notes text,
  payment_on date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare completed_id uuid;
declare effective_date date;
begin
  effective_date := public.assert_transaction_date(payment_on);
  completed_id := public.complete_sale(target_sale, operation_id, initial_payment, method, payment_reference, payment_notes);
  if coalesce(initial_payment, 0) > 0 then
    update public.customer_payments
    set payment_date = effective_date::timestamptz
    where branch_id = (select branch_id from public.sales where id = completed_id)
      and operation_key = operation_id;
  end if;
  return completed_id;
end;
$$;

grant execute on function public.create_sale(uuid,uuid,date,date,text,numeric,text,jsonb) to authenticated;
grant execute on function public.complete_sale(uuid,uuid,numeric,public.supplier_payment_method,text,text,date) to authenticated;

create function public.delete_employee_account(target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_role text;
declare target_role text;
begin
  select r.code into actor_role
  from public.profiles p join public.roles r on r.id = p.role_id
  where p.id = auth.uid() and p.is_active;
  if actor_role <> 'SUPER_ADMIN' then raise exception 'Only a Super Admin may delete employees'; end if;
  if target_user_id = auth.uid() then raise exception 'Self-deletion is not permitted'; end if;

  select r.code into target_role
  from public.profiles p left join public.roles r on r.id = p.role_id
  where p.id = target_user_id for update of p;
  if not found then raise exception 'Employee profile not found'; end if;
  if target_role = 'SUPER_ADMIN' and
    (select count(*) from public.profiles p join public.roles r on r.id = p.role_id
     where r.code = 'SUPER_ADMIN' and p.is_active and p.id <> target_user_id) = 0 then
    raise exception 'Cannot delete the final active Super Admin';
  end if;

  delete from public.user_branches where user_id = target_user_id;
  delete from public.profiles where id = target_user_id;
  -- Business-record foreign keys use RESTRICT. Any retained history therefore
  -- rejects this deletion and rolls the entire function back atomically.
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.delete_employee_account(uuid) from public, anon;
grant execute on function public.delete_employee_account(uuid) to authenticated;
