create or replace function public.create_sale(
  target_branch uuid,
  target_customer uuid,
  due_on date,
  sale_notes text,
  sale_discount numeric,
  discount_reason text,
  items jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  entry jsonb;
  variant uuid;
  qty numeric;
  resolved numeric;
  actual numeric;
  line_discount numeric;
  line numeric;
  subtotal_value numeric(14,2) := 0;
  ptype public.price_type := 'RETAIL'::public.price_type;
  product_label text;
  variant_label text;
  sku_label text;
  unit_label text;
begin
  if not public.has_permission('sales.create')
    or not public.can_access_branch(target_branch) then
    raise exception 'You do not have permission to create a sale for this branch';
  end if;
  if not exists (
    select 1 from public.branches where id = target_branch and is_active
  ) then
    raise exception 'Sales require an active branch';
  end if;
  if not exists (
    select 1 from public.customers where id = target_customer and is_active
  ) then
    raise exception 'Choose an active customer';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'At least one sale item is required';
  end if;
  if coalesce(sale_discount, 0) <> 0 then
    raise exception 'Sale-wide discounts are not supported';
  end if;

  insert into public.sales(
    sale_number, branch_id, customer_id, payment_due_date, notes, created_by
  ) values (
    public.next_sales_number('SAL'), target_branch, target_customer, due_on,
    nullif(trim(sale_notes), ''), auth.uid()
  ) returning id into new_id;

  for entry in select value from jsonb_array_elements(items) loop
    variant := (entry->>'variant_id')::uuid;
    qty := (entry->>'quantity')::numeric;
    perform public.validate_inventory_quantity(variant, qty, false);
    resolved := public.resolve_selling_price(variant, target_branch, ptype, now());
    actual := coalesce((entry->>'unit_price')::numeric, resolved);
    line_discount := coalesce((entry->>'discount_amount')::numeric, 0);

    if actual < 0 then raise exception 'Selling price cannot be negative'; end if;
    if actual <> resolved
      and not public.has_permission('sales.price_override') then
      raise exception 'You do not have permission to override this price';
    end if;
    if line_discount <> 0 then
      raise exception 'Line discounts are not supported';
    end if;
    line := round(qty * actual, 2);

    select p.name, v.name, v.sku, u.symbol
      into product_label, variant_label, sku_label, unit_label
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join public.units_of_measure u on u.id = p.unit_of_measure_id
    where v.id = variant and v.is_active and p.status = 'ACTIVE';
    if not found then raise exception 'Choose an active product variant'; end if;

    insert into public.sale_items(
      sale_id, variant_id, quantity, price_type, suggested_unit_price,
      unit_price, price_override_reason, discount_amount, discount_reason,
      line_total, product_name_snapshot, variant_name_snapshot, sku_snapshot,
      unit_snapshot
    ) values (
      new_id, variant, qty, ptype, resolved, actual, null, 0,
      null, line, product_label, variant_label, sku_label, unit_label
    );
    subtotal_value := subtotal_value + line;

    if actual <> resolved then
      insert into public.audit_logs(
        actor_user_id, branch_id, action, entity_type, entity_id, metadata
      ) values (
        auth.uid(), target_branch, 'sale.price_overridden', 'sale_items',
        new_id, jsonb_build_object(
          'variant_id', variant, 'suggested_price', resolved,
          'actual_price', actual
        )
      );
    end if;
  end loop;

  update public.sales
  set subtotal = subtotal_value,
      discount_amount = 0,
      total_amount = subtotal_value,
      balance_due = subtotal_value
  where id = new_id;

  insert into public.audit_logs(
    actor_user_id, branch_id, action, entity_type, entity_id, metadata
  ) values (
    auth.uid(), target_branch, 'sale.created', 'sales', new_id,
    jsonb_build_object(
      'customer_id', target_customer, 'item_count', jsonb_array_length(items),
      'total_amount', subtotal_value
    )
  );
  return new_id;
end;
$$;
