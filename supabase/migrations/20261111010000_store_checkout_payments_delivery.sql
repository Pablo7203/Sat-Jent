-- Extend public order requests into tracked checkout orders without changing the
-- existing staff request-review workflow.
alter table public.store_order_requests
  add column order_kind text not null default 'REQUEST'
    check (order_kind in ('REQUEST', 'CHECKOUT')),
  add column fulfillment_method text
    check (fulfillment_method is null or fulfillment_method in ('PICKUP', 'DELIVERY')),
  add column payment_method text
    check (payment_method is null or payment_method in ('PAY_ON_DELIVERY', 'PAYSTACK')),
  add column payment_status text not null default 'NOT_APPLICABLE'
    check (payment_status in ('NOT_APPLICABLE', 'PENDING', 'PAID')),
  add column fulfillment_status text
    check (fulfillment_status is null or fulfillment_status in (
      'AWAITING_PAYMENT', 'CONFIRMED', 'PREPARING',
      'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
    )),
  add column delivery_address text
    check (delivery_address is null or char_length(delivery_address) <= 1000),
  add column delivery_instructions text
    check (delivery_instructions is null or char_length(delivery_instructions) <= 1000),
  add column tracking_token_hash text unique
    check (tracking_token_hash is null or tracking_token_hash ~ '^[a-f0-9]{64}$'),
  add constraint store_order_checkout_fields_check check (
    (order_kind = 'REQUEST'
      and fulfillment_method is null
      and payment_method is null
      and payment_status = 'NOT_APPLICABLE'
      and fulfillment_status is null
      and tracking_token_hash is null)
    or
    (order_kind = 'CHECKOUT'
      and fulfillment_method is not null
      and payment_method is not null
      and payment_status in ('PENDING', 'PAID')
      and fulfillment_status is not null
      and tracking_token_hash is not null
      and (fulfillment_method = 'PICKUP' or delivery_address is not null))
  );

create table public.store_order_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_order_requests(id) on delete restrict,
  reference text not null unique check (char_length(reference) between 12 and 100),
  amount_pesewas bigint not null check (amount_pesewas > 0),
  status text not null default 'INITIALIZING'
    check (status in ('INITIALIZING', 'PENDING', 'PAID', 'FAILED')),
  authorization_url text check (authorization_url is null or char_length(authorization_url) <= 2048),
  paystack_transaction_id text unique,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create unique index store_order_one_active_payment_attempt_idx
  on public.store_order_payment_attempts(order_id)
  where status in ('INITIALIZING', 'PENDING');
create table public.store_order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_order_requests(id) on delete restrict,
  fulfillment_status text not null
    check (fulfillment_status in (
      'AWAITING_PAYMENT', 'CONFIRMED', 'PREPARING',
      'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
    )),
  payment_status text not null
    check (payment_status in ('PENDING', 'PAID')),
  actor_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index store_order_checkout_status_idx
  on public.store_order_requests(order_kind, fulfillment_status, created_at desc);
create index store_order_payment_order_idx
  on public.store_order_payment_attempts(order_id, created_at desc);
create index store_order_events_order_idx
  on public.store_order_status_events(order_id, created_at);

alter table public.store_order_payment_attempts enable row level security;
alter table public.store_order_status_events enable row level security;

create policy store_order_status_events_authorized_read
  on public.store_order_status_events
  for select to authenticated
  using (
    public.has_permission('store_orders.read')
    and exists (
      select 1
      from public.store_order_requests r
      where r.id = order_id
        and public.can_access_branch(r.branch_id)
    )
  );

revoke all on public.store_order_payment_attempts, public.store_order_status_events
  from public, anon, authenticated;
grant select on public.store_order_status_events to authenticated;
grant all on public.store_order_payment_attempts, public.store_order_status_events
  to service_role;

-- A checkout can only be created from database-verified prices and stock. The
-- browser provides a random tracking token; only its SHA-256 hash is retained.
create function public.submit_store_checkout_order(
  request_key uuid,
  visitor_name text,
  visitor_phone text,
  visitor_email text,
  visitor_company text,
  target_branch uuid,
  visitor_message text,
  items jsonb,
  chosen_fulfillment text,
  chosen_payment text,
  requested_delivery_address text,
  requested_delivery_instructions text,
  tracking_hash text
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  request_result jsonb;
  order_row public.store_order_requests%rowtype;
  next_status text;
begin
  if chosen_fulfillment not in ('PICKUP', 'DELIVERY')
    or chosen_payment not in ('PAY_ON_DELIVERY', 'PAYSTACK')
    or tracking_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Check the checkout details';
  end if;
  if chosen_payment = 'PAY_ON_DELIVERY' and chosen_fulfillment <> 'DELIVERY' then
    raise exception 'Pay on delivery requires a delivery address';
  end if;
  if chosen_payment = 'PAYSTACK'
    and (visitor_email is null or trim(visitor_email) = '') then
    raise exception 'An email address is required for Paystack checkout';
  end if;
  if chosen_fulfillment = 'DELIVERY'
    and char_length(trim(coalesce(requested_delivery_address, ''))) < 8 then
    raise exception 'Enter a complete delivery address';
  end if;
  if requested_delivery_address is not null
    and char_length(requested_delivery_address) > 1000 then
    raise exception 'Delivery address is too long';
  end if;
  if requested_delivery_instructions is not null
    and char_length(requested_delivery_instructions) > 1000 then
    raise exception 'Delivery instructions are too long';
  end if;

  select * into order_row
    from public.store_order_requests
    where idempotency_key = request_key
    for update;

  if found then
    if order_row.order_kind <> 'CHECKOUT'
      or order_row.tracking_token_hash <> tracking_hash then
      raise exception 'This checkout has already been submitted';
    end if;
    return jsonb_build_object(
      'order_id', order_row.id,
      'order_number', order_row.request_number,
      'total', order_row.estimated_total,
      'payment_method', order_row.payment_method,
      'payment_status', order_row.payment_status
    );
  end if;

  request_result := public.submit_store_order_request(
    request_key, visitor_name, visitor_phone, visitor_email,
    visitor_company, target_branch, visitor_message, items
  );

  select * into order_row
    from public.store_order_requests
    where idempotency_key = request_key
    for update;

  if not found then
    raise exception 'Could not create this checkout';
  end if;
  if order_row.order_kind = 'CHECKOUT' then
    if order_row.tracking_token_hash <> tracking_hash then
      raise exception 'This checkout has already been submitted';
    end if;
    return jsonb_build_object(
      'order_id', order_row.id,
      'order_number', order_row.request_number,
      'total', order_row.estimated_total,
      'payment_method', order_row.payment_method,
      'payment_status', order_row.payment_status
    );
  end if;
  if order_row.order_kind <> 'REQUEST' then
    raise exception 'Could not create this checkout';
  end if;
  if order_row.estimated_total is null or order_row.estimated_total <= 0
    or exists (
      select 1 from public.store_order_request_items i
      where i.request_id = order_row.id
        and i.estimated_unit_price is null
    ) then
    raise exception 'Current prices are not available for every item';
  end if;

  next_status := case
    when chosen_payment = 'PAYSTACK' then 'AWAITING_PAYMENT'
    else 'CONFIRMED'
  end;

  update public.store_order_requests
    set order_kind = 'CHECKOUT',
        fulfillment_method = chosen_fulfillment,
        payment_method = chosen_payment,
        payment_status = 'PENDING',
        fulfillment_status = next_status,
        delivery_address = case
          when chosen_fulfillment = 'DELIVERY'
          then trim(requested_delivery_address)
          else null
        end,
        delivery_instructions = nullif(trim(requested_delivery_instructions), ''),
        tracking_token_hash = tracking_hash
    where id = order_row.id
    returning * into order_row;

  insert into public.store_order_status_events(
    order_id, fulfillment_status, payment_status
  ) values (
    order_row.id, order_row.fulfillment_status, order_row.payment_status
  );

  return jsonb_build_object(
    'order_id', order_row.id,
    'order_number', order_row.request_number,
    'total', order_row.estimated_total,
    'payment_method', order_row.payment_method,
    'payment_status', order_row.payment_status
  );
end;
$$;

-- Only a server-side Paystack verification can mark an order as paid.
create function public.confirm_store_order_payment(
  target_reference text,
  transaction_id text
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  attempt public.store_order_payment_attempts%rowtype;
  order_row public.store_order_requests%rowtype;
  next_status text;
begin
  select * into attempt
    from public.store_order_payment_attempts
    where reference = target_reference
    for update;
  if not found then raise exception 'Payment attempt not found'; end if;

  select * into order_row
    from public.store_order_requests
    where id = attempt.order_id
    for update;
  if not found
    or order_row.order_kind <> 'CHECKOUT'
    or order_row.payment_method <> 'PAYSTACK' then
    raise exception 'Checkout order not found';
  end if;

  if attempt.status = 'PAID' and order_row.payment_status = 'PAID' then
    return order_row.id;
  end if;

  update public.store_order_payment_attempts
    set status = 'PAID',
        paystack_transaction_id = transaction_id,
        verified_at = now()
    where id = attempt.id;

  next_status := case
    when order_row.fulfillment_status = 'AWAITING_PAYMENT' then 'CONFIRMED'
    else order_row.fulfillment_status
  end;

  update public.store_order_requests
    set payment_status = 'PAID',
        fulfillment_status = next_status,
        status_changed_at = case
          when fulfillment_status = 'AWAITING_PAYMENT' then now()
          else status_changed_at
        end
    where id = order_row.id;

  if order_row.payment_status <> 'PAID'
    or order_row.fulfillment_status = 'AWAITING_PAYMENT' then
    insert into public.store_order_status_events(
      order_id, fulfillment_status, payment_status
    ) values (order_row.id, next_status, 'PAID');
  end if;

  return order_row.id;
end;
$$;

-- Employee updates are permission-checked, branch-scoped, and recorded as
-- immutable order history. Paystack orders cannot move before verification.
create function public.update_store_checkout_fulfillment(
  target_order uuid,
  target_status text,
  cash_collected boolean default false
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  order_row public.store_order_requests%rowtype;
  allowed_transition boolean := false;
  next_payment_status text;
begin
  select * into order_row
    from public.store_order_requests
    where id = target_order
    for update;

  if not found
    or order_row.order_kind <> 'CHECKOUT'
    or not public.has_permission('store_orders.update')
    or not public.can_access_branch(order_row.branch_id) then
    raise exception 'Online order unavailable';
  end if;

  if target_status not in (
    'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
  ) then
    raise exception 'Choose a valid order status';
  end if;

  if order_row.payment_method = 'PAYSTACK'
    and order_row.payment_status <> 'PAID' then
    raise exception 'Confirm Paystack payment before updating this order';
  end if;

  if cash_collected
    and (order_row.payment_method <> 'PAY_ON_DELIVERY' or target_status <> 'DELIVERED') then
    raise exception 'Cash can only be recorded when a delivery is marked delivered';
  end if;

  if order_row.payment_method = 'PAY_ON_DELIVERY'
    and target_status = 'DELIVERED'
    and order_row.payment_status <> 'PAID'
    and not cash_collected then
    raise exception 'Confirm cash collection before marking the order delivered';
  end if;

  allowed_transition := case order_row.fulfillment_status
    when 'CONFIRMED' then target_status in ('PREPARING', 'CANCELLED')
    when 'PREPARING' then
      (order_row.fulfillment_method = 'PICKUP' and target_status = 'READY_FOR_PICKUP')
      or (order_row.fulfillment_method = 'DELIVERY' and target_status = 'OUT_FOR_DELIVERY')
      or target_status = 'CANCELLED'
    when 'READY_FOR_PICKUP' then
      (target_status = 'DELIVERED' and order_row.fulfillment_method = 'PICKUP')
    when 'OUT_FOR_DELIVERY' then
      (target_status = 'DELIVERED' and order_row.fulfillment_method = 'DELIVERY')
    else false
  end;

  if not allowed_transition then
    raise exception 'This order cannot move from its current status';
  end if;

  next_payment_status := case
    when cash_collected then 'PAID'
    else order_row.payment_status
  end;

  update public.store_order_requests
    set fulfillment_status = target_status,
        payment_status = next_payment_status,
        status_changed_by = auth.uid(),
        status_changed_at = now()
    where id = order_row.id;

  insert into public.store_order_status_events(
    order_id, fulfillment_status, payment_status, actor_user_id
  ) values (
    order_row.id, target_status, next_payment_status, auth.uid()
  );

  insert into public.audit_logs(
    actor_user_id, branch_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    auth.uid(), order_row.branch_id, 'store_order.fulfillment_updated',
    'store_order_requests', order_row.id,
    jsonb_build_object(
      'fulfillment_status', order_row.fulfillment_status,
      'payment_status', order_row.payment_status
    ),
    jsonb_build_object(
      'fulfillment_status', target_status,
      'payment_status', next_payment_status
    )
  );
end;
$$;

-- Keep enquiry actions restricted to enquiry rows. Checkout orders use their
-- dedicated payment and fulfilment state machine above.
create or replace function public.update_store_order_request_status(
  target_request uuid,
  new_status public.store_order_request_status
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  request_row public.store_order_requests%rowtype;
begin
  select * into request_row
    from public.store_order_requests
    where id = target_request
    for update;

  if not found
    or request_row.order_kind <> 'REQUEST'
    or not public.has_permission('store_orders.update')
    or not public.can_access_branch(request_row.branch_id) then
    raise exception 'Order request unavailable';
  end if;

  if request_row.status not in ('PENDING_CONFIRMATION', 'CONTACTED')
    or new_status not in ('CONTACTED', 'DECLINED', 'CANCELLED') then
    raise exception 'This order request can no longer be updated';
  end if;

  if new_status = request_row.status then return; end if;

  update public.store_order_requests
    set status = new_status,
        status_changed_by = auth.uid(),
        status_changed_at = now()
    where id = target_request;

  insert into public.audit_logs(
    actor_user_id, branch_id, action, entity_type, entity_id, old_values, new_values
  ) values (
    auth.uid(), request_row.branch_id, 'store_order_request.status_changed',
    'store_order_requests', target_request,
    jsonb_build_object('status', request_row.status),
    jsonb_build_object('status', new_status)
  );
end;
$$;

create or replace function public.accept_store_order_request(
  target_request uuid
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  request_row public.store_order_requests%rowtype;
  customer_id uuid;
  sale_id uuid;
  order_items jsonb;
begin
  select * into request_row
    from public.store_order_requests
    where id = target_request
    for update;

  if not found
    or request_row.order_kind <> 'REQUEST'
    or not public.has_permission('store_orders.confirm')
    or not public.can_access_branch(request_row.branch_id)
    or not public.has_permission('customers.create')
    or not public.has_permission('sales.create') then
    raise exception 'Order request unavailable';
  end if;

  if request_row.status in ('DRAFT_CREATED', 'SALE_COMPLETED')
    and request_row.linked_sale_id is not null then
    return request_row.linked_sale_id;
  end if;

  if request_row.status not in ('PENDING_CONFIRMATION', 'CONTACTED') then
    raise exception 'This order request can no longer be accepted';
  end if;

  select jsonb_agg(jsonb_build_object(
    'variant_id', i.variant_id,
    'quantity', i.quantity,
    'price_type', 'RETAIL'
  ))
    into order_items
    from public.store_order_request_items i
    where i.request_id = target_request;

  if coalesce(jsonb_array_length(order_items), 0) = 0 then
    raise exception 'Order request has no items';
  end if;

  customer_id := public.create_customer(
    request_row.customer_name,
    case
      when request_row.customer_company is null
        then 'INDIVIDUAL'::public.customer_type
      else 'CONSTRUCTION_COMPANY'::public.customer_type
    end,
    request_row.customer_company,
    request_row.customer_phone,
    request_row.customer_email,
    null,
    'Created from online order request ' || request_row.request_number
  );

  sale_id := public.create_sale(
    request_row.branch_id,
    customer_id,
    null,
    'Online order request ' || request_row.request_number || '. ' ||
      coalesce(request_row.customer_message, ''),
    0,
    null,
    order_items
  );

  update public.store_order_requests
    set status = 'DRAFT_CREATED',
        linked_sale_id = sale_id,
        status_changed_by = auth.uid(),
        status_changed_at = now()
    where id = target_request;

  insert into public.audit_logs(
    actor_user_id, branch_id, action, entity_type, entity_id, new_values, metadata
  ) values (
    auth.uid(), request_row.branch_id, 'store_order_request.sale_draft_created',
    'store_order_requests', target_request,
    jsonb_build_object('status', request_row.status),
    jsonb_build_object(
      'status', 'DRAFT_CREATED',
      'sale_id', sale_id,
      'sale_number', (select sale_number from public.sales where id = sale_id)
    )
  );

  return sale_id;
end;
$$;
-- The tracking bearer token is hashed before this RPC is called. It returns
-- customer-safe data only and is callable by the trusted server role.
create function public.get_store_order_tracking(target_tracking_hash text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_number', r.request_number,
    'fulfillment_method', r.fulfillment_method,
    'fulfillment_status', r.fulfillment_status,
    'payment_method', r.payment_method,
    'payment_status', r.payment_status,
    'created_at', r.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product', i.product_name_snapshot,
        'variant', i.variant_name_snapshot,
        'quantity', i.quantity,
        'unit', i.unit_snapshot
      ) order by i.created_at)
      from public.store_order_request_items i
      where i.request_id = r.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fulfillment_status', e.fulfillment_status,
        'payment_status', e.payment_status,
        'created_at', e.created_at
      ) order by e.created_at)
      from public.store_order_status_events e
      where e.order_id = r.id
    ), '[]'::jsonb)
  )
  from public.store_order_requests r
  where r.order_kind = 'CHECKOUT'
    and r.tracking_token_hash = target_tracking_hash
    and target_tracking_hash ~ '^[a-f0-9]{64}$';
$$;

revoke all on function public.submit_store_checkout_order(
  uuid, text, text, text, text, uuid, text, jsonb, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_store_checkout_order(
  uuid, text, text, text, text, uuid, text, jsonb, text, text, text, text, text
) to service_role;

revoke all on function public.confirm_store_order_payment(text, text)
  from public, anon, authenticated;
grant execute on function public.confirm_store_order_payment(text, text)
  to service_role;

revoke all on function public.update_store_checkout_fulfillment(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.update_store_checkout_fulfillment(uuid, text, boolean)
  to authenticated;

revoke all on function public.get_store_order_tracking(text)
  from public, anon, authenticated;
grant execute on function public.get_store_order_tracking(text)
  to service_role;
