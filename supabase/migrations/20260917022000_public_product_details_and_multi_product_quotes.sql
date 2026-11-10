-- Public product presentation and multi-product quotation requests.
-- Product variants remain an internal stock and price mechanism. Customers
-- select products, while staff can resolve a precise sellable option later.

alter table public.quotation_requests
  add column primary_product_count integer not null default 0;

create table public.quotation_request_items (
  id uuid primary key default gen_random_uuid(),
  quotation_request_id uuid not null references public.quotation_requests(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  quantity numeric(14,3) check (quantity is null or quantity > 0),
  created_at timestamptz not null default now(),
  unique (quotation_request_id, product_id)
);

create index quotation_request_items_request_idx on public.quotation_request_items(quotation_request_id);

alter table public.quotation_request_items enable row level security;

create policy quotation_items_read on public.quotation_request_items for select to authenticated using (
  exists (
    select 1
    from public.quotation_requests q
    where q.id = quotation_request_id
      and public.has_permission('quotations.read')
      and (q.preferred_branch_id is null or public.can_access_branch(q.preferred_branch_id))
  )
);

grant select on public.quotation_request_items to authenticated;

create function public.public_quote_products() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'name', p.name, 'category', c.name)
      order by c.name, p.name
    ),
    '[]'::jsonb
  )
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.status = 'ACTIVE' and p.is_public and c.is_active
$$;

create function public.public_best_sellers(item_limit integer default 4) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if item_limit not between 1 and 12 then raise exception 'Invalid product limit'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', ranked.slug, 'name', ranked.name, 'description', ranked.description,
    'category', ranked.category, 'category_slug', ranked.category_slug, 'brand', ranked.brand,
    'image_path', ranked.image_path, 'price', ranked.price, 'availability', ranked.availability
  ) order by ranked.units_sold desc, ranked.name), '[]'::jsonb)
  into result
  from (
    select p.slug,p.name,left(p.description,180) description,c.name category,c.slug category_slug,b.name brand,
      (select pi.storage_path from public.product_images pi where pi.product_id=p.id order by pi.is_primary desc,pi.sort_order,pi.created_at limit 1) image_path,
      case when p.show_price_online then (select min(pp.amount) from public.product_variants v join public.product_prices pp on pp.variant_id=v.id where v.product_id=p.id and v.is_active and pp.price_type='RETAIL' and pp.branch_id is null and pp.effective_from<=now() and (pp.effective_to is null or pp.effective_to>now())) end price,
      case when coalesce((select sum(bi.quantity_on_hand) from public.branch_inventory bi join public.branches br on br.id=bi.branch_id join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and br.is_active),0)<=0 then 'Currently unavailable' when exists(select 1 from public.branch_inventory bi join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and bi.quantity_on_hand>bi.minimum_stock_level) then 'Available' else 'Limited availability' end availability,
      sum(si.quantity) units_sold
    from public.sale_items si
    join public.sales s on s.id=si.sale_id and s.status='COMPLETED'
    join public.product_variants v on v.id=si.variant_id
    join public.products p on p.id=v.product_id
    join public.categories c on c.id=p.category_id
    left join public.brands b on b.id=p.brand_id
    where p.status='ACTIVE' and p.is_public and c.is_active
    group by p.id,p.slug,p.name,p.description,c.name,c.slug,b.name,p.show_price_online
    order by units_sold desc,p.name
    limit item_limit
  ) ranked;
  return result;
end;
$$;

create or replace function public.public_product(product_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
   'id',p.id,'slug',p.slug,'name',p.name,'description',p.description,
   'category',jsonb_build_object('name',c.name,'slug',c.slug),'brand',b.name,
   'unit',u.symbol,'size',p.size,'colour',p.colour,'show_price_online',p.show_price_online,
   'images',(select coalesce(jsonb_agg(jsonb_build_object('path',pi.storage_path,'alt',coalesce(pi.alt_text,p.name),'variant_id',pi.variant_id) order by pi.is_primary desc,pi.sort_order),'[]') from public.product_images pi where pi.product_id=p.id),
   'variants',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'sku',v.sku,'price',case when p.show_price_online then (select pp.amount from public.product_prices pp where pp.variant_id=v.id and pp.price_type='RETAIL' and pp.branch_id is null and pp.effective_from<=now() and (pp.effective_to is null or pp.effective_to>now()) order by pp.effective_from desc limit 1) end,'attributes',(select coalesce(jsonb_object_agg(a.name,coalesce(av.value,vav.text_value,vav.number_value::text,vav.boolean_value::text)),'{}') from public.variant_attribute_values vav join public.attributes a on a.id=vav.attribute_id left join public.attribute_values av on av.id=vav.attribute_value_id where vav.variant_id=v.id)) order by v.is_default desc,v.name),'[]') from public.product_variants v where v.product_id=p.id and v.is_active),
   'availability',case when coalesce((select sum(bi.quantity_on_hand) from public.branch_inventory bi join public.branches br on br.id=bi.branch_id join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and br.is_active),0)<=0 then 'Currently unavailable' when exists(select 1 from public.branch_inventory bi join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and bi.quantity_on_hand>bi.minimum_stock_level) then 'Available' else 'Limited availability' end,
   'related',(select coalesce(jsonb_agg(jsonb_build_object('slug',r.slug,'name',r.name)),'[]') from(select rp.slug,rp.name from public.products rp where rp.category_id=p.category_id and rp.id<>p.id and rp.status='ACTIVE' and rp.is_public order by rp.is_featured desc,rp.updated_at desc limit 4)r)
 )
 from public.products p join public.categories c on c.id=p.category_id left join public.brands b on b.id=p.brand_id join public.units_of_measure u on u.id=p.unit_of_measure_id where p.slug=product_slug and p.status='ACTIVE' and p.is_public
$$;

create function public.submit_quotation_request(
  visitor_name text,
  visitor_phone text,
  visitor_email text,
  visitor_company text,
  product_items jsonb,
  target_branch uuid,
  visitor_message text,
  honey text default null
) returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  next_no bigint;
  request_no text;
  new_request_id uuid;
  entry jsonb;
  target_product_id uuid;
  target_product_name text;
  target_quantity numeric(14,3);
  first_product_id uuid;
  first_product_name text;
  first_quantity numeric(14,3);
  item_count integer := 0;
  seen_products uuid[] := '{}'::uuid[];
begin
  if coalesce(honey, '') <> '' then raise exception 'Request rejected'; end if;
  if char_length(trim(visitor_name)) not between 2 and 160
    or char_length(trim(visitor_phone)) not between 5 and 40
    or (visitor_email is not null and visitor_email <> '' and visitor_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    or (visitor_message is not null and char_length(visitor_message) > 2000) then
    raise exception 'Check the quotation details';
  end if;
  if jsonb_typeof(coalesce(product_items, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(product_items, '[]'::jsonb)) > 20 then
    raise exception 'Choose up to 20 products';
  end if;
  if target_branch is not null and not exists(select 1 from public.branches b where b.id = target_branch and b.is_active and b.is_public) then
    raise exception 'Invalid branch';
  end if;
  if (select count(*) from public.quotation_requests q where q.phone = trim(visitor_phone) and q.created_at > now() - interval '5 minutes') >= 3 then
    raise exception 'Please wait before sending another request';
  end if;

  for entry in select value from jsonb_array_elements(coalesce(product_items, '[]'::jsonb)) loop
    if coalesce(entry->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid product selection';
    end if;
    target_product_id := (entry->>'product_id')::uuid;
    if target_product_id = any(seen_products) then raise exception 'Choose each product once'; end if;
    if nullif(trim(coalesce(entry->>'quantity', '')), '') is null then
      target_quantity := null;
    elsif (entry->>'quantity') !~ '^[0-9]+(\.[0-9]{1,3})?$' or (entry->>'quantity')::numeric <= 0 then
      raise exception 'Quantity must be a positive number';
    else
      target_quantity := (entry->>'quantity')::numeric;
    end if;
    select p.name into target_product_name from public.products p where p.id = target_product_id and p.status = 'ACTIVE' and p.is_public;
    if target_product_name is null then raise exception 'Invalid public product'; end if;
    item_count := item_count + 1;
    seen_products := array_append(seen_products, target_product_id);
    if first_product_id is null then
      first_product_id := target_product_id;
      first_product_name := target_product_name;
      first_quantity := target_quantity;
    end if;
  end loop;

  insert into public.quotation_number_sequences(year,last_number) values(extract(year from now())::int,1)
    on conflict(year) do update set last_number=public.quotation_number_sequences.last_number+1
    returning last_number into next_no;
  request_no := 'RFQ-' || extract(year from now())::int || '-' || lpad(next_no::text, 6, '0');
  insert into public.quotation_requests(request_number,name,phone,email,customer_company,product_id,product_name_snapshot,quantity,preferred_branch_id,message,status,source,primary_product_count)
    values(request_no,trim(visitor_name),trim(visitor_phone),nullif(trim(visitor_email),''),nullif(trim(visitor_company),''),first_product_id,first_product_name,first_quantity,target_branch,nullif(trim(visitor_message),''),'NEW',case when item_count > 0 then 'PRODUCT'::public.quotation_source else 'GENERAL_QUOTE'::public.quotation_source end,item_count)
    returning id into new_request_id;
  for entry in select value from jsonb_array_elements(coalesce(product_items, '[]'::jsonb)) loop
    target_product_id := (entry->>'product_id')::uuid;
    select p.name into target_product_name from public.products p where p.id = target_product_id;
    if nullif(trim(coalesce(entry->>'quantity', '')), '') is null then target_quantity := null; else target_quantity := (entry->>'quantity')::numeric; end if;
    insert into public.quotation_request_items(quotation_request_id,product_id,product_name_snapshot,quantity)
      values(new_request_id,target_product_id,target_product_name,target_quantity);
  end loop;
  return request_no;
end;
$$;

revoke all on function public.public_quote_products(), public.public_best_sellers(integer), public.submit_quotation_request(text,text,text,text,jsonb,uuid,text,text) from public;
grant execute on function public.public_quote_products(), public.public_best_sellers(integer), public.submit_quotation_request(text,text,text,text,jsonb,uuid,text,text) to anon, authenticated;
