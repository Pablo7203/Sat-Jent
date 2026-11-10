-- SAT-J Ent Phase 2: product RLS, audited workflows, and image Storage security.
create function public.audit_product_master_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare old_doc jsonb; new_doc jsonb; entity_uuid uuid; action_name text;
begin
  old_doc := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_doc := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  entity_uuid := coalesce(
    nullif(coalesce(new_doc, old_doc) ->> 'id', '')::uuid,
    nullif(coalesce(new_doc, old_doc) ->> 'category_id', '')::uuid,
    nullif(coalesce(new_doc, old_doc) ->> 'variant_id', '')::uuid
  );
  action_name := lower(tg_table_name || '.' || tg_op);
  if tg_table_name = 'products' and tg_op = 'INSERT' then action_name := 'product.created';
  elsif tg_table_name = 'products' and tg_op = 'UPDATE' and new_doc ->> 'status' is distinct from old_doc ->> 'status' then
    action_name := case new_doc ->> 'status' when 'ARCHIVED' then 'product.archived' when 'ACTIVE' then 'product.activated' else 'product.status_changed' end;
  elsif tg_table_name = 'products' and tg_op = 'UPDATE' then action_name := 'product.updated';
  elsif tg_table_name = 'product_variants' then action_name := 'product.variant_' || lower(tg_op);
  elsif tg_table_name = 'product_prices' then action_name := 'product.price_' || lower(tg_op);
  elsif tg_table_name = 'product_images' then action_name := 'product.image_' || lower(tg_op);
  end if;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, old_values, new_values)
  values(auth.uid(), action_name, tg_table_name, entity_uuid, old_doc, new_doc);
  return coalesce(new, old);
end;
$$;

create trigger audit_categories after insert or update on public.categories for each row execute function public.audit_product_master_change();
create trigger audit_brands after insert or update on public.brands for each row execute function public.audit_product_master_change();
create trigger audit_units after insert or update on public.units_of_measure for each row execute function public.audit_product_master_change();
create trigger audit_attributes after insert or update on public.attributes for each row execute function public.audit_product_master_change();
create trigger audit_attribute_values after insert or update on public.attribute_values for each row execute function public.audit_product_master_change();
create trigger audit_category_attributes after insert or update or delete on public.category_attributes for each row execute function public.audit_product_master_change();
create trigger audit_products after insert or update on public.products for each row execute function public.audit_product_master_change();
create trigger audit_product_variants after insert or update on public.product_variants for each row execute function public.audit_product_master_change();
create trigger audit_variant_attribute_values after insert or update or delete on public.variant_attribute_values for each row execute function public.audit_product_master_change();
create trigger audit_product_prices after insert or update on public.product_prices for each row execute function public.audit_product_master_change();
create trigger audit_product_images after insert or update or delete on public.product_images for each row execute function public.audit_product_master_change();

alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.units_of_measure enable row level security;
alter table public.attributes enable row level security;
alter table public.attribute_values enable row level security;
alter table public.category_attributes enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_attribute_values enable row level security;
alter table public.product_prices enable row level security;
alter table public.product_images enable row level security;

create policy categories_read on public.categories for select to authenticated using (public.has_permission('categories.read'));
create policy categories_insert on public.categories for insert to authenticated with check (public.has_permission('categories.manage'));
create policy categories_update on public.categories for update to authenticated using (public.has_permission('categories.manage')) with check (public.has_permission('categories.manage'));
create policy brands_read on public.brands for select to authenticated using (public.has_permission('brands.read'));
create policy brands_insert on public.brands for insert to authenticated with check (public.has_permission('brands.manage'));
create policy brands_update on public.brands for update to authenticated using (public.has_permission('brands.manage')) with check (public.has_permission('brands.manage'));
create policy units_read on public.units_of_measure for select to authenticated using (public.has_permission('units.read'));
create policy units_insert on public.units_of_measure for insert to authenticated with check (public.has_permission('units.manage'));
create policy units_update on public.units_of_measure for update to authenticated using (public.has_permission('units.manage')) with check (public.has_permission('units.manage'));
create policy attributes_read on public.attributes for select to authenticated using (public.has_permission('product_attributes.read'));
create policy attributes_insert on public.attributes for insert to authenticated with check (public.has_permission('product_attributes.manage'));
create policy attributes_update on public.attributes for update to authenticated using (public.has_permission('product_attributes.manage')) with check (public.has_permission('product_attributes.manage'));
create policy attribute_values_read on public.attribute_values for select to authenticated using (public.has_permission('product_attributes.read'));
create policy attribute_values_insert on public.attribute_values for insert to authenticated with check (public.has_permission('product_attributes.manage'));
create policy attribute_values_update on public.attribute_values for update to authenticated using (public.has_permission('product_attributes.manage')) with check (public.has_permission('product_attributes.manage'));
create policy category_attributes_read on public.category_attributes for select to authenticated using (public.has_permission('product_attributes.read'));
create policy category_attributes_insert on public.category_attributes for insert to authenticated with check (public.has_permission('product_attributes.manage'));
create policy category_attributes_update on public.category_attributes for update to authenticated using (public.has_permission('product_attributes.manage')) with check (public.has_permission('product_attributes.manage'));
create policy category_attributes_delete on public.category_attributes for delete to authenticated using (public.has_permission('product_attributes.manage'));
create policy products_read on public.products for select to authenticated using (public.has_permission('products.read'));
create policy products_insert on public.products for insert to authenticated with check (public.has_permission('products.create'));
create policy products_update on public.products for update to authenticated using (public.has_permission('products.update')) with check (public.has_permission('products.update'));
create policy variants_read on public.product_variants for select to authenticated using (public.has_permission('products.read'));
create policy variants_insert on public.product_variants for insert to authenticated with check (public.has_permission('products.create'));
create policy variants_update on public.product_variants for update to authenticated using (public.has_permission('products.update')) with check (public.has_permission('products.update'));
create policy variant_attributes_read on public.variant_attribute_values for select to authenticated using (public.has_permission('products.read'));
create policy variant_attributes_insert on public.variant_attribute_values for insert to authenticated with check (public.has_permission('products.create'));
create policy variant_attributes_update on public.variant_attribute_values for update to authenticated using (public.has_permission('products.update')) with check (public.has_permission('products.update'));
create policy variant_attributes_delete on public.variant_attribute_values for delete to authenticated using (public.has_permission('products.update'));
create policy prices_read on public.product_prices for select to authenticated using (public.has_permission('product_prices.read'));
create policy prices_insert on public.product_prices for insert to authenticated with check (public.has_permission('product_prices.manage'));
create policy prices_update on public.product_prices for update to authenticated using (public.has_permission('product_prices.manage')) with check (public.has_permission('product_prices.manage'));
create policy product_images_read on public.product_images for select to authenticated using (public.has_permission('products.read'));
create policy product_images_insert on public.product_images for insert to authenticated with check (public.has_permission('product_images.manage'));
create policy product_images_update on public.product_images for update to authenticated using (public.has_permission('product_images.manage')) with check (public.has_permission('product_images.manage'));
create policy product_images_delete on public.product_images for delete to authenticated using (public.has_permission('product_images.manage'));

grant select on public.categories, public.brands, public.units_of_measure, public.attributes,
  public.attribute_values, public.category_attributes, public.products, public.product_variants,
  public.variant_attribute_values, public.product_prices, public.product_images to authenticated;
grant insert, update on public.categories, public.brands, public.units_of_measure, public.attributes,
  public.attribute_values, public.products, public.product_variants, public.product_prices to authenticated;
grant insert, update, delete on public.category_attributes, public.variant_attribute_values, public.product_images to authenticated;

create function public.create_product_with_default_variant(
  product_name text, product_description text, product_category_id uuid, product_brand_id uuid,
  product_unit_id uuid, product_is_public boolean, product_status public.product_status,
  variant_name text, variant_sku text, variant_barcode text,
  retail_amount numeric default null, wholesale_amount numeric default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_product_id uuid; new_variant_id uuid;
begin
  if not public.has_permission('products.create') then raise exception 'Missing products.create permission'; end if;
  if product_status = 'ARCHIVED' then raise exception 'New products cannot be archived'; end if;
  insert into public.products(name, description, category_id, brand_id, unit_of_measure_id, is_public, status)
  values(trim(product_name), nullif(trim(product_description), ''), product_category_id, product_brand_id, product_unit_id, product_is_public, 'DRAFT')
  returning id into new_product_id;
  insert into public.product_variants(product_id, name, sku, barcode, is_default)
  values(new_product_id, trim(variant_name), trim(variant_sku), nullif(trim(variant_barcode), ''), true)
  returning id into new_variant_id;
  if retail_amount is not null then
    insert into public.product_prices(variant_id, price_type, amount) values(new_variant_id, 'RETAIL', retail_amount);
  end if;
  if wholesale_amount is not null then
    insert into public.product_prices(variant_id, price_type, amount) values(new_variant_id, 'WHOLESALE', wholesale_amount);
  end if;
  if product_status = 'ACTIVE' then update public.products set status = 'ACTIVE' where id = new_product_id; end if;
  return new_product_id;
end;
$$;

create function public.change_product_price(
  target_variant_id uuid, target_branch_id uuid, target_price_type public.price_type,
  new_amount numeric, starts_at timestamptz default now()
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_price_id uuid;
begin
  if not public.has_permission('product_prices.manage') then raise exception 'Missing product_prices.manage permission'; end if;
  if new_amount < 0 then raise exception 'Price cannot be negative'; end if;
  update public.product_prices set effective_to = starts_at
  where variant_id = target_variant_id and branch_id is not distinct from target_branch_id
    and price_type = target_price_type and effective_from < starts_at
    and (effective_to is null or effective_to > starts_at);
  insert into public.product_prices(variant_id, branch_id, price_type, amount, effective_from)
  values(target_variant_id, target_branch_id, target_price_type, new_amount, starts_at)
  returning id into new_price_id;
  return new_price_id;
end;
$$;

revoke all on function public.create_product_with_default_variant(text,text,uuid,uuid,uuid,boolean,public.product_status,text,text,text,numeric,numeric) from public;
revoke all on function public.change_product_price(uuid,uuid,public.price_type,numeric,timestamptz) from public;
grant execute on function public.create_product_with_default_variant(text,text,uuid,uuid,uuid,boolean,public.product_status,text,text,text,numeric,numeric) to authenticated;
grant execute on function public.change_product_price(uuid,uuid,public.price_type,numeric,timestamptz) to authenticated;

create view public.product_catalog_search with (security_invoker = true) as
select p.id, p.name, p.status, p.is_public, p.category_id, c.name as category_name,
  p.brand_id, b.name as brand_name, p.unit_of_measure_id, u.code as unit_code,
  p.updated_at, v.sku as default_sku, v.barcode as default_barcode,
  concat_ws(' ', p.name, c.name, b.name, (select string_agg(concat_ws(' ', av.sku, av.barcode), ' ') from public.product_variants av where av.product_id = p.id)) as search_terms,
  (select pi.storage_path from public.product_images pi where pi.product_id = p.id order by pi.is_primary desc, pi.sort_order, pi.created_at limit 1) as image_path
from public.products p
join public.categories c on c.id = p.category_id
left join public.brands b on b.id = p.brand_id
join public.units_of_measure u on u.id = p.unit_of_measure_id
left join public.product_variants v on v.product_id = p.id and v.is_default;
grant select on public.product_catalog_search to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function public.is_valid_product_image_path(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select (storage.foldername(object_name))[1] = 'products'
    and exists (select 1 from public.products p where p.id::text = (storage.foldername(object_name))[2]);
$$;
revoke all on function public.is_valid_product_image_path(text) from public;
grant execute on function public.is_valid_product_image_path(text) to authenticated;

create policy product_images_public_read on storage.objects for select to public using (bucket_id = 'product-images');
create policy product_images_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'product-images' and public.has_permission('product_images.manage')
  and public.is_valid_product_image_path(name)
);
create policy product_images_storage_update on storage.objects for update to authenticated using (
  bucket_id = 'product-images' and public.has_permission('product_images.manage')
) with check (
  bucket_id = 'product-images' and public.has_permission('product_images.manage')
  and public.is_valid_product_image_path(name)
);
create policy product_images_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'product-images' and public.has_permission('product_images.manage')
  and public.is_valid_product_image_path(name)
);
