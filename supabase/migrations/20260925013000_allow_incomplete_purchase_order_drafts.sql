create or replace function public.save_purchase_order(
  target_purchase uuid,
  target_supplier uuid,
  target_branch uuid,
  purchase_on date,
  expected_on date,
  supplier_invoice text,
  purchase_notes text,
  purchase_discount numeric,
  purchase_other_costs numeric,
  items jsonb,
  place_order boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.purchases%rowtype;
  new_id uuid;
  effective_date date;
  item jsonb;
  variant uuid;
  qty numeric;
  cost numeric;
  discount numeric;
  line_total numeric(14,2);
  subtotal_value numeric(14,2) := 0;
  total_value numeric(14,2);
  is_update boolean := target_purchase is not null;
begin
  if is_update then
    select * into p from public.purchases where id = target_purchase for update;
    if not found then raise exception 'Purchase not found'; end if;
    if p.status <> 'DRAFT' then raise exception 'Only draft purchases can be edited'; end if;
    if not public.has_permission('purchases.update') or not public.can_access_branch(p.branch_id) then
      raise exception 'You do not have permission to update this purchase';
    end if;
  elsif not public.has_permission('purchases.create') then
    raise exception 'You do not have permission to create purchases';
  end if;

  if not public.can_access_branch(target_branch)
    or not exists(select 1 from public.branches b where b.id = target_branch and b.is_active) then
    raise exception 'You do not have permission to use this receiving branch';
  end if;
  if not exists(select 1 from public.suppliers s where s.id = target_supplier and s.is_active) then
    raise exception 'Choose an active supplier';
  end if;
  effective_date := public.assert_transaction_date(purchase_on);
  if expected_on is not null and expected_on < effective_date then
    raise exception 'Expected delivery cannot be earlier than the purchase date';
  end if;
  if items is null or jsonb_typeof(items) <> 'array' then
    raise exception 'Purchase items must be a list';
  end if;
  if place_order and jsonb_array_length(items) = 0 then
    raise exception 'Add at least one complete product line before confirming the purchase order';
  end if;
  if exists(select 1 from (
      select value->>'variant_id' from jsonb_array_elements(items) group by 1 having count(*) > 1
    ) duplicates) then raise exception 'Duplicate variants are not allowed'; end if;
  if coalesce(purchase_discount, 0) < 0 or coalesce(purchase_other_costs, 0) < 0 then
    raise exception 'Purchase adjustments cannot be negative';
  end if;

  if is_update then
    new_id := p.id;
    delete from public.purchase_items where purchase_id = p.id;
    update public.purchases set supplier_id = target_supplier, branch_id = target_branch,
      supplier_invoice_number = nullif(trim(supplier_invoice), ''), purchase_date = effective_date,
      expected_delivery_date = expected_on, notes = nullif(trim(purchase_notes), ''),
      updated_by = auth.uid()
    where id = p.id;
  else
    insert into public.purchases(
      purchase_number, supplier_id, branch_id, supplier_invoice_number, purchase_date,
      expected_delivery_date, notes, created_by, payable_basis, payable_value, balance_due
    ) values (
      public.next_purchasing_number('PUR'), target_supplier, target_branch,
      nullif(trim(supplier_invoice), ''), effective_date, expected_on,
      nullif(trim(purchase_notes), ''), auth.uid(), 'ACTUAL_RECEIPT_COST', 0, 0
    ) returning id into new_id;
  end if;

  for item in select value from jsonb_array_elements(items) loop
    begin
      variant := (item->>'variant_id')::uuid;
      qty := (item->>'quantity')::numeric;
      cost := (item->>'unit_cost')::numeric;
      discount := coalesce((item->>'discount_amount')::numeric, 0);
    exception when others then raise exception 'Purchase item values are invalid';
    end;
    if cost is null or cost < 0 or cost <> round(cost, 2) or discount < 0 or discount <> round(discount, 2) then
      raise exception 'Buying prices and discounts must be valid amounts with at most two decimals';
    end if;
    perform public.validate_inventory_quantity(variant, qty, false);
    if not exists(select 1 from public.product_variants v join public.products product on product.id = v.product_id
      where v.id = variant and v.is_active and product.status = 'ACTIVE') then
      raise exception 'Choose an active product variant';
    end if;
    line_total := round(qty * cost, 2) - discount;
    if line_total < 0 then raise exception 'An item discount cannot exceed its value'; end if;
    insert into public.purchase_items(purchase_id, variant_id, ordered_quantity, unit_cost,
      discount_amount, line_total, notes)
    values(new_id, variant, qty, cost, discount, line_total, nullif(trim(item->>'notes'), ''));
    subtotal_value := subtotal_value + line_total;
  end loop;

  total_value := subtotal_value - coalesce(purchase_discount, 0) + coalesce(purchase_other_costs, 0);
  if total_value < 0 then raise exception 'Purchase discount cannot exceed the purchase value'; end if;
  update public.purchases set subtotal = subtotal_value,
    discount_amount = coalesce(purchase_discount, 0),
    other_costs = coalesce(purchase_other_costs, 0),
    total_amount = total_value
  where id = new_id;
  if is_update and p.payable_basis = 'ORDER_VALUE_LEGACY' then
    if p.amount_paid > total_value then raise exception 'Purchase total cannot be less than payments already recorded'; end if;
    update public.purchases set payable_value = total_value, balance_due = total_value - amount_paid,
      payment_status = case when total_value = amount_paid and amount_paid > 0 then 'PAID'::public.purchase_payment_status
        when amount_paid > 0 then 'PARTIALLY_PAID'::public.purchase_payment_status else 'UNPAID'::public.purchase_payment_status end
    where id = new_id;
  end if;

  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), target_branch, case when is_update then 'purchase.draft_updated' else 'purchase.created' end,
    'purchases', new_id, jsonb_build_object('supplier_id', target_supplier,
      'item_count', jsonb_array_length(items), 'ordered_value', total_value, 'place_order', place_order));
  if place_order then
    update public.purchases set status = 'ORDERED', updated_by = auth.uid() where id = new_id;
    insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
    values(auth.uid(), target_branch, 'purchase.ordered', 'purchases', new_id,
      jsonb_build_object('purchase_number', (select purchase_number from public.purchases where id = new_id)));
  end if;
  return new_id;
end;
$$;
