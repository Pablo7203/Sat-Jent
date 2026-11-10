-- Phase 3: preserve PO prices while recording actual receipt cost and
-- recognizing new supplier payables only when goods are received.

create type public.purchase_payable_basis as enum (
  'ORDER_VALUE_LEGACY',
  'ACTUAL_RECEIPT_COST'
);

alter table public.purchases
  add column payable_basis public.purchase_payable_basis not null default 'ORDER_VALUE_LEGACY',
  add column payable_value numeric(14,2);

-- Preserve existing balances exactly. Historical receipts did not store actual
-- receipt cost; their existing PO-value payable treatment remains explicit.
update public.purchases
set payable_value = amount_paid + balance_due;

alter table public.purchases
  alter column payable_value set default 0,
  alter column payable_value set not null;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.purchases'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%amount_paid%'
      and pg_get_constraintdef(c.oid) ilike '%balance_due%'
      and pg_get_constraintdef(c.oid) ilike '%total_amount%'
  loop
    execute format('alter table public.purchases drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.purchases
  add constraint purchases_payable_value_nonnegative check (payable_value >= 0),
  add constraint purchases_payable_reconciles check (amount_paid + balance_due = payable_value);

alter table public.goods_receipt_items
  add column agreed_unit_cost_snapshot numeric(14,2),
  add column actual_unit_cost numeric(14,2),
  add column receipt_value numeric(14,2),
  add column zero_cost_reason text,
  add column standard_selling_price_snapshot numeric(14,2);

-- Agreed PO cost is known historical data. Actual cost is intentionally left
-- NULL for old receipts instead of inventing a value from the PO.
update public.goods_receipt_items gri
set agreed_unit_cost_snapshot = pi.unit_cost
from public.purchase_items pi
where pi.id = gri.purchase_item_id;

alter table public.goods_receipt_items
  alter column agreed_unit_cost_snapshot set not null,
  add constraint goods_receipt_items_receipt_value_check check (
    (actual_unit_cost is null and receipt_value is null)
    or (actual_unit_cost is not null and actual_unit_cost >= 0
      and receipt_value = round(quantity_received * actual_unit_cost, 2))
  ),
  add constraint goods_receipt_items_zero_cost_reason_check check (
    actual_unit_cost is null or actual_unit_cost > 0
    or char_length(trim(coalesce(zero_cost_reason, ''))) >= 5
  );

create or replace view public.purchase_statement
with (security_invoker = true) as
select
  p.id, p.purchase_number, p.supplier_id, p.branch_id, p.supplier_invoice_number,
  p.purchase_date, p.expected_delivery_date, p.status, p.payment_status,
  p.subtotal, p.discount_amount, p.other_costs, p.total_amount, p.amount_paid,
  p.balance_due, p.currency_code, p.notes, p.created_by, p.updated_by,
  p.created_at, p.updated_at, p.cancelled_at, p.cancelled_by,
  s.supplier_code, s.name as supplier_name, b.name as branch_name,
  p.payable_basis, p.payable_value
from public.purchases p
join public.suppliers s on s.id = p.supplier_id
join public.branches b on b.id = p.branch_id;

create or replace function public.inventory_apply_movement(
  target_branch uuid, target_variant uuid, target_type public.stock_movement_type,
  delta numeric, target_reference_type text, target_reference_id uuid,
  target_reason text, target_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  before_qty numeric(14,3);
  after_qty numeric(14,3);
  movement_id uuid;
  movement_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if delta = 0 then raise exception 'Movement quantity cannot be zero'; end if;
  perform public.validate_inventory_quantity(target_variant, abs(delta), false);
  if not exists(select 1 from public.branches where id = target_branch and is_active) then
    raise exception 'Inventory mutations require an active branch';
  end if;
  if not exists(select 1 from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = target_variant and v.is_active and p.status = 'ACTIVE') then
    raise exception 'Inventory mutations require an active product variant';
  end if;
  if target_type not in ('STOCK_COUNT_INCREASE', 'STOCK_COUNT_DECREASE')
    and exists(select 1 from public.stock_counts c join public.stock_count_items i on i.stock_count_id = c.id
      where c.branch_id = target_branch and c.status = 'IN_PROGRESS' and i.variant_id = target_variant) then
    raise exception 'Stock is locked by an in-progress count';
  end if;

  -- This transaction-local timestamp is set only by the guarded receipt RPC;
  -- every other inventory workflow continues to use the actual posting time.
  movement_at := coalesce(
    nullif(current_setting('app.stock_movement_at', true), '')::timestamptz,
    now()
  );
  insert into public.branch_inventory(branch_id, variant_id)
  values(target_branch, target_variant) on conflict(branch_id, variant_id) do nothing;
  select quantity_on_hand into before_qty from public.branch_inventory
  where branch_id = target_branch and variant_id = target_variant for update;
  after_qty := before_qty + delta;
  if after_qty < 0 then raise exception 'There is not enough stock to complete this operation'; end if;
  insert into public.stock_movements(
    branch_id, variant_id, movement_type, quantity_delta, balance_before,
    balance_after, reference_type, reference_id, reason_code, notes, performed_by, occurred_at
  ) values (
    target_branch, target_variant, target_type, delta, before_qty, after_qty,
    target_reference_type, target_reference_id, target_reason,
    nullif(trim(target_notes), ''), auth.uid(), movement_at
  ) returning id into movement_id;
  update public.branch_inventory set quantity_on_hand = after_qty
  where branch_id = target_branch and variant_id = target_variant;
  return movement_id;
end;
$$;

revoke all on function public.inventory_apply_movement(uuid,uuid,public.stock_movement_type,numeric,text,uuid,text,text)
  from public, anon, authenticated;

create function public.current_selling_prices_for_branch(
  target_branch uuid,
  target_variants uuid[]
) returns table(variant_id uuid, standard_selling_price numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_permission('product_prices.read')
    or not public.can_access_branch(target_branch)
    or not exists(select 1 from public.branches b where b.id = target_branch and b.is_active) then
    raise exception 'You do not have access to these selling prices';
  end if;
  return query
  select v.id,
    (select pp.amount from public.product_prices pp
      where pp.variant_id = v.id and pp.price_type = 'RETAIL'
        and pp.effective_from <= now() and (pp.effective_to is null or pp.effective_to > now())
        and (pp.branch_id is null or pp.branch_id = target_branch)
      order by case when pp.branch_id = target_branch then 0 else 1 end, pp.effective_from desc
      limit 1)
  from unnest(coalesce(target_variants, '{}'::uuid[])) as requested(id)
  join public.product_variants v on v.id = requested.id;
end;
$$;

create function public.save_purchase_order(
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
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'At least one purchase item is required';
  end if;
  if exists(select 1 from (
      select value->>'variant_id' from jsonb_array_elements(items) group by 1 having count(*) > 1
    ) duplicates) then raise exception 'Duplicate variants are not allowed'; end if;
  if coalesce(purchase_discount, 0) < 0 or coalesce(purchase_other_costs, 0) < 0 then
    raise exception 'Purchase adjustments cannot be negative';
  end if;

  if is_update then
    new_id := p.id;
    if p.payable_basis = 'ORDER_VALUE_LEGACY' and p.amount_paid > 0 then
      -- Keep a legacy draft's original recorded payments, but do not let edits
      -- lower the order below amounts already paid.
      null;
    end if;
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

create or replace function public.create_purchase(
  target_supplier uuid, target_branch uuid, purchase_on date, expected_on date,
  supplier_invoice text, purchase_notes text, purchase_discount numeric,
  purchase_other_costs numeric, items jsonb
) returns uuid language sql security definer set search_path = '' as $$
  select public.save_purchase_order(null, target_supplier, target_branch, purchase_on,
    expected_on, supplier_invoice, purchase_notes, purchase_discount, purchase_other_costs, items, false);
$$;

create function public.post_goods_receipt(
  target_purchase uuid,
  operation_id uuid,
  delivery_reference text,
  receipt_notes text,
  receipt_on date,
  items jsonb,
  price_changes jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.purchases%rowtype;
  line public.purchase_items%rowtype;
  item jsonb;
  price_change jsonb;
  variant uuid;
  qty numeric;
  actual_cost numeric;
  line_value numeric(14,2);
  receipt_value_total numeric(14,2) := 0;
  variance_total numeric(14,2) := 0;
  new_payable numeric(14,2);
  new_balance numeric(14,2);
  standard_price numeric(14,2);
  movement uuid;
  receipt_id uuid;
  existing_id uuid;
  receipt_count integer := 0;
  remaining_items integer;
  effective_date date;
  price_branch uuid;
  price_amount numeric;
  price_scope text;
begin
  if operation_id is null then raise exception 'A receipt operation identifier is required'; end if;
  select * into p from public.purchases where id = target_purchase for update;
  if not found then raise exception 'Purchase not found'; end if;
  if not public.has_permission('purchases.receive') or not public.can_access_branch(p.branch_id)
    or not exists(select 1 from public.branches b where b.id = p.branch_id and b.is_active) then
    raise exception 'You do not have permission to receive this purchase';
  end if;
  select id into existing_id from public.goods_receipts
    where purchase_id = p.id and operation_key = operation_id;
  if found then return existing_id; end if;
  if p.status not in ('ORDERED', 'PARTIALLY_RECEIVED') then
    raise exception 'This purchase is not open for receiving';
  end if;
  effective_date := public.assert_transaction_date(receipt_on);
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'At least one receipt item is required';
  end if;
  if exists(select 1 from (
      select value->>'purchase_item_id' from jsonb_array_elements(items) group by 1 having count(*) > 1
    ) duplicates) then raise exception 'Duplicate receipt items are not allowed'; end if;
  if exists(select 1 from jsonb_array_elements(items) value where coalesce((value->>'quantity')::numeric, 0) > 0
      and value->>'actual_unit_cost' is null) then
    raise exception 'Actual buying cost is required for every received item';
  end if;
  if not exists(select 1 from jsonb_array_elements(items) value where coalesce((value->>'quantity')::numeric, 0) > 0) then
    raise exception 'At least one positive receipt quantity is required';
  end if;
  if price_changes is null or jsonb_typeof(price_changes) <> 'array' then
    raise exception 'Price changes are invalid';
  end if;
  if exists(select 1 from (
      select value->>'variant_id', value->>'scope' from jsonb_array_elements(price_changes)
      group by 1, 2 having count(*) > 1
    ) duplicates) then raise exception 'A selling price can only be updated once per item and scope'; end if;

  insert into public.goods_receipts(receipt_number, purchase_id, branch_id, operation_key,
    received_at, supplier_delivery_reference, notes, received_by)
  values(public.next_purchasing_number('GRN'), p.id, p.branch_id, operation_id,
    effective_date::timestamptz, nullif(trim(delivery_reference), ''),
    nullif(trim(receipt_notes), ''), auth.uid()) returning id into receipt_id;

  for item in select value from jsonb_array_elements(items) order by value->>'purchase_item_id' loop
    begin
      qty := coalesce((item->>'quantity')::numeric, 0);
      if qty = 0 then continue; end if;
      actual_cost := (item->>'actual_unit_cost')::numeric;
      select * into line from public.purchase_items
        where id = (item->>'purchase_item_id')::uuid and purchase_id = p.id for update;
    exception when others then raise exception 'Receipt item values are invalid';
    end;
    if not found then raise exception 'Receipt item does not belong to this purchase'; end if;
    if actual_cost is null or actual_cost < 0 or actual_cost <> round(actual_cost, 2) then
      raise exception 'Actual buying cost must be a valid non-negative amount with at most two decimals';
    end if;
    if actual_cost = 0 and char_length(trim(coalesce(item->>'zero_cost_reason', ''))) < 5 then
      raise exception 'Explain why this item was received at zero cost';
    end if;
    perform public.validate_inventory_quantity(line.variant_id, qty, false);
    if line.received_quantity + qty > line.ordered_quantity then
      raise exception 'You cannot receive more than the remaining ordered quantity';
    end if;
    select pp.amount into standard_price from public.product_prices pp
      where pp.variant_id = line.variant_id and pp.price_type = 'RETAIL'
        and pp.effective_from <= now() and (pp.effective_to is null or pp.effective_to > now())
        and (pp.branch_id is null or pp.branch_id = p.branch_id)
      order by case when pp.branch_id = p.branch_id then 0 else 1 end, pp.effective_from desc limit 1;
    perform set_config('app.stock_movement_at', effective_date::timestamptz::text, true);
    movement := public.inventory_apply_movement(p.branch_id, line.variant_id, 'PURCHASE_RECEIPT', qty,
      'GOODS_RECEIPT', receipt_id, p.purchase_number, receipt_notes);
    perform set_config('app.stock_movement_at', '', true);
    line_value := round(qty * actual_cost, 2);
    insert into public.goods_receipt_items(goods_receipt_id, purchase_item_id, variant_id,
      quantity_received, stock_movement_id, agreed_unit_cost_snapshot, actual_unit_cost,
      receipt_value, zero_cost_reason, standard_selling_price_snapshot)
    values(receipt_id, line.id, line.variant_id, qty, movement, line.unit_cost,
      actual_cost, line_value, nullif(trim(item->>'zero_cost_reason'), ''), standard_price);
    update public.purchase_items set received_quantity = received_quantity + qty where id = line.id;
    receipt_value_total := receipt_value_total + line_value;
    variance_total := variance_total + round(qty * (actual_cost - line.unit_cost), 2);
    receipt_count := receipt_count + 1;
  end loop;
  perform set_config('app.stock_movement_at', '', true);
  if receipt_count = 0 then raise exception 'At least one positive receipt quantity is required'; end if;

  for price_change in select value from jsonb_array_elements(price_changes) loop
    begin
      variant := (price_change->>'variant_id')::uuid;
      price_scope := price_change->>'scope';
      price_amount := (price_change->>'amount')::numeric;
    exception when others then raise exception 'Selling price change is invalid';
    end;
    if price_scope not in ('COMPANY', 'BRANCH') or price_amount is null or price_amount < 0
      or price_amount <> round(price_amount, 2) then
      raise exception 'Selling price change must have a valid scope and non-negative amount';
    end if;
    if not exists(select 1 from public.goods_receipt_items gri
      where gri.goods_receipt_id = receipt_id and gri.variant_id = variant) then
      raise exception 'Selling price can only be changed for an item received in this receipt';
    end if;
    price_branch := case when price_scope = 'BRANCH' then p.branch_id else null end;
    perform public.change_product_price(variant, price_branch, 'RETAIL', price_amount, now());
  end loop;

  select count(*) into remaining_items from public.purchase_items
    where purchase_id = p.id and received_quantity < ordered_quantity;
  new_payable := p.payable_value;
  new_balance := p.balance_due;
  if p.payable_basis = 'ACTUAL_RECEIPT_COST' then
    new_payable := p.payable_value + receipt_value_total;
    new_balance := new_payable - p.amount_paid;
  end if;
  update public.purchases set
    status = case when remaining_items = 0 then 'RECEIVED'::public.purchase_status
      else 'PARTIALLY_RECEIVED'::public.purchase_status end,
    payable_value = new_payable,
    balance_due = new_balance,
    payment_status = case when new_balance = 0 and new_payable > 0 then 'PAID'::public.purchase_payment_status
      when p.amount_paid > 0 then 'PARTIALLY_PAID'::public.purchase_payment_status
      else 'UNPAID'::public.purchase_payment_status end,
    updated_by = auth.uid()
  where id = p.id;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), p.branch_id, 'purchase.goods_received', 'goods_receipts', receipt_id,
    jsonb_build_object('purchase_id', p.id, 'purchase_number', p.purchase_number,
      'supplier_id', p.supplier_id, 'item_count', receipt_count,
      'received_value', receipt_value_total, 'purchase_cost_variance', variance_total,
      'receipt_date', effective_date, 'payable_basis', p.payable_basis));
  return receipt_id;
end;
$$;

revoke all on function public.current_selling_prices_for_branch(uuid,uuid[]),
  public.save_purchase_order(uuid,uuid,uuid,date,date,text,text,numeric,numeric,jsonb,boolean),
  public.post_goods_receipt(uuid,uuid,text,text,date,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.current_selling_prices_for_branch(uuid,uuid[]),
  public.save_purchase_order(uuid,uuid,uuid,date,date,text,text,numeric,numeric,jsonb,boolean),
  public.post_goods_receipt(uuid,uuid,text,text,date,jsonb,jsonb) to authenticated;
grant execute on function public.create_purchase(uuid,uuid,date,date,text,text,numeric,numeric,jsonb)
  to authenticated;
