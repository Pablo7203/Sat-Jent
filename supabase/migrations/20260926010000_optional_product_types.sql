-- Optional types add a useful product classification without changing the
-- category a product already belongs to (Tiles -> Floor tile, Doors -> Fire door).
create table public.product_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, category_id)
);
create unique index product_types_category_name_ci_unique
  on public.product_types(category_id, lower(trim(name)));
create index product_types_category_active_idx
  on public.product_types(category_id, is_active, name);

create trigger product_types_updated_at
  before update on public.product_types
  for each row execute function public.set_updated_at();
create trigger audit_product_types
  after insert or update on public.product_types
  for each row execute function public.audit_product_master_change();

alter table public.products add column product_type_id uuid;
alter table public.products
  add constraint products_product_type_category_fk
  foreign key (product_type_id, category_id)
  references public.product_types(id, category_id)
  on delete restrict;
create index products_product_type_idx on public.products(product_type_id)
  where product_type_id is not null;

create function public.validate_product_type_assignment()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.product_type_id is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.product_types pt
      where pt.id = new.product_type_id
        and pt.category_id = new.category_id
        and pt.is_active
    ) then
      raise exception 'A newly assigned product type must be active and belong to the selected category';
    end if;
  elsif new.product_type_id is distinct from old.product_type_id then
    if not exists (
      select 1 from public.product_types pt
      where pt.id = new.product_type_id
        and pt.category_id = new.category_id
        and pt.is_active
    ) then
      raise exception 'A newly assigned product type must be active and belong to the selected category';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_product_type_assignment() from public, anon, authenticated;
create trigger validate_product_type_assignment
  before insert or update of product_type_id, category_id on public.products
  for each row execute function public.validate_product_type_assignment();

alter table public.product_types enable row level security;
create policy product_types_read on public.product_types
  for select to authenticated using (public.has_permission('categories.read'));
create policy product_types_insert on public.product_types
  for insert to authenticated with check (public.has_permission('categories.manage'));
create policy product_types_update on public.product_types
  for update to authenticated using (public.has_permission('categories.manage'))
  with check (public.has_permission('categories.manage'));
grant select, insert, update on public.product_types to authenticated;

-- Retire the old overload so all new product creation calls pass the optional
-- type explicitly, and validate type/category association inside the insert.
drop function public.create_product_with_default_variant(
  text, text, uuid, uuid, uuid, boolean, public.product_status,
  text, text, text, numeric, numeric
);
create function public.create_product_with_default_variant(
  product_name text,
  product_description text,
  product_category_id uuid,
  product_brand_id uuid,
  product_unit_id uuid,
  product_is_public boolean,
  product_status public.product_status,
  variant_name text,
  variant_sku text,
  variant_barcode text,
  retail_amount numeric default null,
  wholesale_amount numeric default null,
  selected_product_type_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  new_product_id uuid;
  new_variant_id uuid;
  type_category_id uuid;
begin
  if not public.has_permission('products.create') then
    raise exception 'Missing products.create permission';
  end if;
  if product_status = 'ARCHIVED' then
    raise exception 'New products cannot be archived';
  end if;
  if selected_product_type_id is not null then
    select category_id into type_category_id
      from public.product_types
      where id = selected_product_type_id and is_active;
    if type_category_id is null or type_category_id <> product_category_id then
      raise exception 'Choose an active product type belonging to the selected category';
    end if;
  end if;

  insert into public.products(
    name, description, category_id, product_type_id, brand_id,
    unit_of_measure_id, is_public, status
  ) values (
    trim(product_name), nullif(trim(product_description), ''),
    product_category_id, selected_product_type_id, product_brand_id,
    product_unit_id, product_is_public, 'DRAFT'
  ) returning id into new_product_id;

  insert into public.product_variants(product_id, name, sku, barcode, is_default)
    values(new_product_id, trim(variant_name), trim(variant_sku),
      nullif(trim(variant_barcode), ''), true)
    returning id into new_variant_id;
  if retail_amount is not null then
    insert into public.product_prices(variant_id, price_type, amount)
      values(new_variant_id, 'RETAIL', retail_amount);
  end if;
  if wholesale_amount is not null then
    insert into public.product_prices(variant_id, price_type, amount)
      values(new_variant_id, 'WHOLESALE', wholesale_amount);
  end if;
  if product_status = 'ACTIVE' then
    update public.products set status = 'ACTIVE' where id = new_product_id;
  end if;
  return new_product_id;
end;
$$;
revoke all on function public.create_product_with_default_variant(
  text, text, uuid, uuid, uuid, boolean, public.product_status,
  text, text, text, numeric, numeric, uuid
) from public, anon, authenticated;
grant execute on function public.create_product_with_default_variant(
  text, text, uuid, uuid, uuid, boolean, public.product_status,
  text, text, text, numeric, numeric, uuid
) to authenticated;

create or replace function public.public_catalogue(
  search_text text default null,
  category_slug text default null,
  brand_slug text default null,
  sort_by text default 'recommended',
  page_number integer default 1,
  page_size integer default 12,
  attribute_filters jsonb default '{}'::jsonb
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if page_number < 1 or page_size not between 1 and 24
    or sort_by not in ('recommended', 'newest', 'name')
    or jsonb_typeof(coalesce(attribute_filters, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid catalogue filters';
  end if;
  select jsonb_build_object(
    'total', coalesce(max(q.total_count), 0),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'slug', q.slug, 'name', q.name, 'description', q.description,
      'category', q.category, 'category_slug', q.category_slug,
      'product_type', q.product_type, 'brand', q.brand,
      'image_path', q.image_path, 'price', q.price,
      'availability', q.availability
    ) order by q.row_order), '[]')
  ) into result
  from (
    select p.slug, p.name, left(p.description, 180) description,
      c.name category, c.slug category_slug, pt.name product_type, b.name brand,
      (select pi.storage_path from public.product_images pi
        where pi.product_id = p.id
        order by pi.is_primary desc, pi.sort_order, pi.created_at limit 1) image_path,
      case when p.show_price_online then (
        select min(pp.amount) from public.product_variants v
        join public.product_prices pp on pp.variant_id = v.id
        where v.product_id = p.id and v.is_active and pp.price_type = 'RETAIL'
          and pp.branch_id is null and pp.effective_from <= now()
          and (pp.effective_to is null or pp.effective_to > now())
      ) end price,
      case
        when coalesce((select sum(bi.quantity_on_hand)
          from public.branch_inventory bi
          join public.branches br on br.id = bi.branch_id
          join public.product_variants v on v.id = bi.variant_id
          where v.product_id = p.id and br.is_active), 0) <= 0
          then 'Currently unavailable'
        when exists(select 1 from public.branch_inventory bi
          join public.product_variants v on v.id = bi.variant_id
          where v.product_id = p.id and bi.quantity_on_hand > bi.minimum_stock_level)
          then 'Available'
        else 'Limited availability'
      end availability,
      row_number() over(order by
        case when sort_by = 'recommended' then p.is_featured::int end desc nulls last,
        case when sort_by = 'newest' then p.updated_at end desc nulls last,
        case when sort_by = 'name' then p.name end asc nulls last, p.name
      ) row_order,
      count(*) over() total_count
    from public.products p
    join public.categories c on c.id = p.category_id
    left join public.product_types pt on pt.id = p.product_type_id
    left join public.brands b on b.id = p.brand_id
    where p.status = 'ACTIVE' and p.is_public and c.is_active
      and (search_text is null or trim(search_text) = '' or
        concat_ws(' ', p.name, c.name, pt.name, b.name,
          (select string_agg(v.sku, ' ') from public.product_variants v where v.product_id = p.id)
        ) ilike '%' || trim(search_text) || '%')
      and (category_slug is null or c.slug = category_slug)
      and (brand_slug is null or b.slug = brand_slug)
      and (coalesce(attribute_filters, '{}'::jsonb) = '{}'::jsonb
        or (category_slug is not null and exists(
          select 1 from public.product_variants v
          where v.product_id = p.id and v.is_active and not exists(
            select 1 from jsonb_each_text(attribute_filters) requested
            where not exists(
              select 1 from public.variant_attribute_values vav
              join public.attributes a on a.id = vav.attribute_id
                and a.is_active and a.data_type = 'SELECT'
              join public.attribute_values av on av.id = vav.attribute_value_id
                and av.is_active
              join public.category_attributes ca on ca.attribute_id = a.id
                and ca.category_id = c.id
              where vav.variant_id = v.id
                and regexp_replace(lower(a.code), '[^a-z0-9]+', '-', 'g') = requested.key
                and trim(both '-' from regexp_replace(lower(av.value), '[^a-z0-9]+', '-', 'g')) = requested.value
            )
          )
        )))
    offset (page_number - 1) * page_size limit page_size
  ) q;
  return coalesce(result, jsonb_build_object('total', 0, 'items', '[]'::jsonb));
end;
$$;

create or replace function public.public_product(product_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'description', p.description,
    'category', jsonb_build_object('name', c.name, 'slug', c.slug),
    'product_type', pt.name, 'brand', b.name, 'unit', u.symbol,
    'size', p.size, 'colour', p.colour,
    'show_price_online', p.show_price_online,
    'images', (select coalesce(jsonb_agg(jsonb_build_object(
      'path', pi.storage_path, 'alt', coalesce(pi.alt_text, p.name),
      'variant_id', pi.variant_id
    ) order by pi.is_primary desc, pi.sort_order), '[]')
      from public.product_images pi where pi.product_id = p.id),
    'variants', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', v.id, 'name', v.name, 'sku', v.sku,
      'price', case when p.show_price_online then (
        select pp.amount from public.product_prices pp
        where pp.variant_id = v.id and pp.price_type = 'RETAIL'
          and pp.branch_id is null and pp.effective_from <= now()
          and (pp.effective_to is null or pp.effective_to > now())
        order by pp.effective_from desc limit 1
      ) end,
      'attributes', (select coalesce(jsonb_object_agg(a.name,
        coalesce(av.value, vav.text_value, vav.number_value::text, vav.boolean_value::text)), '{}')
        from public.variant_attribute_values vav
        join public.attributes a on a.id = vav.attribute_id
        left join public.attribute_values av on av.id = vav.attribute_value_id
        where vav.variant_id = v.id)
    ) order by v.is_default desc, v.name), '[]')
      from public.product_variants v where v.product_id = p.id and v.is_active),
    'availability', case
      when coalesce((select sum(bi.quantity_on_hand)
        from public.branch_inventory bi
        join public.branches br on br.id = bi.branch_id
        join public.product_variants v on v.id = bi.variant_id
        where v.product_id = p.id and br.is_active), 0) <= 0
        then 'Currently unavailable'
      when exists(select 1 from public.branch_inventory bi
        join public.product_variants v on v.id = bi.variant_id
        where v.product_id = p.id and bi.quantity_on_hand > bi.minimum_stock_level)
        then 'Available'
      else 'Limited availability'
    end,
    'related', (select coalesce(jsonb_agg(jsonb_build_object(
      'slug', r.slug, 'name', r.name, 'description', r.description,
      'category', r.category, 'category_slug', r.category_slug,
      'brand', r.brand, 'image_path', r.image_path,
      'price', r.price, 'availability', r.availability
    ) order by r.is_featured desc, r.updated_at desc), '[]'::jsonb)
      from (
        select rp.slug, rp.name, left(rp.description, 180) description,
          c2.name category, c2.slug category_slug, b2.name brand,
          rp.is_featured, rp.updated_at,
          (select pi.storage_path from public.product_images pi
            where pi.product_id = rp.id
            order by pi.is_primary desc, pi.sort_order, pi.created_at limit 1) image_path,
          case when rp.show_price_online then (
            select min(pp.amount) from public.product_variants rv
            join public.product_prices pp on pp.variant_id = rv.id
            where rv.product_id = rp.id and rv.is_active and pp.price_type = 'RETAIL'
              and pp.branch_id is null and pp.effective_from <= now()
              and (pp.effective_to is null or pp.effective_to > now())
          ) end price,
          case
            when coalesce((select sum(bi.quantity_on_hand)
              from public.branch_inventory bi
              join public.branches br on br.id = bi.branch_id
              join public.product_variants rv on rv.id = bi.variant_id
              where rv.product_id = rp.id and br.is_active), 0) <= 0
              then 'Currently unavailable'
            when exists(select 1 from public.branch_inventory bi
              join public.product_variants rv on rv.id = bi.variant_id
              where rv.product_id = rp.id and bi.quantity_on_hand > bi.minimum_stock_level)
              then 'Available'
            else 'Limited availability'
          end availability
        from public.products rp
        join public.categories c2 on c2.id = rp.category_id
        left join public.brands b2 on b2.id = rp.brand_id
        where rp.category_id = p.category_id and rp.id <> p.id
          and rp.status = 'ACTIVE' and rp.is_public and c2.is_active
        order by rp.is_featured desc, rp.updated_at desc limit 4
      ) r
    )
  )
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.product_types pt on pt.id = p.product_type_id
  left join public.brands b on b.id = p.brand_id
  join public.units_of_measure u on u.id = p.unit_of_measure_id
  where p.slug = product_slug and p.status = 'ACTIVE' and p.is_public
$$;

revoke all on function public.public_catalogue(text, text, text, text, integer, integer, jsonb),
  public.public_product(text) from public;
grant execute on function public.public_catalogue(text, text, text, text, integer, integer, jsonb),
  public.public_product(text) to anon, authenticated;
