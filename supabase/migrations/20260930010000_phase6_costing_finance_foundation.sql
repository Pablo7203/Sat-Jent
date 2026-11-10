-- Phase 6 foundation: explicit branch/variant inventory cost basis, immutable
-- cost events, and controlled baseline initialization. Historical data is never
-- assigned an invented cost; it stays incomplete until an authorized user
-- explicitly establishes a baseline.

create type public.inventory_cost_status as enum ('MISSING', 'COMPLETE');

create table public.branch_inventory_costs (
  branch_id uuid not null references public.branches(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity_on_hand numeric(14,3) not null default 0 check (quantity_on_hand >= 0),
  inventory_value numeric(18,4) not null default 0 check (inventory_value >= 0),
  weighted_average_cost numeric(18,6),
  cost_status public.inventory_cost_status not null default 'MISSING',
  initialized_at timestamptz,
  initialized_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (branch_id, variant_id),
  check ((cost_status = 'COMPLETE' and weighted_average_cost is not null)
      or (cost_status = 'MISSING' and weighted_average_cost is null)),
  check (weighted_average_cost is null or weighted_average_cost >= 0)
);

create table public.inventory_cost_events (
  id uuid primary key default gen_random_uuid(),
  stock_movement_id uuid not null unique references public.stock_movements(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity_delta numeric(14,3) not null,
  unit_cost numeric(18,6),
  value_delta numeric(18,4),
  cost_status public.inventory_cost_status not null,
  source text not null check (source in ('RECEIPT', 'WAC_ISSUE', 'TRANSFER', 'BASELINE', 'UNKNOWN')),
  created_at timestamptz not null default now(),
  check ((cost_status = 'COMPLETE' and unit_cost is not null and value_delta is not null)
      or cost_status = 'MISSING')
);

alter table public.sale_items
  add column cost_unit_snapshot numeric(18,6),
  add column cost_total_snapshot numeric(18,4),
  add column cost_status public.inventory_cost_status not null default 'MISSING',
  add constraint sale_items_cost_snapshot_check check (
    (cost_status = 'COMPLETE' and cost_unit_snapshot is not null and cost_total_snapshot is not null)
    or (cost_status = 'MISSING' and cost_unit_snapshot is null and cost_total_snapshot is null)
  );

alter table public.daily_sales_batch_items
  add column cost_unit_snapshot numeric(18,6),
  add column cost_total_snapshot numeric(18,4),
  add column cost_status public.inventory_cost_status not null default 'MISSING',
  add constraint daily_sales_items_cost_snapshot_check check (
    (cost_status = 'COMPLETE' and cost_unit_snapshot is not null and cost_total_snapshot is not null)
    or (cost_status = 'MISSING' and cost_unit_snapshot is null and cost_total_snapshot is null)
  );

-- Perpetual weighted-average costing is performed inside each existing stock
-- mutation transaction. Receipts are costed from actual GRN line data below.
create function public.apply_inventory_movement_cost(
  target_movement uuid, target_unit_cost numeric, target_source text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  m public.stock_movements%rowtype;
  c public.branch_inventory_costs%rowtype;
  next_value numeric(18,4);
  next_wac numeric(18,6);
  resolved_cost numeric(18,6) := target_unit_cost;
  resolved_source text := target_source;
begin
  select * into m from public.stock_movements where id = target_movement;
  if not found then raise exception 'Stock movement not found while applying cost'; end if;
  insert into public.branch_inventory_costs(branch_id, variant_id, quantity_on_hand)
    values(m.branch_id, m.variant_id, m.balance_before) on conflict (branch_id, variant_id) do nothing;
  select * into c from public.branch_inventory_costs
    where branch_id = m.branch_id and variant_id = m.variant_id for update;
  if resolved_cost is null and c.cost_status = 'COMPLETE' then
    resolved_cost := c.weighted_average_cost;
    resolved_source := 'WAC_ISSUE';
  end if;
  if resolved_cost is null then
    update public.branch_inventory_costs set quantity_on_hand = m.balance_after,
      inventory_value = 0, weighted_average_cost = null, cost_status = 'MISSING', updated_at = now()
    where branch_id = m.branch_id and variant_id = m.variant_id;
    insert into public.inventory_cost_events(stock_movement_id, branch_id, variant_id, quantity_delta,
      cost_status, source)
    values(m.id, m.branch_id, m.variant_id, m.quantity_delta, 'MISSING', 'UNKNOWN');
    return;
  end if;
  -- A known receipt/reversal cannot make an already-uncosted balance whole.
  -- Preserve the known unit on this event, but keep the aggregate unvalued.
  if c.cost_status = 'MISSING' and m.balance_before > 0 then
    update public.branch_inventory_costs set quantity_on_hand = m.balance_after,
      inventory_value = 0, weighted_average_cost = null, cost_status = 'MISSING', updated_at = now()
    where branch_id = m.branch_id and variant_id = m.variant_id;
    insert into public.inventory_cost_events(stock_movement_id, branch_id, variant_id, quantity_delta,
      unit_cost, value_delta, cost_status, source)
    values(m.id, m.branch_id, m.variant_id, m.quantity_delta, resolved_cost,
      round(m.quantity_delta * resolved_cost, 4), 'MISSING', resolved_source);
    return;
  end if;
  if m.quantity_delta > 0 then
    next_value := c.inventory_value + round(m.quantity_delta * resolved_cost, 4);
  else
    next_value := greatest(0, c.inventory_value + round(m.quantity_delta * resolved_cost, 4));
  end if;
  next_wac := case when m.balance_after = 0 then c.weighted_average_cost
    else round(next_value / m.balance_after, 6) end;
  if m.quantity_delta < 0 then next_wac := c.weighted_average_cost; end if;
  update public.branch_inventory_costs set quantity_on_hand = m.balance_after,
    inventory_value = next_value, weighted_average_cost = next_wac,
    cost_status = 'COMPLETE', updated_at = now()
  where branch_id = m.branch_id and variant_id = m.variant_id;
  insert into public.inventory_cost_events(stock_movement_id, branch_id, variant_id, quantity_delta,
    unit_cost, value_delta, cost_status, source)
  values(m.id, m.branch_id, m.variant_id, m.quantity_delta, resolved_cost,
    round(m.quantity_delta * resolved_cost, 4), 'COMPLETE', resolved_source);
end;
$$;

create function public.record_inventory_movement_cost() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  unit_cost numeric(18,6);
  reference_item uuid;
begin
  if new.movement_type = 'PURCHASE_RECEIPT' then return new; end if;
  if new.movement_type = 'SALE_REVERSAL' then
    if new.reference_type = 'DAILY_SALES_BATCH' then
      begin reference_item := new.reason_code::uuid; exception when others then reference_item := null; end;
      select i.cost_unit_snapshot into unit_cost from public.daily_sales_batch_items i
        where i.id = reference_item and i.variant_id = new.variant_id;
    elsif new.reference_type = 'SALE' then
      select i.cost_unit_snapshot into unit_cost from public.sale_items i
        where i.sale_id = new.reference_id and i.variant_id = new.variant_id
          and i.cost_status = 'COMPLETE' limit 1;
    end if;
    perform public.apply_inventory_movement_cost(new.id, unit_cost, 'WAC_ISSUE');
    return new;
  end if;
  if new.movement_type = 'TRANSFER_IN' then
    begin reference_item := new.reason_code::uuid; exception when others then reference_item := null; end;
    select e.unit_cost into unit_cost from public.stock_transfer_items i
      join public.inventory_cost_events e on e.stock_movement_id = i.transfer_out_movement_id
      where i.id = reference_item and e.cost_status = 'COMPLETE';
    perform public.apply_inventory_movement_cost(new.id, unit_cost, 'TRANSFER');
    return new;
  end if;
  perform public.apply_inventory_movement_cost(new.id, null, 'WAC_ISSUE');
  return new;
end;
$$;
create trigger stock_movement_cost_after_insert after insert on public.stock_movements
  for each row execute function public.record_inventory_movement_cost();

create function public.record_receipt_inventory_cost() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.apply_inventory_movement_cost(new.stock_movement_id, new.actual_unit_cost, 'RECEIPT');
  return new;
end;
$$;
create trigger goods_receipt_cost_after_insert after insert on public.goods_receipt_items
  for each row execute function public.record_receipt_inventory_cost();

create function public.snapshot_sale_line_cost() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e public.inventory_cost_events%rowtype;
begin
  select * into e from public.inventory_cost_events where stock_movement_id = new.stock_movement_id;
  if found and e.cost_status = 'COMPLETE' then
    update public.sale_items set cost_unit_snapshot = e.unit_cost,
      cost_total_snapshot = round(new.quantity * e.unit_cost, 4), cost_status = 'COMPLETE' where id = new.id;
  else
    update public.sale_items set cost_unit_snapshot = null, cost_total_snapshot = null,
      cost_status = 'MISSING' where id = new.id;
  end if;
  return new;
end;
$$;
create trigger sale_item_cost_snapshot after update of stock_movement_id on public.sale_items
  for each row when (new.stock_movement_id is not null and old.stock_movement_id is null)
  execute function public.snapshot_sale_line_cost();

create function public.snapshot_daily_sale_line_cost() returns trigger
language plpgsql security definer set search_path = '' as $$
declare e public.inventory_cost_events%rowtype;
begin
  select * into e from public.inventory_cost_events where stock_movement_id = new.stock_movement_id;
  if found and e.cost_status = 'COMPLETE' then
    update public.daily_sales_batch_items set cost_unit_snapshot = e.unit_cost,
      cost_total_snapshot = round(new.quantity * e.unit_cost, 4), cost_status = 'COMPLETE' where id = new.id;
  else
    update public.daily_sales_batch_items set cost_unit_snapshot = null, cost_total_snapshot = null,
      cost_status = 'MISSING' where id = new.id;
  end if;
  return new;
end;
$$;
create trigger daily_sale_item_cost_snapshot after update of stock_movement_id on public.daily_sales_batch_items
  for each row when (new.stock_movement_id is not null and old.stock_movement_id is null)
  execute function public.snapshot_daily_sale_line_cost();

revoke all on function public.apply_inventory_movement_cost(uuid,numeric,text),
  public.record_inventory_movement_cost(), public.record_receipt_inventory_cost(),
  public.snapshot_sale_line_cost(), public.snapshot_daily_sale_line_cost() from public, anon, authenticated;

create index inventory_cost_events_branch_variant_time_idx
  on public.inventory_cost_events(branch_id, variant_id, created_at desc);

insert into public.branch_inventory_costs(branch_id, variant_id, quantity_on_hand, cost_status)
select branch_id, variant_id, quantity_on_hand, 'MISSING' from public.branch_inventory
on conflict (branch_id, variant_id) do nothing;

alter table public.branch_inventory_costs enable row level security;
alter table public.inventory_cost_events enable row level security;
create policy branch_inventory_costs_read on public.branch_inventory_costs
  for select to authenticated using (public.has_permission('inventory.cost.read') and public.can_access_branch(branch_id));
create policy inventory_cost_events_read on public.inventory_cost_events
  for select to authenticated using (public.has_permission('inventory.cost.read') and public.can_access_branch(branch_id));
revoke all on public.branch_inventory_costs, public.inventory_cost_events from public, anon, authenticated;
grant select on public.branch_inventory_costs, public.inventory_cost_events to authenticated;

insert into public.permissions(id, code, description) values
  ('20000000-0000-4000-8000-000000000801', 'inventory.cost.read', 'Read inventory cost and valuation for accessible branches'),
  ('20000000-0000-4000-8000-000000000802', 'inventory.cost.initialize', 'Initialize a documented opening cost basis'),
  ('20000000-0000-4000-8000-000000000803', 'reports.profitability.read', 'Read cost-based sales profitability and gross margin')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where (r.code in ('SUPER_ADMIN', 'OWNER') and p.code in ('inventory.cost.read', 'inventory.cost.initialize', 'reports.profitability.read'))
   or (r.code = 'BRANCH_MANAGER' and p.code = 'inventory.cost.read')
on conflict do nothing;

-- Establish a documented opening baseline for unvalued stock. Historical
-- sale snapshots remain incomplete and are never rewritten.
create function public.initialize_inventory_cost(
  target_branch uuid, target_variant uuid, unit_cost numeric, effective_note text
) returns void language plpgsql security definer set search_path = '' as $$
declare current_qty numeric(14,3);
begin
  if auth.uid() is null or not public.has_permission('inventory.cost.initialize')
    or not public.can_access_branch(target_branch) then
    raise exception 'You do not have permission to initialize this inventory cost';
  end if;
  if unit_cost is null or unit_cost < 0 or unit_cost <> round(unit_cost, 2) then
    raise exception 'Enter a non-negative unit cost with no more than two decimal places';
  end if;
  if char_length(trim(coalesce(effective_note, ''))) < 5 then
    raise exception 'Describe the source of this opening cost';
  end if;
  insert into public.branch_inventory(branch_id, variant_id) values (target_branch, target_variant)
    on conflict (branch_id, variant_id) do nothing;
  select quantity_on_hand into current_qty from public.branch_inventory
    where branch_id = target_branch and variant_id = target_variant for update;
  insert into public.branch_inventory_costs(branch_id, variant_id, quantity_on_hand,
    inventory_value, weighted_average_cost, cost_status, initialized_at, initialized_by)
  values (target_branch, target_variant, current_qty, round(current_qty * unit_cost, 4), unit_cost,
    'COMPLETE', now(), auth.uid())
  on conflict (branch_id, variant_id) do update set quantity_on_hand = excluded.quantity_on_hand,
    inventory_value = excluded.inventory_value, weighted_average_cost = excluded.weighted_average_cost,
    cost_status = 'COMPLETE', initialized_at = now(), initialized_by = auth.uid(), updated_at = now()
  where public.branch_inventory_costs.initialized_at is null
    and public.branch_inventory_costs.cost_status = 'MISSING';
  if not found then raise exception 'An inventory cost baseline already exists'; end if;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, metadata)
  values (auth.uid(), target_branch, 'inventory.cost_baseline_initialized', 'branch_inventory_costs',
    jsonb_build_object('variant_id', target_variant, 'quantity', current_qty, 'unit_cost', unit_cost,
      'inventory_value', round(current_qty * unit_cost, 4), 'source_note', trim(effective_note)));
end;
$$;
revoke all on function public.initialize_inventory_cost(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.initialize_inventory_cost(uuid, uuid, numeric, text) to authenticated;

create view public.inventory_valuation_summary with (security_invoker = true) as
select c.branch_id, c.variant_id, c.quantity_on_hand, c.inventory_value,
  c.weighted_average_cost, c.cost_status,
  case when c.cost_status = 'COMPLETE' then c.inventory_value else null end as reportable_inventory_value
from public.branch_inventory_costs c;
revoke all on public.inventory_valuation_summary from public, anon, authenticated;
grant select on public.inventory_valuation_summary to authenticated;

comment on table public.branch_inventory_costs is 'Branch and variant perpetual weighted-average-cost state; missing historical cost remains explicitly incomplete.';
comment on table public.inventory_cost_events is 'Immutable per-stock-movement cost and valuation snapshots.';

-- Governed expenses and real financial-account movements. This first slice
-- keeps expense approval and disbursement separate: approval alone never
-- changes a cash/bank balance.
create type public.expense_status as enum ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'REJECTED', 'VOID');
create type public.financial_movement_kind as enum ('CUSTOMER_COLLECTION', 'SUPPLIER_PAYMENT', 'EXPENSE_PAYMENT', 'OPENING_BALANCE', 'ADJUSTMENT');
create type public.financial_direction as enum ('IN', 'OUT');

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null check (char_length(trim(name)) between 2 and 100),
  requires_approval boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null check (char_length(trim(name)) between 2 and 100),
  account_type text not null check (account_type in ('CASH', 'MOBILE_MONEY', 'BANK', 'CARD_CLEARING', 'OTHER')),
  currency_code text not null default 'GHS' check (currency_code = 'GHS'),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.financial_account_branches (
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  primary key (account_id, branch_id)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_number text not null unique,
  branch_id uuid not null references public.branches(id) on delete restrict,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  description text not null check (char_length(trim(description)) between 3 and 1000),
  expense_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0 and amount_paid <= amount),
  status public.expense_status not null default 'DRAFT',
  payee text,
  receipt_object_path text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('APPROVED', 'PARTIALLY_PAID', 'PAID') and approved_by is not null and approved_at is not null)
      or status not in ('APPROVED', 'PARTIALLY_PAID', 'PAID')),
  check ((status = 'PAID' and amount_paid = amount) or status <> 'PAID')
);
create table public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  operation_key uuid not null unique,
  amount numeric(14,2) not null check (amount > 0),
  payment_date date not null,
  payment_reference text,
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  operation_key uuid not null unique,
  movement_kind public.financial_movement_kind not null,
  direction public.financial_direction not null,
  amount numeric(14,2) not null check (amount > 0),
  reference_type text not null,
  reference_id uuid not null,
  effective_date date not null,
  memo text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table public.expense_number_sequences (year integer primary key, last_number bigint not null default 0 check (last_number >= 0));

create index expenses_branch_date_idx on public.expenses(branch_id, expense_date desc, created_at desc);
create index expenses_status_idx on public.expenses(status, expense_date desc);
create index financial_movements_account_date_idx on public.financial_movements(account_id, effective_date desc, created_at desc);
create index financial_movements_branch_date_idx on public.financial_movements(branch_id, effective_date desc);
create trigger expenses_updated_at before update on public.expenses for each row execute function public.set_updated_at();

alter table public.expense_categories enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.financial_account_branches enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_payments enable row level security;
alter table public.financial_movements enable row level security;
alter table public.expense_number_sequences enable row level security;
create policy expense_categories_read on public.expense_categories for select to authenticated using (public.has_permission('expenses.read'));
create policy financial_accounts_read on public.financial_accounts for select to authenticated using (
  public.has_permission('finance.accounts.read') and exists (
    select 1 from public.financial_account_branches ab where ab.account_id = id and public.can_access_branch(ab.branch_id)
  ));
create policy financial_account_branches_read on public.financial_account_branches for select to authenticated
  using (public.has_permission('finance.accounts.read') and public.can_access_branch(branch_id));
create policy expenses_read on public.expenses for select to authenticated
  using (public.has_permission('expenses.read') and public.can_access_branch(branch_id));
create policy expense_payments_read on public.expense_payments for select to authenticated
  using (public.has_permission('expenses.read') and public.can_access_branch(branch_id));
create policy financial_movements_read on public.financial_movements for select to authenticated
  using (public.has_permission('finance.ledger.read') and public.can_access_branch(branch_id));
revoke all on public.expense_categories, public.financial_accounts, public.financial_account_branches,
  public.expenses, public.expense_payments, public.financial_movements, public.expense_number_sequences
  from public, anon, authenticated;
grant select on public.expense_categories, public.financial_accounts, public.financial_account_branches,
  public.expenses, public.expense_payments, public.financial_movements to authenticated;

insert into public.permissions(id, code, description) values
  ('20000000-0000-4000-8000-000000000804', 'expenses.read', 'Read branch expenses and supporting payment metadata'),
  ('20000000-0000-4000-8000-000000000805', 'expenses.create', 'Create and submit branch expenses'),
  ('20000000-0000-4000-8000-000000000806', 'expenses.approve', 'Approve branch expenses'),
  ('20000000-0000-4000-8000-000000000807', 'expenses.pay', 'Disburse approved branch expenses'),
  ('20000000-0000-4000-8000-000000000808', 'finance.accounts.read', 'Read financial accounts available to accessible branches'),
  ('20000000-0000-4000-8000-000000000809', 'finance.accounts.manage', 'Manage financial accounts and branch assignments'),
  ('20000000-0000-4000-8000-000000000810', 'finance.ledger.read', 'Read immutable financial-account movements')
on conflict (code) do update set description = excluded.description;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where (r.code in ('SUPER_ADMIN', 'OWNER') and p.code in ('expenses.read','expenses.create','expenses.approve','expenses.pay','finance.accounts.read','finance.accounts.manage','finance.ledger.read'))
   or (r.code = 'BRANCH_MANAGER' and p.code in ('expenses.read','expenses.create','finance.accounts.read'))
on conflict do nothing;

insert into public.expense_categories(id, code, name, requires_approval) values
  ('61000000-0000-4000-8000-000000000001', 'TRANSPORT', 'Transport and delivery', true),
  ('61000000-0000-4000-8000-000000000002', 'UTILITIES', 'Utilities', true),
  ('61000000-0000-4000-8000-000000000003', 'REPAIRS', 'Repairs and maintenance', true),
  ('61000000-0000-4000-8000-000000000004', 'OFFICE', 'Office and administration', true),
  ('61000000-0000-4000-8000-000000000005', 'OTHER', 'Other operating expense', true)
on conflict (code) do nothing;

create function public.create_financial_account(
  account_code text, account_name text, account_kind text, target_branches uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; branch_id uuid;
begin
  if not public.has_permission('finance.accounts.manage') then raise exception 'You do not have permission to manage financial accounts'; end if;
  if account_code is null or account_code !~ '^[A-Z0-9_-]{2,20}$' then raise exception 'Enter a valid account code'; end if;
  if char_length(trim(coalesce(account_name, ''))) not between 2 and 100 then raise exception 'Enter an account name'; end if;
  if account_kind not in ('CASH', 'MOBILE_MONEY', 'BANK', 'CARD_CLEARING', 'OTHER') then raise exception 'Choose a valid account type'; end if;
  if coalesce(cardinality(target_branches), 0) = 0 then raise exception 'Assign the account to at least one branch'; end if;
  if exists(select 1 from unnest(target_branches) b where not public.can_access_branch(b)) then raise exception 'You cannot assign an account to an inaccessible branch'; end if;
  insert into public.financial_accounts(code, name, account_type, created_by)
    values(account_code, trim(account_name), account_kind, auth.uid()) returning id into new_id;
  foreach branch_id in array target_branches loop
    insert into public.financial_account_branches(account_id, branch_id) values(new_id, branch_id);
  end loop;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'finance.account_created', 'financial_accounts', new_id,
    jsonb_build_object('code', account_code, 'name', trim(account_name), 'type', account_kind, 'branches', target_branches));
  return new_id;
end;
$$;
revoke all on function public.create_financial_account(text,text,text,uuid[]) from public, anon;
grant execute on function public.create_financial_account(text,text,text,uuid[]) to authenticated;

create function public.next_expense_number(target_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare y integer := extract(year from target_date)::integer; n bigint;
begin
  insert into public.expense_number_sequences(year, last_number) values (y, 1)
  on conflict (year) do update set last_number = public.expense_number_sequences.last_number + 1
  returning last_number into n;
  return 'EXP-' || y::text || '-' || lpad(n::text, 6, '0');
end;
$$;

create function public.create_expense(
  target_branch uuid, target_category uuid, expense_description text, expense_on date,
  expense_amount numeric, expense_payee text default null, receipt_path text default null, expense_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; expense_no text; business_today date := (now() at time zone 'Africa/Accra')::date;
begin
  if not public.has_permission('expenses.create') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to create expenses for this branch'; end if;
  if expense_on is null or expense_on > business_today then raise exception 'Future-dated expenses are not permitted'; end if;
  perform public.assert_transaction_date(expense_on);
  if expense_amount is null or expense_amount <= 0 or expense_amount <> round(expense_amount, 2) then raise exception 'Enter a valid expense amount'; end if;
  if char_length(trim(coalesce(expense_description, ''))) < 3 then raise exception 'Describe the expense'; end if;
  if not exists(select 1 from public.expense_categories where id = target_category and is_active) then raise exception 'Choose an active expense category'; end if;
  expense_no := public.next_expense_number(expense_on);
  insert into public.expenses(expense_number, branch_id, category_id, description, expense_date, amount,
    status, payee, receipt_object_path, notes, created_by)
  values(expense_no, target_branch, target_category, trim(expense_description), expense_on, expense_amount,
    'PENDING_APPROVAL', nullif(trim(expense_payee), ''), nullif(trim(receipt_path), ''), nullif(trim(expense_notes), ''), auth.uid())
  returning id into new_id;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), target_branch, 'expense.submitted', 'expenses', new_id,
    jsonb_build_object('expense_number', expense_no, 'amount', expense_amount, 'category_id', target_category));
  return new_id;
end;
$$;

create function public.decide_expense(target_expense uuid, approve boolean, decision_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.expenses%rowtype;
begin
  select * into e from public.expenses where id = target_expense for update;
  if not found then raise exception 'Expense not found'; end if;
  if not public.has_permission('expenses.approve') or not public.can_access_branch(e.branch_id) then raise exception 'You do not have permission to approve this expense'; end if;
  if e.status <> 'PENDING_APPROVAL' then raise exception 'Only pending expenses can be decided'; end if;
  if not approve and char_length(trim(coalesce(decision_note, ''))) < 3 then raise exception 'A rejection reason is required'; end if;
  update public.expenses set status = case when approve then 'APPROVED'::public.expense_status else 'REJECTED'::public.expense_status end,
    approved_by = case when approve then auth.uid() else null end, approved_at = case when approve then now() else null end
  where id = e.id;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), e.branch_id, case when approve then 'expense.approved' else 'expense.rejected' end, 'expenses', e.id,
    jsonb_build_object('expense_number', e.expense_number, 'amount', e.amount, 'reason', nullif(trim(decision_note), '')));
end;
$$;

create function public.pay_expense(target_expense uuid, target_account uuid, operation_id uuid,
  payment_amount numeric, payment_on date, reference text default null, payment_notes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare e public.expenses%rowtype; payment_id uuid; remaining numeric(14,2); business_today date := (now() at time zone 'Africa/Accra')::date;
begin
  if operation_id is null then raise exception 'A payment operation identifier is required'; end if;
  select id into payment_id from public.expense_payments where operation_key = operation_id;
  if found then return payment_id; end if;
  select * into e from public.expenses where id = target_expense for update;
  if not found then raise exception 'Expense not found'; end if;
  if not public.has_permission('expenses.pay') or not public.can_access_branch(e.branch_id) then raise exception 'You do not have permission to pay this expense'; end if;
  if e.status not in ('APPROVED', 'PARTIALLY_PAID') then raise exception 'Only approved expenses can be paid'; end if;
  if payment_on is null or payment_on > business_today then raise exception 'Future-dated payments are not permitted'; end if;
  perform public.assert_transaction_date(payment_on);
  if payment_amount is null or payment_amount <= 0 or payment_amount <> round(payment_amount, 2) then raise exception 'Enter a valid payment amount'; end if;
  remaining := e.amount - e.amount_paid;
  if payment_amount > remaining then raise exception 'Payment exceeds the remaining expense balance'; end if;
  if not exists(select 1 from public.financial_account_branches ab join public.financial_accounts a on a.id = ab.account_id
    where ab.account_id = target_account and ab.branch_id = e.branch_id and a.is_active) then raise exception 'Choose an active account assigned to this branch'; end if;
  insert into public.expense_payments(expense_id, branch_id, account_id, operation_key, amount, payment_date,
    payment_reference, notes, recorded_by)
  values(e.id, e.branch_id, target_account, operation_id, payment_amount, payment_on,
    nullif(trim(reference), ''), nullif(trim(payment_notes), ''), auth.uid()) returning id into payment_id;
  insert into public.financial_movements(account_id, branch_id, operation_key, movement_kind, direction,
    amount, reference_type, reference_id, effective_date, memo, recorded_by)
  values(target_account, e.branch_id, operation_id, 'EXPENSE_PAYMENT', 'OUT', payment_amount,
    'EXPENSE_PAYMENT', payment_id, payment_on, e.expense_number, auth.uid());
  update public.expenses set amount_paid = amount_paid + payment_amount,
    status = case when amount_paid + payment_amount = amount then 'PAID'::public.expense_status else 'PARTIALLY_PAID'::public.expense_status end
  where id = e.id;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), e.branch_id, 'expense.paid', 'expenses', e.id,
    jsonb_build_object('expense_number', e.expense_number, 'payment_id', payment_id, 'account_id', target_account, 'amount', payment_amount));
  return payment_id;
end;
$$;

revoke all on function public.next_expense_number(date), public.create_expense(uuid,uuid,text,date,numeric,text,text,text),
  public.decide_expense(uuid,boolean,text), public.pay_expense(uuid,uuid,uuid,numeric,date,text,text) from public, anon;
grant execute on function public.create_expense(uuid,uuid,text,date,numeric,text,text,text),
  public.decide_expense(uuid,boolean,text), public.pay_expense(uuid,uuid,uuid,numeric,date,text,text) to authenticated;

create view public.sales_profitability_events with (security_invoker = true) as
select s.branch_id, s.sale_date::date as business_date, 'SALE'::text as source_type,
  s.id as source_id, i.id as line_id, i.variant_id, i.product_name_snapshot, i.variant_name_snapshot,
  i.quantity, i.line_total as revenue, i.cost_total_snapshot as cost_of_goods_sold,
  case when i.cost_status = 'COMPLETE' then i.line_total - i.cost_total_snapshot else null end as gross_profit,
  i.cost_status
from public.sales s join public.sale_items i on i.sale_id = s.id
where s.status = 'COMPLETED'
union all
select b.branch_id, b.sales_date as business_date, 'DAILY_SALES_BATCH'::text as source_type,
  b.id as source_id, i.id as line_id, i.variant_id, i.product_name_snapshot, i.variant_name_snapshot,
  i.quantity, i.line_total as revenue, i.cost_total_snapshot as cost_of_goods_sold,
  case when i.cost_status = 'COMPLETE' then i.line_total - i.cost_total_snapshot else null end as gross_profit,
  i.cost_status
from public.daily_sales_batches b join public.daily_sales_batch_items i on i.batch_id = b.id
where b.status = 'POSTED';
revoke all on public.sales_profitability_events from public, anon, authenticated;
grant select on public.sales_profitability_events to authenticated;

-- Receipts are private. Paths are constrained to the owning branch and expense
-- creator for uploads; read access is granted only through expense read scope.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];
create policy expense_receipts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'expense-receipts' and public.has_permission('expenses.create')
    and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_access_branch(split_part(name, '/', 1)::uuid));
create policy expense_receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'expense-receipts' and public.has_permission('expenses.read')
    and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_access_branch(split_part(name, '/', 1)::uuid));
create policy expense_receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'expense-receipts' and public.has_permission('expenses.create')
    and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.can_access_branch(split_part(name, '/', 1)::uuid));
