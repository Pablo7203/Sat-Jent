-- Phase 2: use the existing variant SKU as the owner-defined Item Code.
-- Keep historical transaction snapshots immutable while variant UUIDs remain
-- the permanent link from sales, purchases and stock movements.

create extension if not exists pg_trgm with schema extensions;

drop index if exists public.product_variants_sku_ci_unique;
create unique index product_variants_sku_ci_unique
  on public.product_variants(
    lower(regexp_replace(sku, '^[[:space:]]+|[[:space:]]+$', '', 'g'))
  );

create index if not exists products_name_trgm_idx
  on public.products using gin (lower(name) extensions.gin_trgm_ops);

create view public.sellable_product_catalog
with (security_invoker = true) as
select
  v.id as variant_id,
  p.id as product_id,
  p.name as product_name,
  p.status,
  v.name as variant_name,
  v.sku as item_code,
  v.barcode,
  v.is_default,
  v.is_active as variant_is_active,
  p.category_id,
  c.name as category_name,
  p.brand_id,
  b.name as brand_name,
  u.name as unit_name,
  u.code as unit_code,
  u.symbol as unit_symbol,
  p.size,
  p.colour,
  p.updated_at,
  (select pp.amount from public.product_prices pp
    where pp.variant_id = v.id and pp.branch_id is null and pp.price_type = 'RETAIL'
      and pp.effective_from <= now() and (pp.effective_to is null or pp.effective_to > now())
    order by pp.effective_from desc limit 1) as standard_retail_price,
  (select pi.storage_path from public.product_images pi
    where pi.product_id = p.id
    order by pi.is_primary desc, pi.sort_order, pi.created_at limit 1) as image_path,
  concat_ws(' ', p.name, v.name, v.sku, v.barcode, c.name, b.name) as search_terms
from public.product_variants v
join public.products p on p.id = v.product_id
join public.categories c on c.id = p.category_id
left join public.brands b on b.id = p.brand_id
join public.units_of_measure u on u.id = p.unit_of_measure_id;
grant select on public.sellable_product_catalog to authenticated;

create or replace view public.product_catalog_search
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.status,
  p.is_public,
  p.category_id,
  c.name as category_name,
  p.brand_id,
  b.name as brand_name,
  p.unit_of_measure_id,
  u.code as unit_code,
  p.updated_at,
  v.sku as default_sku,
  v.barcode as default_barcode,
  concat_ws(
    ' ',
    p.name,
    c.name,
    b.name,
    (select string_agg(concat_ws(' ', av.sku, av.barcode), ' ')
       from public.product_variants av where av.product_id = p.id)
  ) as search_terms,
  (select pi.storage_path from public.product_images pi
    where pi.product_id = p.id
    order by pi.is_primary desc, pi.sort_order, pi.created_at limit 1) as image_path,
  v.id as default_variant_id,
  v.name as default_variant_name,
  (select pp.amount from public.product_prices pp
    where pp.variant_id = v.id and pp.branch_id is null and pp.price_type = 'RETAIL'
      and pp.effective_from <= now() and (pp.effective_to is null or pp.effective_to > now())
    order by pp.effective_from desc limit 1) as standard_retail_price
from public.products p
join public.categories c on c.id = p.category_id
left join public.brands b on b.id = p.brand_id
join public.units_of_measure u on u.id = p.unit_of_measure_id
left join public.product_variants v on v.product_id = p.id and v.is_default;

create function public.normalize_variant_item_code()
returns trigger
language plpgsql set search_path = '' as $$
begin
  new.sku := regexp_replace(btrim(coalesce(new.sku, '')), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  return new;
end;
$$;
revoke all on function public.normalize_variant_item_code() from public, anon, authenticated;

create trigger normalize_variant_item_code
before insert or update of sku on public.product_variants
for each row execute function public.normalize_variant_item_code();

create function public.guard_variant_item_code_change()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.sku is distinct from old.sku
    and current_setting('app.allow_item_code_change', true) is distinct from 'on' then
    raise exception 'Item Codes must be changed through the audited Item Code workflow';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_variant_item_code_change() from public, anon, authenticated;

create trigger guard_variant_item_code_change
before update of sku on public.product_variants
for each row execute function public.guard_variant_item_code_change();

create function public.update_variant_item_code(
  target_variant_id uuid,
  new_item_code text,
  confirm_history boolean default false
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  normalized_code text := regexp_replace(btrim(coalesce(new_item_code, '')), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  has_history boolean;
  current_code text;
begin
  if not public.has_permission('products.update') then
    raise exception 'Missing products.update permission';
  end if;
  if char_length(normalized_code) not between 1 and 80 then
    raise exception 'Item Code must be between 1 and 80 characters';
  end if;
  select sku into current_code from public.product_variants where id = target_variant_id for update;
  if not found then
    raise exception 'Product variant not found';
  end if;
  if lower(current_code) = lower(normalized_code) then
    return false;
  end if;

  select
    exists(select 1 from public.stock_movements where variant_id = target_variant_id)
    or exists(select 1 from public.sale_items where variant_id = target_variant_id)
    or exists(select 1 from public.purchase_items where variant_id = target_variant_id)
    or exists(select 1 from public.goods_receipt_items where variant_id = target_variant_id)
    or exists(select 1 from public.stock_transfer_items where variant_id = target_variant_id)
    or exists(select 1 from public.quotation_requests where variant_id = target_variant_id)
  into has_history;

  if has_history and not confirm_history then
    raise exception 'This item has history. Confirm that historical records keep their original snapshots.';
  end if;

  perform set_config('app.allow_item_code_change', 'on', true);
  update public.product_variants
     set sku = normalized_code, updated_at = now()
   where id = target_variant_id;
  return has_history;
end;
$$;

revoke all on function public.update_variant_item_code(uuid, text, boolean) from public, anon;
grant execute on function public.update_variant_item_code(uuid, text, boolean) to authenticated;

create function public.search_inventory_products(
  search_text text,
  selected_branch_id uuid default null,
  result_limit integer default 12
) returns table (
  product_id uuid,
  variant_id uuid,
  item_code text,
  product_name text,
  variant_name text,
  category_name text,
  brand_name text,
  unit_name text,
  unit_code text,
  unit_symbol text,
  image_path text,
  inventory_id uuid,
  quantity_on_hand numeric,
  minimum_stock_level numeric,
  stock_status text,
  standard_selling_price numeric,
  branch_breakdown jsonb
)
language plpgsql stable security invoker set search_path = '' as $$
declare
  normalized_query text := lower(btrim(coalesce(search_text, '')));
begin
  normalized_query := regexp_replace(normalized_query, '[%_\\]', '', 'g');
  if not public.has_permission('inventory.read') then
    raise exception 'Missing inventory.read permission';
  end if;
  if char_length(normalized_query) < 1 then
    return;
  end if;
  if selected_branch_id is not null and not exists (
    select 1 from public.branches b
     where b.id = selected_branch_id and b.is_active and public.can_access_branch(b.id)
  ) then
    raise exception 'You cannot access the selected branch';
  end if;

  return query
  with matches as (
    select
      p.id as matched_product_id,
      v.id as matched_variant_id,
      p.name as matched_product_name,
      v.name as matched_variant_name,
      v.sku as matched_item_code,
      c.name as matched_category_name,
      br.name as matched_brand_name,
      u.name as matched_unit_name,
      u.code as matched_unit_code,
      u.symbol as matched_unit_symbol,
      (select pi.storage_path from public.product_images pi
        where pi.product_id = p.id
        order by pi.is_primary desc, pi.sort_order, pi.created_at limit 1) as matched_image_path,
      case
        when lower(btrim(v.sku)) = normalized_query then 0
        when lower(btrim(v.sku)) like normalized_query || '%' then 1
        when lower(p.name) like normalized_query || '%' then 2
        when lower(v.name) like normalized_query || '%' then 3
        else 4
      end as match_rank
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join public.categories c on c.id = p.category_id
    left join public.brands br on br.id = p.brand_id
    join public.units_of_measure u on u.id = p.unit_of_measure_id
    where v.is_active and p.status = 'ACTIVE'
      and (
        lower(btrim(v.sku)) like '%' || normalized_query || '%'
        or lower(coalesce(v.barcode, '')) like '%' || normalized_query || '%'
        or lower(p.name) like '%' || normalized_query || '%'
        or lower(v.name) like '%' || normalized_query || '%'
        or lower(coalesce(br.name, '')) like '%' || normalized_query || '%'
      )
    order by match_rank, p.name, v.name, v.sku
    limit greatest(1, least(coalesce(result_limit, 12), 20))
  )
  select
    m.matched_product_id,
    m.matched_variant_id,
    m.matched_item_code,
    m.matched_product_name,
    m.matched_variant_name,
    m.matched_category_name,
    m.matched_brand_name,
    m.matched_unit_name,
    m.matched_unit_code,
    m.matched_unit_symbol,
    m.matched_image_path,
    case when selected_branch_id is not null then max(bi.id::text)::uuid else null end,
    case when count(bi.id) = 0 then null else sum(bi.quantity_on_hand) end,
    case when count(bi.id) = 0 then null else sum(bi.minimum_stock_level) end,
    case
      when count(bi.id) = 0 then 'NOT_INITIALIZED'
      when sum(bi.quantity_on_hand) = 0 then 'OUT_OF_STOCK'
      when sum(bi.quantity_on_hand) <= sum(bi.minimum_stock_level) then 'LOW_STOCK'
      else 'IN_STOCK'
    end,
    (select pp.amount
       from public.product_prices pp
      where pp.variant_id = m.matched_variant_id
        and pp.price_type = 'RETAIL'
        and pp.effective_from <= now()
        and (pp.effective_to is null or pp.effective_to > now())
        and (pp.branch_id is null or pp.branch_id = selected_branch_id)
      order by case when selected_branch_id is not null and pp.branch_id = selected_branch_id then 0 else 1 end,
               pp.effective_from desc
      limit 1),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'branchId', b.id,
          'branchName', b.name,
          'quantity', bi.quantity_on_hand,
          'minimum', bi.minimum_stock_level,
          'status', case when bi.quantity_on_hand = 0 then 'OUT_OF_STOCK'
            when bi.quantity_on_hand <= bi.minimum_stock_level then 'LOW_STOCK' else 'IN_STOCK' end
        ) order by b.name
      ) filter (where bi.id is not null),
      '[]'::jsonb
    )
  from matches m
  left join public.branch_inventory bi
    on bi.variant_id = m.matched_variant_id
   and (selected_branch_id is null or bi.branch_id = selected_branch_id)
   and public.can_access_branch(bi.branch_id)
   and exists (select 1 from public.branches active_branch where active_branch.id = bi.branch_id and active_branch.is_active)
  left join public.branches b on b.id = bi.branch_id and b.is_active
  group by m.matched_product_id, m.matched_variant_id, m.matched_item_code,
    m.matched_product_name, m.matched_variant_name, m.matched_category_name,
    m.matched_brand_name, m.matched_unit_name, m.matched_unit_code,
    m.matched_unit_symbol, m.matched_image_path, m.match_rank
  order by m.match_rank, m.matched_product_name, m.matched_variant_name;
end;
$$;

revoke all on function public.search_inventory_products(text, uuid, integer) from public, anon;
grant execute on function public.search_inventory_products(text, uuid, integer) to authenticated;
