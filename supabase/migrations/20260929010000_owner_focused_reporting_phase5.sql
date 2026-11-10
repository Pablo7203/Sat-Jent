-- Phase 5 reporting foundation: canonical business dates, grouped trends,
-- product performance and actionable draft attention.

create index if not exists sales_branch_sale_date_completed_idx
  on public.sales(branch_id, sale_date desc) where status = 'COMPLETED';
create index if not exists daily_sales_batches_branch_date_status_idx
  on public.daily_sales_batches(branch_id, sales_date desc, status);

-- Backdated sales belong to the entered sale date. completed_at is retained as
-- the immutable posting timestamp and is not the reporting business date.
create or replace view public.sales_revenue_events with (security_invoker = true) as
select s.id source_id, 'SALE'::text source_type, s.sale_number source_number,
  s.branch_id, (s.sale_date at time zone 'Africa/Accra')::date business_date,
  s.completed_at posted_at, s.total_amount revenue, s.amount_paid,
  s.balance_due, s.payment_status::text payment_status
from public.sales s where s.status = 'COMPLETED'
union all
select b.id source_id, 'DAILY_BATCH'::text source_type, b.batch_number source_number,
  b.branch_id, b.sales_date business_date, b.posted_at, b.total_revenue revenue,
  null::numeric amount_paid, null::numeric balance_due, 'NOT_TRACKED'::text payment_status
from public.daily_sales_batches b where b.status = 'POSTED';
revoke all on public.sales_revenue_events from public, anon, authenticated;

drop function public.reporting_sales(date, date, uuid, integer, integer);
create function public.reporting_sales(
  from_date date, to_date date, target_branch uuid default null,
  row_limit integer default 100, row_offset integer default 0,
  source_filter text default 'ALL'
) returns table(
  sale_id uuid, source_type text, transaction_status text, posted_at timestamptz,
  sale_date date, sale_number text, receipt_number text,
  branch_id uuid, branch_name text, customer_name text,
  posted_by text,
  total_amount numeric, amount_paid numeric, balance_due numeric, payment_status text
) language plpgsql stable security definer set search_path = '' as $$
begin
  if from_date is null or to_date is null or from_date > to_date
    or to_date - from_date > 731 or row_limit not between 1 and 1000 or row_offset < 0
    or source_filter not in ('ALL','SALE','DAILY_BATCH') then
    raise exception 'Invalid report filters';
  end if;
  if not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read') then
    raise exception 'You do not have access to this report scope';
  end if;
  return query
  select e.source_id, e.source_type,
    case when e.source_type = 'SALE' then s.status::text else batch.status::text end,
    e.posted_at, e.business_date, e.source_number,
    case when e.source_type = 'SALE' then s.receipt_number end,
    e.branch_id, br.name,
    case when e.source_type = 'SALE' then c.name else 'Daily sales batch' end,
    coalesce(actor.full_name, 'Unknown'),
    e.revenue, e.amount_paid, e.balance_due, e.payment_status
  from public.sales_revenue_events e
  join public.branches br on br.id = e.branch_id
  left join public.sales s on e.source_type = 'SALE' and s.id = e.source_id
  left join public.customers c on c.id = s.customer_id
  left join public.daily_sales_batches batch on e.source_type = 'DAILY_BATCH' and batch.id = e.source_id
  left join public.profiles actor on actor.id = case
    when e.source_type = 'SALE' then s.completed_by else batch.posted_by end
  where e.business_date between from_date and to_date
    and (source_filter='ALL' or e.source_type=source_filter)
    and (target_branch is null or e.branch_id = target_branch)
  order by e.posted_at desc, e.source_number desc
  limit row_limit offset row_offset;
end;
$$;

-- Keep the proven operational aggregates while the canonical view supplies its
-- corrected sale business dates. New Phase 5 measures are added to that result.
alter function public.dashboard_summary(date, date, uuid)
  rename to dashboard_summary_legacy_phase5;
revoke all on function public.dashboard_summary_legacy_phase5(date, date, uuid)
  from public, anon, authenticated;

drop function if exists public.reporting_sales_periods(date, date, uuid, text);
create function public.reporting_sales_periods(
  from_date date, to_date date, target_branch uuid default null,
  granularity text default 'day', source_filter text default 'ALL'
) returns table(
  bucket_start date, revenue numeric, transaction_count bigint,
  individual_sale_count bigint, posted_batch_count bigint, collections numeric
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if from_date is null or to_date is null or from_date > to_date or to_date - from_date > 731
    or granularity not in ('day','week','month','year')
    or source_filter not in ('ALL','SALE','DAILY_BATCH') then
    raise exception 'Choose a valid reporting range and period';
  end if;
  if not public.reporting_scope_allowed(target_branch, 'dashboard.company.read', 'dashboard.branch.read')
    and not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read') then
    raise exception 'You do not have access to this dashboard scope';
  end if;
  return query
  with dates as (
    select d::date as calendar_date from generate_series(from_date::timestamp, to_date::timestamp, interval '1 day') d
  ), buckets as (
    select distinct date_trunc(granularity, calendar_date::timestamp)::date bucket_start from dates
  )
  select b.bucket_start,
    coalesce((select sum(e.revenue) from public.sales_revenue_events e
      where e.business_date >= b.bucket_start
        and e.business_date < case granularity
          when 'day' then b.bucket_start + 1
          when 'week' then b.bucket_start + 7
          when 'month' then (b.bucket_start + interval '1 month')::date
          else (b.bucket_start + interval '1 year')::date end
        and e.business_date between from_date and to_date
        and (source_filter='ALL' or e.source_type=source_filter)
        and (target_branch is null or e.branch_id = target_branch)), 0)::numeric,
    (select count(*) from public.sales_revenue_events e
      where e.business_date >= b.bucket_start
        and e.business_date < case granularity
          when 'day' then b.bucket_start + 1
          when 'week' then b.bucket_start + 7
          when 'month' then (b.bucket_start + interval '1 month')::date
          else (b.bucket_start + interval '1 year')::date end
        and e.business_date between from_date and to_date
        and (source_filter='ALL' or e.source_type=source_filter)
        and (target_branch is null or e.branch_id = target_branch)),
    (select count(*) from public.sales_revenue_events e
      where e.business_date >= b.bucket_start
        and e.business_date < case granularity
          when 'day' then b.bucket_start + 1
          when 'week' then b.bucket_start + 7
          when 'month' then (b.bucket_start + interval '1 month')::date
          else (b.bucket_start + interval '1 year')::date end
        and e.business_date between from_date and to_date
        and e.source_type = 'SALE'
        and (source_filter='ALL' or e.source_type=source_filter)
        and (target_branch is null or e.branch_id = target_branch)),
    (select count(*) from public.sales_revenue_events e
      where e.business_date >= b.bucket_start
        and e.business_date < case granularity
          when 'day' then b.bucket_start + 1
          when 'week' then b.bucket_start + 7
          when 'month' then (b.bucket_start + interval '1 month')::date
          else (b.bucket_start + interval '1 year')::date end
        and e.business_date between from_date and to_date
        and e.source_type = 'DAILY_BATCH'
        and (source_filter='ALL' or e.source_type=source_filter)
        and (target_branch is null or e.branch_id = target_branch)),
    case when source_filter = 'DAILY_BATCH' then null
      when public.has_permission('customer_payments.read') then
      coalesce((select sum(p.amount) from public.customer_payments p
        where p.status = 'POSTED'
          and (p.payment_date at time zone 'Africa/Accra')::date >= b.bucket_start
          and (p.payment_date at time zone 'Africa/Accra')::date < case granularity
            when 'day' then b.bucket_start + 1
            when 'week' then b.bucket_start + 7
            when 'month' then (b.bucket_start + interval '1 month')::date
            else (b.bucket_start + interval '1 year')::date end
          and (p.payment_date at time zone 'Africa/Accra')::date between from_date and to_date
          and (target_branch is null or p.branch_id = target_branch)), 0)
      else null end
  from buckets b order by b.bucket_start;
end;
$$;

create or replace function public.reporting_product_performance(
  from_date date, to_date date, target_branch uuid default null,
  ranking text default 'BEST_QUANTITY', category_filter uuid default null,
  brand_filter uuid default null, search_text text default null,
  row_limit integer default 50, row_offset integer default 0
) returns table(
  product_id uuid, variant_id uuid, product_name text, category_name text,
  brand_name text, variant_name text, sku text, unit_name text,
  quantity_sold numeric, line_revenue numeric, last_sold_date date,
  current_quantity numeric, minimum_stock_level numeric, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if from_date is null or to_date is null or from_date > to_date or to_date - from_date > 731
    or ranking not in ('BEST_QUANTITY','BEST_REVENUE','LEAST_QUANTITY','LEAST_REVENUE','NO_SALES','SLOW_MOVING')
    or row_limit not between 1 and 1000 or row_offset < 0 then
    raise exception 'Invalid product performance filters';
  end if;
  if not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read')
    and not public.reporting_scope_allowed(target_branch, 'dashboard.company.read', 'dashboard.branch.read') then
    raise exception 'You do not have access to this report scope';
  end if;
  if ranking in ('LEAST_QUANTITY','LEAST_REVENUE','NO_SALES','SLOW_MOVING')
    and not public.has_permission('inventory.read') then
    raise exception 'Inventory permission is required for stock-based product rankings';
  end if;
  return query
  with sold as (
    select i.variant_id, sum(i.quantity)::numeric quantity_sold,
      sum(i.line_total)::numeric line_revenue, max(e.business_date) last_sold_date
    from public.sales_revenue_event_items i
    join public.sales_revenue_events e on e.source_id=i.source_id and e.source_type=i.source_type
    where e.business_date between from_date and to_date
      and (target_branch is null or e.branch_id=target_branch)
    group by i.variant_id
  ), current_stock as (
    select bi.variant_id, sum(bi.quantity_on_hand)::numeric current_quantity,
      sum(bi.minimum_stock_level)::numeric minimum_stock_level
    from public.branch_inventory bi
    where target_branch is null or bi.branch_id=target_branch
    group by bi.variant_id
  ), last_activity as (
    select i.variant_id, max(e.business_date) last_sold_date
    from public.sales_revenue_event_items i
    join public.sales_revenue_events e on e.source_id=i.source_id and e.source_type=i.source_type
    where e.business_date <= to_date
      and (target_branch is null or e.branch_id=target_branch)
    group by i.variant_id
  ), base as (
    select p.id product_id, v.id variant_id, p.name product_name, c.name category_name,
      br.name brand_name, v.name variant_name, v.sku, u.symbol unit_name,
      coalesce(s.quantity_sold,0)::numeric quantity_sold,
      coalesce(s.line_revenue,0)::numeric line_revenue,
      coalesce(s.last_sold_date,la.last_sold_date) last_sold_date,
      case when public.has_permission('inventory.read') then cs.current_quantity end current_quantity,
      case when public.has_permission('inventory.read') then cs.minimum_stock_level end minimum_stock_level,
      cs.current_quantity raw_current_quantity, la.last_sold_date historical_last_sold_date
    from public.products p
    join public.categories c on c.id=p.category_id
    left join public.brands br on br.id=p.brand_id
    join public.product_variants v on v.product_id=p.id and v.is_active
    join public.units_of_measure u on u.id=p.unit_of_measure_id
    left join sold s on s.variant_id=v.id
    left join current_stock cs on cs.variant_id=v.id
    left join last_activity la on la.variant_id=v.id
    where p.status='ACTIVE'
      and (category_filter is null or p.category_id=category_filter)
      and (brand_filter is null or p.brand_id=brand_filter)
      and (search_text is null or trim(search_text)='' or concat_ws(' ',p.name,c.name,br.name,v.name,v.sku) ilike '%'||trim(search_text)||'%')
      and (s.variant_id is not null or cs.variant_id is not null)
  ), filtered as (
    select * from base b where
      (ranking in ('BEST_QUANTITY','BEST_REVENUE') and b.quantity_sold > 0)
      or (ranking in ('LEAST_QUANTITY','LEAST_REVENUE') and coalesce(b.raw_current_quantity,0)>0)
      or (ranking='NO_SALES' and b.quantity_sold=0 and coalesce(b.raw_current_quantity,0)>0)
      or (ranking='SLOW_MOVING' and coalesce(b.raw_current_quantity,0)>0
        and (b.historical_last_sold_date is null or b.historical_last_sold_date <= to_date - 90))
  )
  select f.product_id,f.variant_id,f.product_name,f.category_name,f.brand_name,
    f.variant_name,f.sku,f.unit_name,f.quantity_sold,f.line_revenue,f.last_sold_date,
    f.current_quantity,f.minimum_stock_level,count(*) over()::bigint
  from filtered f
  order by case when ranking='BEST_QUANTITY' then -f.quantity_sold end,
    case when ranking='BEST_REVENUE' then -f.line_revenue end,
    case when ranking='LEAST_QUANTITY' then f.quantity_sold end,
    case when ranking='LEAST_REVENUE' then f.line_revenue end,
    case when ranking in ('NO_SALES','SLOW_MOVING') then coalesce(f.raw_current_quantity,0) end desc,
    f.product_name,f.variant_name
  limit row_limit offset row_offset;
end;
$$;

create or replace function public.reporting_sales_quantity_by_unit(
  from_date date, to_date date, target_branch uuid default null,
  source_filter text default 'ALL'
) returns table(unit_name text, quantity_sold numeric, line_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if from_date is null or to_date is null or from_date > to_date or to_date-from_date > 731
    or source_filter not in ('ALL','SALE','DAILY_BATCH') then
    raise exception 'Invalid sales quantity filters';
  end if;
  if not public.reporting_scope_allowed(target_branch, 'dashboard.company.read', 'dashboard.branch.read')
    and not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read') then
    raise exception 'You do not have access to this reporting scope';
  end if;
  return query
  select i.unit_name,sum(i.quantity)::numeric,count(*)::bigint
  from public.sales_revenue_event_items i
  join public.sales_revenue_events e on e.source_id=i.source_id and e.source_type=i.source_type
  where e.business_date between from_date and to_date
    and (target_branch is null or e.branch_id=target_branch)
    and (source_filter='ALL' or e.source_type=source_filter)
  group by i.unit_name order by sum(i.quantity) desc,i.unit_name;
end;
$$;

create or replace function public.dashboard_summary(from_date date, to_date date, target_branch uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
  compare_from date;
  compare_to date;
  compare_policy text := 'Immediately preceding equal-length date range';
begin
  if from_date is null or to_date is null or from_date > to_date or to_date - from_date > 731 then
    raise exception 'Choose a valid reporting date range of no more than two years';
  end if;
  if not public.reporting_scope_allowed(target_branch, 'dashboard.company.read', 'dashboard.branch.read') then
    raise exception 'You do not have access to this dashboard scope';
  end if;
  result := public.dashboard_summary_legacy_phase5(from_date, to_date, target_branch);
  result := jsonb_set(result, '{kpis,active_products}', case
    when public.has_permission('products.read') then to_jsonb((
      select count(distinct p.id) from public.products p
      join public.product_variants v on v.product_id = p.id and v.is_active
      where p.status = 'ACTIVE'
    )) else 'null'::jsonb end, true);
  compare_from := from_date - (to_date - from_date + 1);
  compare_to := from_date - 1;
  -- Calendar presets compare equivalent elapsed portions of the prior
  -- calendar period. Custom ranges use the immediately preceding equal span.
  if from_date = to_date then
    compare_from := from_date - 1;
    compare_to := from_date - 1;
  elsif from_date = date_trunc('year', from_date::timestamp)::date
    and to_date = (date_trunc('year', to_date::timestamp) + interval '1 year' - interval '1 day')::date
    and date_trunc('year', from_date::timestamp) = date_trunc('year', to_date::timestamp) then
    compare_from := (from_date - interval '1 year')::date;
    compare_to := (to_date - interval '1 year')::date;
    compare_policy := 'Previous complete calendar year';
  elsif from_date = date_trunc('month', from_date::timestamp)::date
    and date_trunc('month', from_date::timestamp) = date_trunc('month', to_date::timestamp) then
    if to_date = (date_trunc('month', to_date::timestamp) + interval '1 month' - interval '1 day')::date then
      compare_from := (from_date - interval '1 month')::date;
      compare_to := from_date - 1;
      compare_policy := 'Previous complete calendar month';
    else
      compare_from := (from_date - interval '1 month')::date;
      compare_to := least(compare_from + (to_date - from_date), (from_date - 1)::date);
      compare_policy := 'Equivalent elapsed portion of previous calendar month';
    end if;
  elsif from_date = date_trunc('year', from_date::timestamp)::date
    and date_trunc('year', from_date::timestamp) = date_trunc('year', to_date::timestamp) then
    compare_from := (from_date - interval '1 year')::date;
    compare_to := compare_from + (to_date - from_date);
    compare_policy := 'Equivalent elapsed portion of previous calendar year';
  elsif extract(isodow from from_date) = 1 and to_date < from_date + 6 then
    compare_from := from_date - 7;
    compare_to := to_date - 7;
    compare_policy := 'Equivalent elapsed portion of previous Monday-based week';
  end if;
  result := jsonb_set(result, '{prior,sales_revenue}', to_jsonb((
    select coalesce(sum(e.revenue),0) from public.sales_revenue_events e
    where e.business_date between compare_from and compare_to
      and (target_branch is null or e.branch_id=target_branch)
  )), true);
  result := jsonb_set(result, '{prior,collections}', case
    when public.has_permission('customer_payments.read') then to_jsonb((
      select coalesce(sum(p.amount),0) from public.customer_payments p
      where p.status='POSTED'
        and (p.payment_date at time zone 'Africa/Accra')::date between compare_from and compare_to
        and (target_branch is null or p.branch_id=target_branch)
    )) else 'null'::jsonb end, true);
  result := jsonb_set(result, '{prior,purchase_value}', case
    when public.has_permission('purchases.read') then to_jsonb((
      select coalesce(sum(p.total_amount),0) from public.purchases p
      where p.status <> 'CANCELLED' and p.purchase_date between compare_from and compare_to
        and (target_branch is null or p.branch_id=target_branch)
    )) else 'null'::jsonb end, true);
  result := jsonb_set(result, '{kpis,in_transit}', case
    when public.has_permission('transfers.read') then to_jsonb((
      select count(*) from public.stock_transfers t
      join public.stock_transfer_items i on i.transfer_id=t.id
      where t.status='DISPATCHED' and i.dispatched_quantity>i.received_quantity
        and (target_branch is null or t.source_branch_id=target_branch or t.destination_branch_id=target_branch)
    )) else 'null'::jsonb end, true);
  result := jsonb_set(result, '{comparison_window}', jsonb_build_object(
    'from', compare_from, 'to', compare_to, 'policy', compare_policy
  ), true);
  -- Do not combine unlike UOMs into a misleading company-wide unit total.
  result := jsonb_set(result, '{kpis,units_sold}', 'null'::jsonb, true);
  result := jsonb_set(result, '{daily_sales_drafts}',
    case when public.has_permission('daily_sales.read')
      and ((target_branch is null and public.has_permission('daily_sales.company.read'))
        or (target_branch is not null and public.can_access_branch(target_branch))) then to_jsonb((
      select count(*) from public.daily_sales_batches b where b.status='DRAFT'
        and b.sales_date between from_date and to_date
        and (target_branch is null or b.branch_id=target_branch)
    )) else 'null'::jsonb end, true);
  result := jsonb_set(result, '{activity}', (
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
    from (
      select a.action, a.entity_type, a.entity_id, a.branch_id, a.created_at,
        case
          when a.action = 'sale.completed' then jsonb_build_object('sale_number', a.metadata->'sale_number')
          when a.action like 'daily_sales.%' then jsonb_build_object('batch_number', a.metadata->'batch_number')
          when a.action = 'customer_payment.recorded' then jsonb_build_object(
            'sale_id', a.metadata->'sale_id',
            'payment_number', (select p.payment_number from public.customer_payments p where p.id = a.entity_id)
          )
          when a.action = 'purchase.goods_received' then jsonb_build_object('purchase_id', a.metadata->'purchase_id', 'purchase_number', a.metadata->'purchase_number')
          when a.action = 'supplier_payment.recorded' then jsonb_build_object('payment_number', a.metadata->'payment_number')
          when a.action like 'transfer.%' then jsonb_build_object('transfer_number', a.metadata->'transfer_number')
          when a.action = 'inventory.adjustment_completed' then jsonb_build_object('adjustment_number', a.metadata->'adjustment_number')
          else '{}'::jsonb
        end metadata
      from public.audit_logs a
      where a.action in ('sale.completed', 'daily_sales.batch_posted', 'daily_sales.batch_reversed',
        'customer_payment.recorded', 'purchase.goods_received', 'supplier_payment.recorded',
        'transfer.dispatched', 'transfer.received', 'inventory.adjustment_completed')
        and (a.action <> 'sale.completed' or public.has_permission('sales.read'))
        and (a.action not like 'daily_sales.%' or public.has_permission('daily_sales.read'))
        and (a.action <> 'customer_payment.recorded' or public.has_permission('customer_payments.read'))
        and (a.action <> 'purchase.goods_received' or public.has_permission('purchases.read'))
        and (a.action <> 'supplier_payment.recorded' or public.has_permission('supplier_payments.read'))
        and (a.action not like 'transfer.%' or public.has_permission('transfers.read'))
        and (a.action <> 'inventory.adjustment_completed' or public.has_permission('inventory.read'))
        and (target_branch is null or a.branch_id = target_branch)
      order by a.created_at desc limit 12
    ) x
  ), true);
  return result;
end;
$$;

create or replace function public.reporting_product_filter_options(target_branch uuid default null)
returns table(filter_type text, filter_id uuid, filter_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read') then
    raise exception 'You do not have access to this report scope';
  end if;
  return query
  select 'category'::text, c.id, c.name
  from public.categories c where c.is_active and exists(
    select 1 from public.products p where p.category_id=c.id and p.status='ACTIVE')
  union all
  select 'brand'::text, b.id, b.name
  from public.brands b where b.is_active and exists(
    select 1 from public.products p where p.brand_id=b.id and p.status='ACTIVE')
  order by 1,3;
end;
$$;

create or replace function public.reporting_receivable_aging_current(target_branch uuid default null)
returns table(bucket text, amount numeric, sale_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare as_of_date date := (now() at time zone 'Africa/Accra')::date;
begin
  if not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read')
    or not public.has_permission('receivables.read') then
    raise exception 'You do not have access to current receivables';
  end if;
  return query
  select case
      when s.payment_due_date is null then 'NO_DUE_DATE'
      when s.payment_due_date >= as_of_date then 'CURRENT'
      when as_of_date - s.payment_due_date between 1 and 30 then 'DAYS_1_30'
      when as_of_date - s.payment_due_date between 31 and 60 then 'DAYS_31_60'
      when as_of_date - s.payment_due_date between 61 and 90 then 'DAYS_61_90'
      else 'DAYS_90_PLUS' end,
    sum(s.balance_due), count(*)::bigint
  from public.sales s join public.customers c on c.id=s.customer_id
  where s.status='COMPLETED' and s.balance_due>0 and not c.is_walk_in
    and (target_branch is null or s.branch_id=target_branch)
  group by 1 order by 1;
end;
$$;

create or replace function public.reporting_stock_movements(
  from_date date, to_date date, target_branch uuid default null,
  row_limit integer default 50, row_offset integer default 0
) returns table(
  movement_id uuid, occurred_at timestamptz, branch_name text,
  product_id uuid, product_name text, variant_name text, sku text, unit_name text,
  movement_type text, quantity_delta numeric, reference_type text,
  reason_code text, reference_id uuid, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare start_at timestamptz; end_at timestamptz;
begin
  if from_date is null or to_date is null or from_date > to_date or to_date-from_date > 731
    or row_limit not between 1 and 1000 or row_offset < 0 then
    raise exception 'Invalid stock movement report filters';
  end if;
  if not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read')
    or not public.has_permission('inventory.read') then
    raise exception 'You do not have access to stock movement reports';
  end if;
  start_at := from_date::timestamp at time zone 'Africa/Accra';
  end_at := (to_date+1)::timestamp at time zone 'Africa/Accra';
  return query
  select sm.id,sm.occurred_at,br.name,p.id,p.name,v.name,v.sku,u.symbol,
    sm.movement_type::text,sm.quantity_delta,sm.reference_type,sm.reason_code,sm.reference_id,
    count(*) over()::bigint
  from public.stock_movements sm
  join public.branches br on br.id=sm.branch_id
  join public.product_variants v on v.id=sm.variant_id
  join public.products p on p.id=v.product_id
  join public.units_of_measure u on u.id=p.unit_of_measure_id
  where sm.occurred_at>=start_at and sm.occurred_at<end_at
    and (target_branch is null or sm.branch_id=target_branch)
  order by sm.occurred_at desc,sm.id desc
  limit row_limit offset row_offset;
end;
$$;

create or replace function public.reporting_inventory_current(
  target_branch uuid default null, row_limit integer default 50, row_offset integer default 0
) returns table(
  inventory_id uuid, branch_id uuid, branch_name text, product_id uuid,
  product_name text, category_name text, brand_name text, variant_name text,
  sku text, quantity_on_hand numeric, minimum_stock_level numeric,
  unit_name text, stock_status text, total_count bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if row_limit not between 1 and 1000 or row_offset < 0 then
    raise exception 'Invalid inventory report pagination';
  end if;
  if not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read')
    or not public.has_permission('inventory.read') then
    raise exception 'You do not have access to current inventory reports';
  end if;
  return query
  select bi.id, bi.branch_id, br.name, p.id, p.name, c.name, brand.name,
    v.name, v.sku, bi.quantity_on_hand, bi.minimum_stock_level, u.symbol,
    case when bi.quantity_on_hand = 0 then 'OUT_OF_STOCK'
      when bi.quantity_on_hand <= bi.minimum_stock_level then 'LOW_STOCK'
      else 'IN_STOCK' end,
    count(*) over()::bigint
  from public.branch_inventory bi
  join public.branches br on br.id = bi.branch_id
  join public.product_variants v on v.id = bi.variant_id
  join public.products p on p.id = v.product_id
  join public.categories c on c.id = p.category_id
  left join public.brands brand on brand.id = p.brand_id
  join public.units_of_measure u on u.id = p.unit_of_measure_id
  where target_branch is null or bi.branch_id = target_branch
  order by case when bi.quantity_on_hand = 0 then 0
    when bi.quantity_on_hand <= bi.minimum_stock_level then 1 else 2 end,
    br.name, p.name, v.name
  limit row_limit offset row_offset;
end;
$$;

create or replace function public.reporting_branch_performance(
  from_date date, to_date date, target_branch uuid default null
) returns table(
  branch_id uuid, branch_name text, revenue numeric, revenue_entries bigint,
  distinct_variants_sold bigint, quantity_by_unit jsonb,
  low_stock_variants bigint, out_of_stock_variants bigint,
  pending_purchase_orders bigint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if from_date is null or to_date is null or from_date > to_date or to_date-from_date > 731 then
    raise exception 'Invalid branch performance date range';
  end if;
  if (target_branch is not null
      and not public.reporting_scope_allowed(target_branch, 'reports.company.read', 'reports.branch.read')
      and not public.reporting_scope_allowed(target_branch, 'dashboard.company.read', 'dashboard.branch.read'))
    or (target_branch is null and not public.has_permission('reports.company.read')
      and not public.has_permission('dashboard.company.read')) then
    raise exception 'You do not have access to branch performance';
  end if;
  return query
  with rev as (
    select e.branch_id, sum(e.revenue)::numeric revenue, count(*)::bigint revenue_entries
    from public.sales_revenue_events e
    where e.business_date between from_date and to_date
      and (target_branch is null or e.branch_id = target_branch)
    group by e.branch_id
  ), product_counts as (
    select e.branch_id, count(distinct i.variant_id)::bigint variants
    from public.sales_revenue_events e
    join public.sales_revenue_event_items i
      on i.source_id = e.source_id and i.source_type = e.source_type
    where e.business_date between from_date and to_date
      and (target_branch is null or e.branch_id = target_branch)
    group by e.branch_id
  ), quantities as (
    select branch_id, jsonb_object_agg(unit_name, quantity) quantity_by_unit
    from (
      select e.branch_id, i.unit_name, sum(i.quantity)::numeric quantity
      from public.sales_revenue_events e
      join public.sales_revenue_event_items i
        on i.source_id = e.source_id and i.source_type = e.source_type
      where e.business_date between from_date and to_date
        and (target_branch is null or e.branch_id = target_branch)
      group by e.branch_id, i.unit_name
    ) grouped_quantities group by branch_id
  ), stock as (
    select bi.branch_id,
      count(*) filter (where bi.quantity_on_hand > 0 and bi.quantity_on_hand <= bi.minimum_stock_level)::bigint low_stock,
      count(*) filter (where bi.quantity_on_hand = 0)::bigint out_of_stock
    from public.branch_inventory bi
    where target_branch is null or bi.branch_id = target_branch
    group by bi.branch_id
  ), pending as (
    select p.branch_id, count(*)::bigint pending_count
    from public.purchases p
    where p.status in ('ORDERED', 'PARTIALLY_RECEIVED')
      and (target_branch is null or p.branch_id = target_branch)
    group by p.branch_id
  )
  select b.id, b.name, coalesce(r.revenue, 0), coalesce(r.revenue_entries, 0),
    coalesce(pc.variants, 0), coalesce(q.quantity_by_unit, '{}'::jsonb),
    case when public.has_permission('inventory.read') then coalesce(st.low_stock, 0) end,
    case when public.has_permission('inventory.read') then coalesce(st.out_of_stock, 0) end,
    case when public.has_permission('purchases.read') then coalesce(pd.pending_count, 0) end
  from public.branches b
  left join rev r on r.branch_id = b.id
  left join product_counts pc on pc.branch_id = b.id
  left join quantities q on q.branch_id = b.id
  left join stock st on st.branch_id = b.id
  left join pending pd on pd.branch_id = b.id
  where b.is_active and (target_branch is null or b.id = target_branch)
  order by coalesce(r.revenue, 0) desc, b.name;
end;
$$;

revoke all on function public.dashboard_summary_legacy_phase5(date, date, uuid),
  public.reporting_sales(date, date, uuid, integer, integer, text),
  public.reporting_sales_periods(date, date, uuid, text, text),
  public.reporting_product_performance(date, date, uuid, text, uuid, uuid, text, integer, integer),
  public.reporting_sales_quantity_by_unit(date, date, uuid, text),
  public.reporting_product_filter_options(uuid),
  public.reporting_receivable_aging_current(uuid),
  public.reporting_stock_movements(date, date, uuid, integer, integer),
  public.reporting_inventory_current(uuid, integer, integer),
  public.reporting_branch_performance(date, date, uuid),
  public.dashboard_summary(date, date, uuid) from public, anon;
grant execute on function public.reporting_sales_periods(date, date, uuid, text, text),
  public.reporting_sales(date, date, uuid, integer, integer, text),
  public.reporting_product_performance(date, date, uuid, text, uuid, uuid, text, integer, integer),
  public.reporting_sales_quantity_by_unit(date, date, uuid, text),
  public.reporting_product_filter_options(uuid),
  public.reporting_receivable_aging_current(uuid),
  public.reporting_stock_movements(date, date, uuid, integer, integer),
  public.reporting_inventory_current(uuid, integer, integer),
  public.reporting_branch_performance(date, date, uuid),
  public.dashboard_summary(date, date, uuid) to authenticated;
