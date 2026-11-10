-- Qualify output-column names inside the branch performance function so
-- PL/pgSQL does not confuse them with its RETURNS TABLE variables.
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
    select grouped_quantities.branch_id,
      jsonb_object_agg(grouped_quantities.unit_name, grouped_quantities.quantity) quantity_by_unit
    from (
      select e.branch_id, i.unit_name, sum(i.quantity)::numeric quantity
      from public.sales_revenue_events e
      join public.sales_revenue_event_items i
        on i.source_id = e.source_id and i.source_type = e.source_type
      where e.business_date between from_date and to_date
        and (target_branch is null or e.branch_id = target_branch)
      group by e.branch_id, i.unit_name
    ) grouped_quantities group by grouped_quantities.branch_id
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
