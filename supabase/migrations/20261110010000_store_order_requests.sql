-- Customer order requests enter the branch workflow without changing stock.
-- Staff review a request, create a sale draft, then use the existing sale
-- completion transaction to validate and deduct inventory.

create type public.store_order_request_status as enum (
  'PENDING_CONFIRMATION', 'CONTACTED', 'DRAFT_CREATED', 'SALE_COMPLETED', 'DECLINED', 'CANCELLED'
);

create table public.store_order_request_sequences (
  year integer primary key,
  last_number bigint not null default 0 check (last_number >= 0)
);

create table public.store_order_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  idempotency_key uuid not null unique,
  branch_id uuid not null references public.branches(id) on delete restrict,
  customer_name text not null check (char_length(trim(customer_name)) between 2 and 160),
  customer_phone text not null check (char_length(trim(customer_phone)) between 5 and 40),
  customer_email text check (customer_email is null or char_length(customer_email) <= 254),
  customer_company text check (customer_company is null or char_length(customer_company) <= 160),
  customer_message text check (customer_message is null or char_length(customer_message) <= 2000),
  status public.store_order_request_status not null default 'PENDING_CONFIRMATION',
  estimated_total numeric(14,2) check (estimated_total is null or estimated_total >= 0),
  linked_sale_id uuid references public.sales(id) on delete restrict,
  status_changed_by uuid references auth.users(id) on delete restrict,
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('DRAFT_CREATED', 'SALE_COMPLETED') and linked_sale_id is not null)
    or status not in ('DRAFT_CREATED', 'SALE_COMPLETED'))
);

create table public.store_order_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.store_order_requests(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  variant_name_snapshot text not null,
  sku_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  estimated_unit_price numeric(14,2) check (estimated_unit_price is null or estimated_unit_price >= 0),
  created_at timestamptz not null default now(),
  unique (request_id, variant_id)
);

-- A keyed request counter supports public API throttling without storing visitor IPs.
create table public.store_order_request_limits (
  visitor_key text primary key check (visitor_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

create index store_order_requests_branch_status_idx
  on public.store_order_requests(branch_id, status, created_at desc);
create index store_order_requests_created_idx
  on public.store_order_requests(created_at desc);
create index store_order_items_request_idx
  on public.store_order_request_items(request_id);
create index store_order_request_limits_updated_idx
  on public.store_order_request_limits(updated_at);
create trigger store_order_requests_updated_at before update on public.store_order_requests
  for each row execute function public.set_updated_at();

alter table public.store_order_requests enable row level security;
alter table public.store_order_request_items enable row level security;
alter table public.store_order_request_sequences enable row level security;
alter table public.store_order_request_limits enable row level security;

create policy store_order_requests_authorized_read on public.store_order_requests
  for select to authenticated
  using (public.has_permission('store_orders.read') and public.can_access_branch(branch_id));
create policy store_order_request_items_authorized_read on public.store_order_request_items
  for select to authenticated
  using (public.has_permission('store_orders.read') and exists (
    select 1 from public.store_order_requests r
    where r.id = request_id and public.can_access_branch(r.branch_id)
  ));

revoke all on public.store_order_requests, public.store_order_request_items,
  public.store_order_request_sequences, public.store_order_request_limits
  from public, anon, authenticated;
grant select on public.store_order_requests, public.store_order_request_items to authenticated;
grant all on public.store_order_requests, public.store_order_request_items,
  public.store_order_request_sequences, public.store_order_request_limits to service_role;

insert into public.permissions(id, code, description) values
  ('20000000-0000-4000-8000-000000000813', 'store_orders.read', 'Read online order requests in authorized branches'),
  ('20000000-0000-4000-8000-000000000814', 'store_orders.update', 'Update the contact and decline status of online order requests'),
  ('20000000-0000-4000-8000-000000000815', 'store_orders.confirm', 'Convert eligible online order requests into staff sale drafts')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where (r.code in ('SUPER_ADMIN', 'OWNER') and p.code like 'store_orders.%')
   or (r.code in ('BRANCH_MANAGER', 'SALES') and p.code in ('store_orders.read', 'store_orders.update', 'store_orders.confirm'))
on conflict do nothing;

create function public.consume_store_order_request_limit(
  visitor_key text,
  request_key uuid,
  visitor_phone text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  existing_number text;
  rate_count integer;
  window_started timestamptz;
  phone_normalized text;
begin
  if visitor_key !~ '^[a-f0-9]{64}$' or request_key is null then raise exception 'Invalid request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 1));
  select request_number into existing_number from public.store_order_requests where idempotency_key = request_key;
  if found then return jsonb_build_object('limited', false, 'request_number', existing_number); end if;

  phone_normalized := regexp_replace(coalesce(visitor_phone, ''), '[^0-9]', '', 'g');
  perform pg_advisory_xact_lock(hashtextextended(phone_normalized, 2));
  insert into public.store_order_request_limits(visitor_key, window_started_at, request_count)
  values ($1, now(), 1)
  on conflict on constraint store_order_request_limits_pkey do update set
    window_started_at = case
      when public.store_order_request_limits.window_started_at <= now() - interval '5 minutes' then now()
      else public.store_order_request_limits.window_started_at
    end,
    request_count = case
      when public.store_order_request_limits.window_started_at <= now() - interval '5 minutes' then 1
      else public.store_order_request_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count, window_started_at into rate_count, window_started;
  delete from public.store_order_request_limits where updated_at < now() - interval '1 day';
  if rate_count > 3 and window_started > now() - interval '5 minutes' then
    return jsonb_build_object('limited', true);
  end if;
  if (select count(*) from public.store_order_requests r
      where regexp_replace(r.customer_phone, '[^0-9]', '', 'g') = phone_normalized
        and r.created_at > now() - interval '5 minutes') >= 3 then
    return jsonb_build_object('limited', true);
  end if;
  return jsonb_build_object('limited', false);
end;
$$;

create function public.submit_store_order_request(
  request_key uuid,
  visitor_name text,
  visitor_phone text,
  visitor_email text,
  visitor_company text,
  target_branch uuid,
  visitor_message text,
  items jsonb
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  existing public.store_order_requests%rowtype;
  next_number bigint;
  request_no text;
  request_id uuid;
  entry jsonb;
  variant uuid;
  qty numeric(14,3);
  product_label text;
  variant_label text;
  sku_label text;
  unit_label text;
  public_price boolean;
  price_value numeric(14,2);
  available_qty numeric(14,3);
  total_value numeric(14,2) := 0;
  price_complete boolean := true;
begin
  if request_key is null then raise exception 'Invalid request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(request_key::text, 1));
  select * into existing from public.store_order_requests where idempotency_key = request_key;
  if found then return jsonb_build_object('limited', false, 'request_number', existing.request_number); end if;

  if char_length(trim(visitor_name)) not between 2 and 160
    or char_length(trim(visitor_phone)) not between 5 and 40
    or (visitor_email is not null and visitor_email <> '' and visitor_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    or (visitor_company is not null and char_length(visitor_company) > 160)
    or (visitor_message is not null and char_length(visitor_message) > 2000) then
    raise exception 'Check the order request details';
  end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) not between 1 and 20 then
    raise exception 'Choose between 1 and 20 products';
  end if;
  if exists (
    select 1 from (select value->>'variant_id' from jsonb_array_elements(items) group by 1 having count(*) > 1) duplicate_variants
  ) then raise exception 'Remove duplicate product options'; end if;

  if not exists(select 1 from public.branches b where b.id = target_branch and b.is_active and b.is_public) then
    raise exception 'Choose an available branch';
  end if;

  insert into public.store_order_request_sequences(year, last_number)
  values (extract(year from now())::integer, 1)
  on conflict (year) do update set last_number = public.store_order_request_sequences.last_number + 1
  returning last_number into next_number;
  request_no := 'WEB-' || extract(year from now())::integer || '-' || lpad(next_number::text, 6, '0');

  insert into public.store_order_requests(
    request_number, idempotency_key, branch_id, customer_name, customer_phone,
    customer_email, customer_company, customer_message, estimated_total
  ) values (
    request_no, request_key, target_branch, trim(visitor_name), trim(visitor_phone),
    nullif(lower(trim(visitor_email)), ''), nullif(trim(visitor_company), ''),
    nullif(trim(visitor_message), ''), null
  ) returning id into request_id;

  for entry in select value from jsonb_array_elements(items) loop
    if coalesce(entry->>'variant_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(entry->>'quantity', '') !~ '^[0-9]+(\.[0-9]{1,3})?$' then
      raise exception 'Check the product quantities';
    end if;
    variant := (entry->>'variant_id')::uuid;
    qty := (entry->>'quantity')::numeric;
    perform public.validate_inventory_quantity(variant, qty, false);

    select p.name, v.name, v.sku, u.symbol, p.show_price_online
      into product_label, variant_label, sku_label, unit_label, public_price
      from public.product_variants v
      join public.products p on p.id = v.product_id
      join public.units_of_measure u on u.id = p.unit_of_measure_id
      join public.categories c on c.id = p.category_id and c.is_active
      where v.id = variant and v.is_active and p.status = 'ACTIVE' and p.is_public;
    if not found then raise exception 'A product in the basket is no longer available'; end if;

    select greatest(bi.quantity_on_hand - bi.minimum_stock_level, 0)
      into available_qty
      from public.branch_inventory bi
      where bi.branch_id = target_branch and bi.variant_id = variant;
    if coalesce(available_qty, 0) < qty then
      raise exception 'An item may no longer be available at the selected branch';
    end if;

    price_value := null;
    if public_price then
      select pp.amount into price_value
        from public.product_prices pp
        where pp.variant_id = variant and pp.price_type = 'RETAIL'
          and (pp.branch_id = target_branch or pp.branch_id is null)
          and pp.effective_from <= now() and (pp.effective_to is null or pp.effective_to > now())
        order by (pp.branch_id is not null) desc, pp.effective_from desc
        limit 1;
    end if;
    if price_value is null then price_complete := false;
    else total_value := total_value + round(price_value * qty, 2); end if;

    insert into public.store_order_request_items(
      request_id, variant_id, product_name_snapshot, variant_name_snapshot,
      sku_snapshot, unit_snapshot, quantity, estimated_unit_price
    ) values (
      request_id, variant, product_label, variant_label, sku_label, unit_label, qty, price_value
    );
  end loop;

  if price_complete then
    update public.store_order_requests set estimated_total = total_value where id = request_id;
  end if;
  return jsonb_build_object('limited', false, 'request_number', request_no);
end;
$$;

create function public.update_store_order_request_status(
  target_request uuid,
  new_status public.store_order_request_status
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare request_row public.store_order_requests%rowtype;
begin
  select * into request_row from public.store_order_requests where id = target_request for update;
  if not found or not public.has_permission('store_orders.update')
    or not public.can_access_branch(request_row.branch_id) then
    raise exception 'Order request unavailable';
  end if;
  if request_row.status not in ('PENDING_CONFIRMATION', 'CONTACTED')
    or new_status not in ('CONTACTED', 'DECLINED', 'CANCELLED') then
    raise exception 'This order request can no longer be updated';
  end if;
  if new_status = request_row.status then return; end if;
  update public.store_order_requests set status = new_status, status_changed_by = auth.uid(), status_changed_at = now()
    where id = target_request;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, old_values, new_values)
    values (auth.uid(), request_row.branch_id, 'store_order_request.status_changed', 'store_order_requests', target_request,
      jsonb_build_object('status', request_row.status), jsonb_build_object('status', new_status));
end;
$$;

create function public.accept_store_order_request(target_request uuid) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  request_row public.store_order_requests%rowtype;
  customer_id uuid;
  sale_id uuid;
  order_items jsonb;
begin
  select * into request_row from public.store_order_requests where id = target_request for update;
  if not found or not public.has_permission('store_orders.confirm')
    or not public.can_access_branch(request_row.branch_id)
    or not public.has_permission('customers.create')
    or not public.has_permission('sales.create') then
    raise exception 'Order request unavailable';
  end if;
  if request_row.status in ('DRAFT_CREATED', 'SALE_COMPLETED') and request_row.linked_sale_id is not null then
    return request_row.linked_sale_id;
  end if;
  if request_row.status not in ('PENDING_CONFIRMATION', 'CONTACTED') then
    raise exception 'This order request can no longer be accepted';
  end if;
  select jsonb_agg(jsonb_build_object('variant_id', i.variant_id, 'quantity', i.quantity, 'price_type', 'RETAIL'))
    into order_items from public.store_order_request_items i where i.request_id = target_request;
  if coalesce(jsonb_array_length(order_items), 0) = 0 then raise exception 'Order request has no items'; end if;

  customer_id := public.create_customer(
    request_row.customer_name,
    case when request_row.customer_company is null then 'INDIVIDUAL'::public.customer_type
      else 'CONSTRUCTION_COMPANY'::public.customer_type end,
    request_row.customer_company,
    request_row.customer_phone,
    request_row.customer_email,
    null,
    'Created from online order request ' || request_row.request_number
  );
  sale_id := public.create_sale(
    request_row.branch_id, customer_id, null,
    'Online order request ' || request_row.request_number || '. ' || coalesce(request_row.customer_message, ''),
    0, null, order_items
  );
  update public.store_order_requests set status = 'DRAFT_CREATED', linked_sale_id = sale_id,
    status_changed_by = auth.uid(), status_changed_at = now()
    where id = target_request;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, new_values, metadata)
    values (auth.uid(), request_row.branch_id, 'store_order_request.sale_draft_created', 'store_order_requests', target_request,
      jsonb_build_object('status', request_row.status), jsonb_build_object('status', 'DRAFT_CREATED', 'sale_id', sale_id, 'sale_number',
        (select sale_number from public.sales where id = sale_id)));
  return sale_id;
end;
$$;

create function public.sync_store_order_request_sale_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'COMPLETED' and old.status is distinct from new.status then
    update public.store_order_requests set status = 'SALE_COMPLETED',
      status_changed_by = new.completed_by, status_changed_at = now()
      where linked_sale_id = new.id and status = 'DRAFT_CREATED';
  elsif new.status = 'CANCELLED' and old.status is distinct from new.status then
    update public.store_order_requests set status = 'CANCELLED',
      status_changed_by = new.cancelled_by, status_changed_at = now()
      where linked_sale_id = new.id and status in ('DRAFT_CREATED', 'SALE_COMPLETED');
  end if;
  return new;
end;
$$;
create trigger sync_store_order_request_sale_status
  after update of status on public.sales
  for each row execute function public.sync_store_order_request_sale_status();

revoke all on function public.submit_store_order_request(uuid, text, text, text, text, uuid, text, jsonb),
  public.consume_store_order_request_limit(text, uuid, text),
  public.update_store_order_request_status(uuid, public.store_order_request_status),
  public.accept_store_order_request(uuid),
  public.sync_store_order_request_sale_status() from public, anon, authenticated;
grant execute on function public.consume_store_order_request_limit(text, uuid, text),
  public.submit_store_order_request(uuid, text, text, text, text, uuid, text, jsonb)
  to service_role;
grant execute on function public.update_store_order_request_status(uuid, public.store_order_request_status),
  public.accept_store_order_request(uuid) to authenticated;
