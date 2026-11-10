-- SAT-J Owner-Focused Phase 4: aggregate end-of-day sales without inventing
-- customers, receipts, collections, or receivables.

insert into public.permissions(id, code, description) values
  ('20000000-0000-4000-8000-000000000704', 'daily_sales.read', 'Read daily sales batches in authorized branches'),
  ('20000000-0000-4000-8000-000000000705', 'daily_sales.create', 'Create daily sales batches in authorized branches'),
  ('20000000-0000-4000-8000-000000000706', 'daily_sales.update_draft', 'Update daily sales drafts in authorized branches'),
  ('20000000-0000-4000-8000-000000000707', 'daily_sales.post', 'Post daily sales batches and deduct branch stock'),
  ('20000000-0000-4000-8000-000000000708', 'daily_sales.reverse', 'Reverse posted daily sales batches'),
  ('20000000-0000-4000-8000-000000000709', 'daily_sales.company.read', 'Read daily sales across all branches')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where (r.code in ('SUPER_ADMIN', 'OWNER') and p.code in (
    'daily_sales.read', 'daily_sales.create', 'daily_sales.update_draft',
    'daily_sales.post', 'daily_sales.reverse', 'daily_sales.company.read'
  ))
  or (r.code = 'BRANCH_MANAGER' and p.code in (
    'daily_sales.read', 'daily_sales.create', 'daily_sales.update_draft', 'daily_sales.post'
  ))
on conflict do nothing;

create table public.daily_sales_number_sequences (
  year integer primary key,
  last_number bigint not null default 0 check (last_number >= 0)
);

create table public.daily_sales_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null unique,
  branch_id uuid not null references public.branches(id) on delete restrict,
  sales_date date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'POSTED', 'REVERSED')),
  entry_kind text not null default 'STANDARD' check (entry_kind in ('STANDARD', 'ADDITIONAL', 'CORRECTION')),
  entry_reason text check (entry_reason is null or char_length(trim(entry_reason)) between 3 and 500),
  correction_of_batch_id uuid references public.daily_sales_batches(id) on delete restrict,
  replacement_batch_id uuid unique references public.daily_sales_batches(id) on delete restrict,
  notes text check (notes is null or char_length(notes) <= 2000),
  total_revenue numeric(14,2) not null default 0 check (total_revenue >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  posted_by uuid references auth.users(id) on delete restrict,
  posted_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversal_reason text check (reversal_reason is null or char_length(trim(reversal_reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'DRAFT' and posted_by is null and posted_at is null and reversed_by is null and reversed_at is null and reversal_reason is null)
    or (status = 'POSTED' and posted_by is not null and posted_at is not null and reversed_by is null and reversed_at is null and reversal_reason is null)
    or (status = 'REVERSED' and posted_by is not null and posted_at is not null and reversed_by is not null and reversed_at is not null and char_length(trim(reversal_reason)) >= 3)
  ),
  check ((entry_kind = 'CORRECTION') = (correction_of_batch_id is not null)),
  check ((entry_kind = 'ADDITIONAL') = (entry_reason is not null) or entry_kind = 'CORRECTION')
);

create table public.daily_sales_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.daily_sales_batches(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity numeric(14,3) not null check (quantity > 0),
  standard_unit_price_snapshot numeric(14,2) not null check (standard_unit_price_snapshot >= 0),
  actual_unit_selling_price numeric(14,2) not null check (actual_unit_selling_price > 0),
  line_total numeric(14,2) not null check (line_total >= 0 and line_total = round(quantity * actual_unit_selling_price, 2)),
  product_name_snapshot text not null,
  variant_name_snapshot text not null,
  item_code_snapshot text not null,
  unit_snapshot text not null,
  stock_movement_id uuid unique references public.stock_movements(id) on delete restrict,
  reversal_movement_id uuid unique references public.stock_movements(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reversal_movement_id is null or stock_movement_id is not null)
);

create index daily_sales_batches_branch_date_idx on public.daily_sales_batches(branch_id, sales_date desc, created_at desc);
create index daily_sales_batches_status_date_idx on public.daily_sales_batches(status, sales_date desc);
create index daily_sales_batches_correction_idx on public.daily_sales_batches(correction_of_batch_id) where correction_of_batch_id is not null;
create unique index daily_sales_one_standard_posted_per_day_idx
  on public.daily_sales_batches(branch_id, sales_date)
  where status = 'POSTED' and entry_kind = 'STANDARD';
create index daily_sales_batch_items_batch_idx on public.daily_sales_batch_items(batch_id, created_at);
create index daily_sales_batch_items_variant_idx on public.daily_sales_batch_items(variant_id, batch_id);
create trigger daily_sales_batches_updated_at before update on public.daily_sales_batches for each row execute function public.set_updated_at();
create trigger daily_sales_batch_items_updated_at before update on public.daily_sales_batch_items for each row execute function public.set_updated_at();

alter table public.daily_sales_batches enable row level security;
alter table public.daily_sales_batch_items enable row level security;
alter table public.daily_sales_number_sequences enable row level security;
create policy daily_sales_batches_read on public.daily_sales_batches for select to authenticated
  using (public.has_permission('daily_sales.read') and public.can_access_branch(branch_id));
create policy daily_sales_items_read on public.daily_sales_batch_items for select to authenticated
  using (public.has_permission('daily_sales.read') and exists (
    select 1 from public.daily_sales_batches b where b.id = batch_id and public.can_access_branch(b.branch_id)
  ));
grant select on public.daily_sales_batches, public.daily_sales_batch_items to authenticated;
revoke all on public.daily_sales_batches, public.daily_sales_batch_items, public.daily_sales_number_sequences from public, anon, authenticated;
grant select on public.daily_sales_batches, public.daily_sales_batch_items to authenticated;

-- Daily-batch movement rows are visible to users who can read the corresponding
-- batch, even if they do not have the broader inventory movement permission.
create policy daily_sales_stock_movements_read on public.stock_movements for select to authenticated
  using (
    reference_type = 'DAILY_SALES_BATCH'
    and public.has_permission('daily_sales.read')
    and public.can_access_branch(branch_id)
  );

alter table public.stock_movements drop constraint stock_movements_reference_type_check;
alter table public.stock_movements add constraint stock_movements_reference_type_check
  check (reference_type in ('OPENING_STOCK', 'STOCK_ADJUSTMENT', 'STOCK_COUNT', 'GOODS_RECEIPT', 'SALE', 'STOCK_TRANSFER', 'DAILY_SALES_BATCH'));

create function public.assert_daily_sales_date(target_date date)
returns date language plpgsql stable security definer set search_path = '' as $$
declare
  business_today date := (now() at time zone 'Africa/Accra')::date;
  actor_role text;
begin
  if target_date is null then raise exception 'Sales date is required'; end if;
  if target_date > business_today then raise exception 'Future transaction dates are not permitted'; end if;
  if target_date < business_today then
    select r.code into actor_role
    from public.profiles p join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active;
    if coalesce(actor_role, '') not in ('SUPER_ADMIN', 'OWNER') then
      raise exception 'Only a Super Admin or Owner may backdate transactions';
    end if;
  end if;
  return target_date;
end;
$$;

create function public.next_daily_sales_number(target_date date)
returns text language plpgsql security definer set search_path = '' as $$
declare sequence_year integer := extract(year from target_date)::integer; next_value bigint;
begin
  insert into public.daily_sales_number_sequences(year, last_number) values (sequence_year, 1)
  on conflict (year) do update set last_number = public.daily_sales_number_sequences.last_number + 1
  returning last_number into next_value;
  return 'DS-' || sequence_year::text || '-' || lpad(next_value::text, 6, '0');
end;
$$;

create function public.guard_daily_sales_item_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare parent_id uuid;
begin
  if tg_op = 'INSERT' then
    parent_id := new.batch_id;
    if exists (select 1 from public.daily_sales_batches b where b.id = parent_id and b.status = 'DRAFT') then
      return new;
    end if;
  elsif tg_op = 'DELETE' then
    parent_id := old.batch_id;
    if exists (select 1 from public.daily_sales_batches b where b.id = parent_id and b.status = 'DRAFT') then
      return old;
    end if;
  else
    parent_id := old.batch_id;
    if old.batch_id = new.batch_id and exists (
      select 1 from public.daily_sales_batches b where b.id = old.batch_id and b.status = 'DRAFT'
    ) then
      return new;
    end if;
    -- Posting/reversal may attach ledger evidence after posting, while all
    -- commercial snapshots remain immutable.
    if old.batch_id = new.batch_id
      and old.reversal_movement_id is null and new.reversal_movement_id is not null
      and (to_jsonb(new) - array['reversal_movement_id', 'updated_at']) =
          (to_jsonb(old) - array['reversal_movement_id', 'updated_at'])
      and exists (select 1 from public.daily_sales_batches b where b.id = old.batch_id and b.status = 'POSTED') then
      return new;
    end if;
  end if;
  raise exception 'Daily sales lines are immutable after posting';
end;
$$;
create trigger daily_sales_items_draft_only before insert or update or delete on public.daily_sales_batch_items
  for each row execute function public.guard_daily_sales_item_write();

create function public.save_daily_sales_draft(
  target_batch uuid,
  target_branch uuid,
  target_sales_date date,
  target_notes text,
  target_entry_kind text,
  target_entry_reason text,
  target_correction_of uuid,
  items jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  header public.daily_sales_batches%rowtype;
  saved_batch_id uuid;
  item jsonb;
  variant uuid;
  qty numeric;
  actual numeric;
  standard numeric;
  line_value numeric(14,2);
  product_label text;
  variant_label text;
  sku_label text;
  unit_label text;
  item_count integer;
  calculated_total numeric(14,2) := 0;
begin
  if target_branch is null or not public.can_access_branch(target_branch)
    or not exists (select 1 from public.branches where id = target_branch and is_active) then
    raise exception 'Choose an active branch you are authorized to use';
  end if;
  if jsonb_typeof(items) is distinct from 'array' then
    raise exception 'Daily sales must contain a valid list of no more than 500 lines';
  end if;
  if jsonb_array_length(items) > 500 then
    raise exception 'Daily sales must contain a valid list of no more than 500 lines';
  end if;
  perform public.assert_daily_sales_date(target_sales_date);
  item_count := jsonb_array_length(items);

  if target_batch is null then
    if not public.has_permission('daily_sales.create') then raise exception 'You do not have permission to create daily sales'; end if;
    if target_entry_kind not in ('STANDARD', 'ADDITIONAL', 'CORRECTION') then raise exception 'Choose a valid batch type'; end if;
    if target_entry_kind = 'ADDITIONAL' and char_length(trim(coalesce(target_entry_reason, ''))) < 3 then
      raise exception 'Explain why an additional daily batch is required';
    end if;
    if target_entry_kind = 'CORRECTION' then
      if target_correction_of is null or not exists (
        select 1 from public.daily_sales_batches original
        where original.id = target_correction_of and original.status = 'REVERSED'
          and original.branch_id = target_branch
          and original.replacement_batch_id is null
      ) then raise exception 'Choose an eligible reversed batch for this correction'; end if;
    elsif target_correction_of is not null then
      raise exception 'Correction batches must reference the reversed batch';
    end if;
    if target_entry_kind = 'STANDARD' and exists (
      select 1 from public.daily_sales_batches existing
      where existing.branch_id = target_branch and existing.sales_date = target_sales_date and existing.status = 'POSTED'
    ) then
      raise exception 'A posted batch already exists for this branch and date. Choose Additional Batch and provide a reason.';
    end if;
    insert into public.daily_sales_batches(
      batch_number, branch_id, sales_date, entry_kind, entry_reason,
      correction_of_batch_id, notes, created_by
    ) values (
      public.next_daily_sales_number(target_sales_date), target_branch, target_sales_date,
      target_entry_kind, case when target_entry_kind = 'ADDITIONAL' then trim(target_entry_reason) end,
      target_correction_of, nullif(trim(target_notes), ''), auth.uid()
    ) returning id into saved_batch_id;
  else
    if not public.has_permission('daily_sales.update_draft') then raise exception 'You do not have permission to update daily sales drafts'; end if;
    select * into header from public.daily_sales_batches where id = target_batch for update;
    if not found then raise exception 'Daily sales batch not found'; end if;
    if header.status <> 'DRAFT' then raise exception 'Only draft daily sales batches can be changed'; end if;
    if not public.can_access_branch(header.branch_id) then raise exception 'You do not have access to this batch branch'; end if;
    if header.entry_kind = 'CORRECTION' and target_branch <> header.branch_id then
      raise exception 'A correction batch must remain in the original branch';
    end if;
    if header.branch_id <> target_branch and item_count <> 0 then
      raise exception 'Changing branch requires removing and reselecting every product first';
    end if;
    if target_entry_kind <> header.entry_kind or target_correction_of is distinct from header.correction_of_batch_id then
      raise exception 'The batch type cannot be changed after the draft is created';
    end if;
    if target_branch <> header.branch_id and exists (
      select 1 from public.daily_sales_batches existing
      where existing.branch_id = target_branch and existing.sales_date = target_sales_date and existing.status = 'POSTED'
    ) and header.entry_kind = 'STANDARD' then
      raise exception 'A posted batch already exists for this branch and date. Create an additional batch instead.';
    end if;
    saved_batch_id := header.id;
    delete from public.daily_sales_batch_items existing_item where existing_item.batch_id = saved_batch_id;
    update public.daily_sales_batches set branch_id = target_branch, sales_date = target_sales_date,
      notes = nullif(trim(target_notes), ''),
      entry_reason = case when target_entry_kind = 'ADDITIONAL' then nullif(trim(target_entry_reason), '') end,
      total_revenue = 0 where id = saved_batch_id;
  end if;

  for item in select value from jsonb_array_elements(items) loop
    variant := nullif(item->>'variant_id', '')::uuid;
    qty := nullif(item->>'quantity', '')::numeric;
    if variant is null then raise exception 'Choose a product variant for every line'; end if;
    perform public.validate_inventory_quantity(variant, qty, false);
    if qty > 99999999999.999 then raise exception 'Quantity is outside the supported range'; end if;
    if nullif(item->>'actual_unit_selling_price', '') is null then raise exception 'Actual selling price is required'; end if;
    actual := (item->>'actual_unit_selling_price')::numeric;
    if actual <= 0 then raise exception 'Actual selling price must be greater than zero'; end if;
    if actual <> round(actual, 2) or actual > 999999999999.99 then raise exception 'Enter a selling price with no more than two decimal places'; end if;
    standard := public.resolve_selling_price(variant, target_branch, 'RETAIL', now());
    if actual <> standard and not public.has_permission('sales.price_override') then
      raise exception 'You do not have permission to override this selling price';
    end if;
    select p.name, v.name, v.sku, u.symbol into product_label, variant_label, sku_label, unit_label
    from public.product_variants v join public.products p on p.id = v.product_id
    join public.units_of_measure u on u.id = p.unit_of_measure_id
    where v.id = variant and v.is_active and p.status = 'ACTIVE';
    if not found then raise exception 'Choose an active product variant'; end if;
    line_value := round(qty * actual, 2);
    insert into public.daily_sales_batch_items(
      batch_id, variant_id, quantity, standard_unit_price_snapshot, actual_unit_selling_price,
      line_total, product_name_snapshot, variant_name_snapshot, item_code_snapshot, unit_snapshot
    ) values (saved_batch_id, variant, qty, standard, actual, line_value, product_label, variant_label, sku_label, unit_label);
    calculated_total := calculated_total + line_value;
  end loop;

  update public.daily_sales_batches set total_revenue = calculated_total where id = saved_batch_id;
  if target_batch is null then
    if target_correction_of is not null then
      update public.daily_sales_batches set replacement_batch_id = saved_batch_id
      where id = target_correction_of and replacement_batch_id is null;
      if not found then raise exception 'This reversed batch already has a correction draft'; end if;
    end if;
    insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), target_branch, 'daily_sales.batch_created', 'daily_sales_batches', saved_batch_id,
      jsonb_build_object('batch_number', (select batch_number from public.daily_sales_batches where id = saved_batch_id),
        'sales_date', target_sales_date, 'entry_kind', target_entry_kind, 'line_count', item_count));
  else
    insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), target_branch, 'daily_sales.draft_updated', 'daily_sales_batches', saved_batch_id,
      jsonb_build_object('sales_date', target_sales_date, 'line_count', item_count, 'total_revenue', calculated_total));
  end if;
  return saved_batch_id;
end;
$$;

create function public.post_daily_sales_batch(target_batch uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  header public.daily_sales_batches%rowtype;
  stock_row record;
  line public.daily_sales_batch_items%rowtype;
  movement_id uuid;
  calculated_total numeric(14,2);
  line_count integer;
begin
  select * into header from public.daily_sales_batches where id = target_batch for update;
  if not found then raise exception 'Daily sales batch not found'; end if;
  if not public.has_permission('daily_sales.post') or not public.can_access_branch(header.branch_id) then
    raise exception 'You do not have permission to post this batch';
  end if;
  if header.status = 'POSTED' then return header.id; end if;
  if header.status <> 'DRAFT' then raise exception 'Only draft daily sales batches can be posted'; end if;
  if not exists (select 1 from public.branches where id = header.branch_id and is_active) then raise exception 'The batch branch is no longer active'; end if;
  perform public.assert_daily_sales_date(header.sales_date);
  select count(*), coalesce(sum(i.line_total), 0) into line_count, calculated_total
  from public.daily_sales_batch_items i where i.batch_id = header.id;
  if line_count = 0 then raise exception 'Add at least one product before posting'; end if;
  if header.entry_kind = 'STANDARD' and exists (
    select 1 from public.daily_sales_batches existing
    where existing.id <> header.id and existing.branch_id = header.branch_id
      and existing.sales_date = header.sales_date and existing.status = 'POSTED'
  ) then raise exception 'A posted batch already exists for this branch and date. Create an additional or correction batch.'; end if;
  if header.entry_kind = 'ADDITIONAL' and char_length(trim(coalesce(header.entry_reason, ''))) < 3 then
    raise exception 'Explain why this additional daily batch is required';
  end if;
  if header.entry_kind = 'CORRECTION' and not exists (
    select 1 from public.daily_sales_batches original where original.id = header.correction_of_batch_id
      and original.status = 'REVERSED' and original.replacement_batch_id = header.id
  ) then raise exception 'The correction batch is not linked to a reversed batch'; end if;

  -- Lock each variant balance in stable order and validate the combined line
  -- quantity before creating any movement. Any later error rolls the RPC back.
  for stock_row in
    select i.variant_id, sum(i.quantity) requested,
      max(i.item_code_snapshot) item_code, max(i.product_name_snapshot) product_name,
      max(i.unit_snapshot) unit_name
    from public.daily_sales_batch_items i where i.batch_id = header.id
    group by i.variant_id order by i.variant_id
  loop
    insert into public.branch_inventory(branch_id, variant_id) values (header.branch_id, stock_row.variant_id)
    on conflict (branch_id, variant_id) do nothing;
    perform 1 from public.branch_inventory bi
      where bi.branch_id = header.branch_id and bi.variant_id = stock_row.variant_id for update;
    if (select bi.quantity_on_hand from public.branch_inventory bi
        where bi.branch_id = header.branch_id and bi.variant_id = stock_row.variant_id) < stock_row.requested then
      raise exception 'Insufficient stock for % (%): available %, requested %',
        stock_row.product_name, stock_row.item_code,
        (select bi.quantity_on_hand from public.branch_inventory bi where bi.branch_id = header.branch_id and bi.variant_id = stock_row.variant_id),
        stock_row.requested;
    end if;
  end loop;

  for line in select * from public.daily_sales_batch_items where batch_id = header.id order by variant_id, id loop
    perform public.validate_inventory_quantity(line.variant_id, line.quantity, false);
    if line.actual_unit_selling_price <> line.standard_unit_price_snapshot
      and not public.has_permission('sales.price_override') then
      raise exception 'You do not have permission to override this selling price';
    end if;
    movement_id := public.inventory_apply_movement(
      header.branch_id, line.variant_id, 'SALE', -line.quantity, 'DAILY_SALES_BATCH',
      header.id, line.id::text, header.batch_number || ' · ' || line.item_code_snapshot
    );
    update public.daily_sales_batch_items set stock_movement_id = movement_id where id = line.id;
  end loop;

  update public.daily_sales_batches set status = 'POSTED', total_revenue = calculated_total,
    posted_by = auth.uid(), posted_at = now() where id = header.id;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), header.branch_id, 'daily_sales.batch_posted', 'daily_sales_batches', header.id,
    jsonb_build_object('batch_number', header.batch_number, 'sales_date', header.sales_date,
      'line_count', line_count, 'total_revenue', calculated_total, 'posted_at', now()));
  return header.id;
end;
$$;

create function public.reverse_daily_sales_batch(target_batch uuid, correction_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  header public.daily_sales_batches%rowtype;
  line public.daily_sales_batch_items%rowtype;
  movement_id uuid;
begin
  select * into header from public.daily_sales_batches where id = target_batch for update;
  if not found then raise exception 'Daily sales batch not found'; end if;
  if not public.has_permission('daily_sales.reverse') or not public.can_access_branch(header.branch_id) then
    raise exception 'You do not have permission to reverse this batch';
  end if;
  if header.status <> 'POSTED' then raise exception 'Only a posted batch can be reversed'; end if;
  if char_length(trim(coalesce(correction_reason, ''))) < 3 then raise exception 'A correction reason is required'; end if;
  for line in select * from public.daily_sales_batch_items where batch_id = header.id order by variant_id, id loop
    if line.stock_movement_id is null or line.reversal_movement_id is not null then
      raise exception 'This batch has incomplete or already reversed stock movements';
    end if;
    movement_id := public.inventory_apply_movement(
      header.branch_id, line.variant_id, 'SALE_REVERSAL', line.quantity, 'DAILY_SALES_BATCH',
      header.id, line.id::text, header.batch_number || ' · reversal · ' || trim(correction_reason)
    );
    update public.daily_sales_batch_items set reversal_movement_id = movement_id where id = line.id;
  end loop;
  update public.daily_sales_batches set status = 'REVERSED', reversed_by = auth.uid(),
    reversed_at = now(), reversal_reason = trim(correction_reason) where id = header.id;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), header.branch_id, 'daily_sales.batch_reversed', 'daily_sales_batches', header.id,
    jsonb_build_object('batch_number', header.batch_number, 'reason', trim(correction_reason), 'reversed_at', now()));
end;
$$;

create view public.daily_sales_statement with (security_invoker = true) as
select b.*, br.name branch_name, count(i.id)::integer line_count
from public.daily_sales_batches b
join public.branches br on br.id = b.branch_id
left join public.daily_sales_batch_items i on i.batch_id = b.id
group by b.id, br.name;
grant select on public.daily_sales_statement to authenticated;

-- Canonical posted revenue and product-line sources for reports/dashboard.
create view public.sales_revenue_events with (security_invoker = true) as
select s.id source_id, 'SALE'::text source_type, s.sale_number source_number,
  s.branch_id, (s.completed_at at time zone 'Africa/Accra')::date business_date,
  s.completed_at posted_at, s.total_amount revenue, s.amount_paid,
  s.balance_due, s.payment_status::text payment_status
from public.sales s where s.status = 'COMPLETED'
union all
select b.id source_id, 'DAILY_BATCH'::text source_type, b.batch_number source_number,
  b.branch_id, b.sales_date business_date, b.posted_at, b.total_revenue revenue,
  null::numeric amount_paid, null::numeric balance_due, 'NOT_TRACKED'::text payment_status
from public.daily_sales_batches b where b.status = 'POSTED';

create view public.sales_revenue_event_items with (security_invoker = true) as
select s.id source_id, 'SALE'::text source_type, s.branch_id, i.variant_id,
  i.quantity, i.unit_price actual_unit_price, i.line_total,
  i.sku_snapshot item_code, i.product_name_snapshot product_name,
  i.variant_name_snapshot variant_name, i.unit_snapshot unit_name
from public.sales s join public.sale_items i on i.sale_id = s.id
where s.status = 'COMPLETED'
union all
select b.id source_id, 'DAILY_BATCH'::text source_type, b.branch_id, i.variant_id,
  i.quantity, i.actual_unit_selling_price actual_unit_price, i.line_total,
  i.item_code_snapshot item_code, i.product_name_snapshot product_name,
  i.variant_name_snapshot variant_name, i.unit_snapshot unit_name
from public.daily_sales_batches b join public.daily_sales_batch_items i on i.batch_id = b.id
where b.status = 'POSTED';
revoke all on public.sales_revenue_events, public.sales_revenue_event_items from public, anon, authenticated;

create or replace function public.reporting_sales(
  from_date date, to_date date, target_branch uuid default null,
  row_limit integer default 100, row_offset integer default 0
) returns table(
  sale_id uuid, sale_date date, sale_number text, receipt_number text,
  branch_id uuid, branch_name text, customer_name text,
  total_amount numeric, amount_paid numeric, balance_due numeric, payment_status text
) language plpgsql stable security definer set search_path = '' as $$
begin
  if from_date is null or to_date is null or from_date > to_date
    or row_limit not between 1 and 1000 or row_offset < 0 then raise exception 'Invalid report filters'; end if;
  if not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read') then
    raise exception 'You do not have access to this report scope';
  end if;
  return query
  select e.source_id, e.business_date, e.source_number,
    case when e.source_type = 'SALE' then s.receipt_number else null end,
    e.branch_id, br.name,
    case when e.source_type = 'SALE' then c.name else 'Daily sales batch' end,
    e.revenue, e.amount_paid, e.balance_due, e.payment_status
  from public.sales_revenue_events e
  join public.branches br on br.id = e.branch_id
  left join public.sales s on e.source_type = 'SALE' and s.id = e.source_id
  left join public.customers c on c.id = s.customer_id
  where e.business_date between from_date and to_date
    and (target_branch is null or e.branch_id = target_branch)
  order by e.posted_at desc, e.source_number desc
  limit row_limit offset row_offset;
end;
$$;

create or replace function public.dashboard_summary(from_date date, to_date date, target_branch uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  start_at timestamptz;
  end_at timestamptz;
  prior_start date;
  days integer;
  result jsonb;
begin
  if from_date is null or to_date is null or from_date > to_date or to_date - from_date > 731 then
    raise exception 'Choose a valid reporting date range of no more than two years';
  end if;
  if not public.reporting_scope_allowed(target_branch, 'dashboard.company.read', 'dashboard.branch.read') then
    raise exception 'You do not have access to this dashboard scope';
  end if;
  start_at := from_date::timestamp at time zone 'Africa/Accra';
  end_at := (to_date + 1)::timestamp at time zone 'Africa/Accra';
  days := to_date - from_date + 1;
  prior_start := from_date - days;

  select jsonb_build_object(
    'from', from_date, 'to', to_date, 'timezone', 'Africa/Accra',
    'kpis', jsonb_build_object(
      'sales_revenue', (select coalesce(sum(e.revenue), 0) from public.sales_revenue_events e where e.business_date between from_date and to_date and (target_branch is null or e.branch_id = target_branch)),
      'sales_count', (select count(*) from public.sales_revenue_events e where e.business_date between from_date and to_date and (target_branch is null or e.branch_id = target_branch)),
      'units_sold', (select coalesce(sum(i.quantity), 0) from public.sales_revenue_event_items i join public.sales_revenue_events e on e.source_id = i.source_id and e.source_type = i.source_type where e.business_date between from_date and to_date and (target_branch is null or e.branch_id = target_branch)),
      'collections', case when public.has_permission('customer_payments.read') then (select coalesce(sum(p.amount), 0) from public.customer_payments p where p.status = 'POSTED' and p.payment_date >= start_at and p.payment_date < end_at and (target_branch is null or p.branch_id = target_branch)) else null end,
      'receivables', case when public.has_permission('receivables.read') then (select coalesce(sum(s.balance_due), 0) from public.sales s join public.customers c on c.id = s.customer_id where s.status = 'COMPLETED' and s.balance_due > 0 and not c.is_walk_in and (target_branch is null or s.branch_id = target_branch)) else null end,
      'purchase_value', case when public.has_permission('purchases.read') then (select coalesce(sum(p.total_amount), 0) from public.purchases p where p.status <> 'CANCELLED' and p.purchase_date between from_date and to_date and (target_branch is null or p.branch_id = target_branch)) else null end,
      'supplier_payments', case when public.has_permission('supplier_payments.read') then (select coalesce(sum(p.amount), 0) from public.supplier_payments p where p.payment_date between from_date and to_date and (target_branch is null or p.branch_id = target_branch)) else null end,
      'supplier_balance', case when public.has_permission('purchases.read') then (select coalesce(sum(p.balance_due), 0) from public.purchases p where p.status <> 'CANCELLED' and p.balance_due > 0 and (target_branch is null or p.branch_id = target_branch)) else null end,
      'low_stock', case when public.has_permission('inventory.read') then (select count(*) from public.branch_inventory bi where bi.quantity_on_hand > 0 and bi.quantity_on_hand <= bi.minimum_stock_level and (target_branch is null or bi.branch_id = target_branch)) else null end,
      'out_of_stock', case when public.has_permission('inventory.read') then (select count(*) from public.branch_inventory bi where bi.quantity_on_hand = 0 and (target_branch is null or bi.branch_id = target_branch)) else null end,
      'in_transit', case when public.has_permission('transfers.read') then (select coalesce(sum(i.dispatched_quantity - i.received_quantity), 0) from public.stock_transfers t join public.stock_transfer_items i on i.transfer_id = t.id where t.status = 'DISPATCHED' and (target_branch is null or t.source_branch_id = target_branch or t.destination_branch_id = target_branch)) else null end
    ),
    'prior', jsonb_build_object(
      'sales_revenue', (select coalesce(sum(e.revenue), 0) from public.sales_revenue_events e where e.business_date between prior_start and from_date - 1 and (target_branch is null or e.branch_id = target_branch)),
      'collections', case when public.has_permission('customer_payments.read') then (select coalesce(sum(p.amount), 0) from public.customer_payments p where p.status = 'POSTED' and p.payment_date >= (prior_start::timestamp at time zone 'Africa/Accra') and p.payment_date < start_at and (target_branch is null or p.branch_id = target_branch)) else null end,
      'purchase_value', case when public.has_permission('purchases.read') then (select coalesce(sum(p.total_amount), 0) from public.purchases p where p.status <> 'CANCELLED' and p.purchase_date between prior_start and from_date - 1 and (target_branch is null or p.branch_id = target_branch)) else null end
    ),
    'trend', (select coalesce(jsonb_agg(jsonb_build_object('date', d.day::date, 'sales', coalesce(s.amount, 0), 'collections', coalesce(c.amount, 0)) order by d.day), '[]'::jsonb)
      from generate_series(from_date, to_date, interval '1 day') d(day)
      left join lateral (select sum(e.revenue) amount from public.sales_revenue_events e where e.business_date = d.day::date and (target_branch is null or e.branch_id = target_branch)) s on true
      left join lateral (select sum(x.amount) amount from public.customer_payments x where x.status = 'POSTED' and (x.payment_date at time zone 'Africa/Accra')::date = d.day::date and (target_branch is null or x.branch_id = target_branch) and public.has_permission('customer_payments.read')) c on true),
    'branches', case when public.has_permission('dashboard.company.read') then (select coalesce(jsonb_agg(x order by x.sales_revenue desc), '[]'::jsonb) from (
      select b.id, b.name, coalesce(sum(e.revenue), 0) sales_revenue, count(e.source_id) sales_count
      from public.branches b left join public.sales_revenue_events e on e.branch_id = b.id and e.business_date between from_date and to_date
      where b.is_active and (target_branch is null or b.id = target_branch) group by b.id, b.name
    ) x) else '[]'::jsonb end,
    'top_products', (select coalesce(jsonb_agg(x order by x.revenue desc), '[]'::jsonb) from (
      select i.variant_id, i.item_code sku, i.product_name product, i.variant_name variant, i.unit_name unit,
        sum(i.quantity) quantity, sum(i.line_total) revenue
      from public.sales_revenue_event_items i join public.sales_revenue_events e on e.source_id = i.source_id and e.source_type = i.source_type
      where e.business_date between from_date and to_date and (target_branch is null or e.branch_id = target_branch)
      group by i.variant_id, i.item_code, i.product_name, i.variant_name, i.unit_name order by revenue desc limit 8
    ) x),
    'inventory', case when public.has_permission('inventory.read') then jsonb_build_object(
      'health', (select coalesce(jsonb_object_agg(x.status, x.count), '{}'::jsonb) from (select case when bi.quantity_on_hand = 0 then 'OUT_OF_STOCK' when bi.quantity_on_hand <= bi.minimum_stock_level then 'LOW_STOCK' else 'IN_STOCK' end status, count(*) from public.branch_inventory bi where target_branch is null or bi.branch_id = target_branch group by 1) x),
      'urgent', (select coalesce(jsonb_agg(x order by x.shortfall desc), '[]'::jsonb) from (select bi.id, p.name product, v.name variant, v.sku, b.name branch, bi.quantity_on_hand, bi.minimum_stock_level, (bi.minimum_stock_level - bi.quantity_on_hand) shortfall, u.symbol unit from public.branch_inventory bi join public.branches b on b.id = bi.branch_id join public.product_variants v on v.id = bi.variant_id join public.products p on p.id = v.product_id join public.units_of_measure u on u.id = p.unit_of_measure_id where bi.quantity_on_hand <= bi.minimum_stock_level and (target_branch is null or bi.branch_id = target_branch) order by shortfall desc limit 8) x)
    ) else null end,
    'aging', case when public.has_permission('receivables.read') then (select coalesce(jsonb_object_agg(bucket, amount), '{}'::jsonb) from (
      select case when s.payment_due_date is null then 'NO_DUE_DATE' when s.payment_due_date >= to_date then 'CURRENT' when to_date - s.payment_due_date between 1 and 30 then 'DAYS_1_30' when to_date - s.payment_due_date between 31 and 60 then 'DAYS_31_60' when to_date - s.payment_due_date between 61 and 90 then 'DAYS_61_90' else 'DAYS_90_PLUS' end bucket, sum(s.balance_due) amount
      from public.sales s join public.customers c on c.id = s.customer_id where s.status = 'COMPLETED' and s.balance_due > 0 and not c.is_walk_in and (target_branch is null or s.branch_id = target_branch) group by 1
    ) x) else null end,
    'payment_methods', case when public.has_permission('customer_payments.read') then (select coalesce(jsonb_agg(x order by x.amount desc), '[]'::jsonb) from (select p.payment_method method, sum(p.amount) amount from public.customer_payments p where p.status = 'POSTED' and p.payment_date >= start_at and p.payment_date < end_at and (target_branch is null or p.branch_id = target_branch) group by p.payment_method) x) else null end,
    'purchasing', case when public.has_permission('purchases.read') then (select jsonb_build_object('ordered', count(*) filter (where p.status = 'ORDERED'), 'partial', count(*) filter (where p.status = 'PARTIALLY_RECEIVED'), 'received', count(*) filter (where p.status = 'RECEIVED'), 'awaiting_value', coalesce(sum(p.balance_due) filter (where p.status <> 'CANCELLED'), 0)) from public.purchases p where target_branch is null or p.branch_id = target_branch) else null end,
    'transfers', case when public.has_permission('transfers.read') then (select jsonb_build_object('requested', count(*) filter (where t.status = 'REQUESTED'), 'approved', count(*) filter (where t.status = 'APPROVED'), 'in_transit', count(*) filter (where t.status = 'DISPATCHED'), 'received', count(*) filter (where t.status = 'RECEIVED' and t.received_at >= start_at and t.received_at < end_at)) from public.stock_transfers t where target_branch is null or t.source_branch_id = target_branch or t.destination_branch_id = target_branch) else null end,
    'activity', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (select a.action, a.entity_type, a.entity_id, a.branch_id, a.created_at from public.audit_logs a where a.action in ('sale.completed', 'daily_sales.batch_posted', 'daily_sales.batch_reversed', 'customer_payment.recorded', 'purchase.received', 'supplier_payment.recorded', 'transfer.dispatched', 'transfer.received', 'inventory.adjustment_completed') and (target_branch is null or a.branch_id = target_branch) order by a.created_at desc limit 12) x)
  ) into result;
  return result;
end;
$$;

revoke all on function public.assert_daily_sales_date(date), public.next_daily_sales_number(date),
  public.save_daily_sales_draft(uuid, uuid, date, text, text, text, uuid, jsonb),
  public.post_daily_sales_batch(uuid), public.reverse_daily_sales_batch(uuid, text)
  from public, anon, authenticated;
grant execute on function public.save_daily_sales_draft(uuid, uuid, date, text, text, text, uuid, jsonb),
  public.post_daily_sales_batch(uuid), public.reverse_daily_sales_batch(uuid, text)
  to authenticated;
revoke all on function public.reporting_sales(date, date, uuid, integer, integer), public.dashboard_summary(date, date, uuid) from public;
grant execute on function public.reporting_sales(date, date, uuid, integer, integer), public.dashboard_summary(date, date, uuid) to authenticated;
