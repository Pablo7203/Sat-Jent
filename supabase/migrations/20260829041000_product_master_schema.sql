-- SAT-J Ent Phase 2: normalized company-wide product master.
create type public.product_status as enum ('DRAFT', 'ACTIVE', 'ARCHIVED');
create type public.attribute_data_type as enum ('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT');
create type public.price_type as enum ('RETAIL', 'WHOLESALE');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text check (description is null or char_length(description) <= 1000),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create unique index categories_name_ci_unique on public.categories(lower(trim(name)));
create unique index categories_slug_ci_unique on public.categories(lower(trim(slug)));
create index categories_parent_sort_idx on public.categories(parent_id, sort_order, name);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text check (description is null or char_length(description) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brands_name_ci_unique on public.brands(lower(trim(name)));
create unique index brands_slug_ci_unique on public.brands(lower(trim(slug)));

create table public.units_of_measure (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code = upper(trim(code)) and code ~ '^[A-Z0-9_-]{1,20}$'),
  name text not null check (char_length(trim(name)) between 1 and 80),
  symbol text not null check (char_length(trim(symbol)) between 1 and 16),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index units_code_ci_unique on public.units_of_measure(lower(trim(code)));
create unique index units_name_ci_unique on public.units_of_measure(lower(trim(name)));

create table public.attributes (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code = upper(trim(code)) and code ~ '^[A-Z0-9_-]{2,40}$'),
  name text not null check (char_length(trim(name)) between 2 and 100),
  data_type public.attribute_data_type not null,
  description text check (description is null or char_length(description) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index attributes_code_ci_unique on public.attributes(lower(trim(code)));
create unique index attributes_name_ci_unique on public.attributes(lower(trim(name)));

create table public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.attributes(id) on delete restrict,
  value text not null check (char_length(trim(value)) between 1 and 160),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index attribute_values_value_ci_unique on public.attribute_values(attribute_id, lower(trim(value)));
create index attribute_values_attribute_sort_idx on public.attribute_values(attribute_id, sort_order, value);

create table public.category_attributes (
  category_id uuid not null references public.categories(id) on delete restrict,
  attribute_id uuid not null references public.attributes(id) on delete restrict,
  is_required boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_id, attribute_id)
);
create index category_attributes_attribute_idx on public.category_attributes(attribute_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 200),
  description text check (description is null or char_length(description) <= 5000),
  category_id uuid not null references public.categories(id) on delete restrict,
  brand_id uuid references public.brands(id) on delete restrict,
  unit_of_measure_id uuid not null references public.units_of_measure(id) on delete restrict,
  status public.product_status not null default 'DRAFT',
  is_public boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_name_idx on public.products(lower(name));
create index products_category_status_idx on public.products(category_id, status);
create index products_brand_status_idx on public.products(brand_id, status);
create index products_status_updated_idx on public.products(status, updated_at desc);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  sku text not null check (char_length(trim(sku)) between 1 and 80),
  barcode text check (barcode is null or char_length(trim(barcode)) between 1 and 80),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index product_variants_sku_ci_unique on public.product_variants(lower(trim(sku)));
create unique index product_variants_barcode_ci_unique on public.product_variants(lower(trim(barcode))) where barcode is not null;
create unique index product_variants_one_default on public.product_variants(product_id) where is_default;
create index product_variants_product_active_idx on public.product_variants(product_id, is_active);

create table public.variant_attribute_values (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  attribute_id uuid not null references public.attributes(id) on delete restrict,
  attribute_value_id uuid references public.attribute_values(id) on delete restrict,
  text_value text,
  number_value numeric(18,4),
  boolean_value boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (variant_id, attribute_id),
  check (num_nonnulls(attribute_value_id, text_value, number_value, boolean_value) = 1)
);
create index variant_attribute_values_attribute_idx on public.variant_attribute_values(attribute_id);

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  branch_id uuid references public.branches(id) on delete restrict,
  price_type public.price_type not null,
  currency text not null default 'GHS' check (currency = 'GHS'),
  amount numeric(14,2) not null check (amount >= 0),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);
create index product_prices_lookup_idx on public.product_prices(variant_id, branch_id, price_type, effective_from desc);
create index product_prices_current_idx on public.product_prices(variant_id, price_type) where effective_to is null;

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  storage_path text not null unique check (storage_path ~ '^products/[0-9a-f-]{36}/[A-Za-z0-9._/-]+$'),
  alt_text text check (alt_text is null or char_length(alt_text) <= 240),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index product_images_product_primary on public.product_images(product_id) where is_primary and variant_id is null;
create unique index product_images_variant_primary on public.product_images(variant_id) where is_primary and variant_id is not null;
create index product_images_product_sort_idx on public.product_images(product_id, variant_id, sort_order);

create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger brands_updated_at before update on public.brands for each row execute function public.set_updated_at();
create trigger units_updated_at before update on public.units_of_measure for each row execute function public.set_updated_at();
create trigger attributes_updated_at before update on public.attributes for each row execute function public.set_updated_at();
create trigger attribute_values_updated_at before update on public.attribute_values for each row execute function public.set_updated_at();
create trigger category_attributes_updated_at before update on public.category_attributes for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
create trigger variant_attribute_values_updated_at before update on public.variant_attribute_values for each row execute function public.set_updated_at();

create function public.validate_category_tree() returns trigger language plpgsql set search_path = '' as $$
declare ancestor uuid; depth integer := 0;
begin
  ancestor := new.parent_id;
  while ancestor is not null loop
    depth := depth + 1;
    if ancestor = new.id then raise exception 'A category cannot be its own ancestor'; end if;
    if depth > 4 then raise exception 'Category hierarchy cannot exceed four levels'; end if;
    select parent_id into ancestor from public.categories where id = ancestor;
  end loop;
  return new;
end;
$$;
create trigger validate_category_tree before insert or update of parent_id on public.categories for each row execute function public.validate_category_tree();

create function public.validate_attribute_definition() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.data_type is distinct from old.data_type and exists (
    select 1 from public.variant_attribute_values where attribute_id = old.id
  ) then raise exception 'Cannot change the data type of an attribute already in use'; end if;
  return new;
end;
$$;
create trigger validate_attribute_definition before update on public.attributes for each row execute function public.validate_attribute_definition();

create function public.validate_variant_attribute_value() returns trigger language plpgsql set search_path = '' as $$
declare expected_type public.attribute_data_type; product_category uuid; selected_attribute uuid; selected_active boolean;
begin
  select a.data_type into expected_type from public.attributes a where a.id = new.attribute_id and a.is_active;
  if expected_type is null then raise exception 'Attribute must be active'; end if;
  select p.category_id into product_category
    from public.product_variants v join public.products p on p.id = v.product_id where v.id = new.variant_id;
  if not exists (select 1 from public.category_attributes ca where ca.category_id = product_category and ca.attribute_id = new.attribute_id) then
    raise exception 'Attribute is not assigned to the product category';
  end if;
  if expected_type = 'SELECT' then
    if new.attribute_value_id is null then raise exception 'SELECT attributes require an allowed value'; end if;
    select attribute_id, is_active into selected_attribute, selected_active from public.attribute_values where id = new.attribute_value_id;
    if selected_attribute is distinct from new.attribute_id or not coalesce(selected_active, false) then raise exception 'Selected value is invalid or inactive'; end if;
  elsif expected_type = 'TEXT' and new.text_value is null then raise exception 'TEXT attributes require text_value';
  elsif expected_type = 'NUMBER' and new.number_value is null then raise exception 'NUMBER attributes require number_value';
  elsif expected_type = 'BOOLEAN' and new.boolean_value is null then raise exception 'BOOLEAN attributes require boolean_value';
  end if;
  return new;
end;
$$;
create trigger validate_variant_attribute_value before insert or update on public.variant_attribute_values for each row execute function public.validate_variant_attribute_value();

create function public.validate_product_category_change() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.category_id is distinct from old.category_id and exists (
    select 1 from public.variant_attribute_values vav
    join public.product_variants v on v.id = vav.variant_id
    where v.product_id = old.id and not exists (
      select 1 from public.category_attributes ca where ca.category_id = new.category_id and ca.attribute_id = vav.attribute_id
    )
  ) then raise exception 'New category does not support all existing variant attributes'; end if;
  return new;
end;
$$;
create trigger validate_product_category_change before update of category_id on public.products for each row execute function public.validate_product_category_change();

create function public.validate_product_activation() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'ACTIVE' and (tg_op = 'INSERT' or old.status is distinct from new.status or new.category_id is distinct from old.category_id or new.unit_of_measure_id is distinct from old.unit_of_measure_id) then
    if not exists (select 1 from public.categories where id = new.category_id and is_active) then raise exception 'Active products require an active category'; end if;
    if not exists (select 1 from public.units_of_measure where id = new.unit_of_measure_id and is_active) then raise exception 'Active products require an active unit of measure'; end if;
    if not exists (select 1 from public.product_variants where product_id = new.id and is_active and trim(sku) <> '') then raise exception 'Active products require at least one active variant with an SKU'; end if;
    if exists (
      select 1 from public.category_attributes ca
      cross join public.product_variants v
      where ca.category_id = new.category_id and ca.is_required and v.product_id = new.id and v.is_active
        and not exists (select 1 from public.variant_attribute_values vav where vav.variant_id = v.id and vav.attribute_id = ca.attribute_id)
    ) then raise exception 'Every active variant must contain all required category attributes'; end if;
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status and (new.status = 'ARCHIVED' or old.status = 'ARCHIVED')
     and not public.has_permission('products.archive') then raise exception 'Missing products.archive permission'; end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger validate_product_activation before insert or update on public.products for each row execute function public.validate_product_activation();

create function public.prevent_price_overlap() returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.product_prices p
    where p.id <> new.id and p.variant_id = new.variant_id and p.branch_id is not distinct from new.branch_id
      and p.price_type = new.price_type
      and tstzrange(p.effective_from, p.effective_to, '[)') && tstzrange(new.effective_from, new.effective_to, '[)')
  ) then raise exception 'Price effective periods cannot overlap for the same variant, branch, and type'; end if;
  return new;
end;
$$;
create trigger prevent_price_overlap before insert or update on public.product_prices for each row execute function public.prevent_price_overlap();

create function public.validate_product_image() returns trigger language plpgsql set search_path = '' as $$
declare variant_product uuid;
begin
  if split_part(new.storage_path, '/', 1) <> 'products' or split_part(new.storage_path, '/', 2) <> new.product_id::text then
    raise exception 'Image path must belong to its product';
  end if;
  if new.variant_id is not null then
    select product_id into variant_product from public.product_variants where id = new.variant_id;
    if variant_product is distinct from new.product_id then raise exception 'Image variant must belong to its product'; end if;
  end if;
  return new;
end;
$$;
create trigger validate_product_image before insert or update on public.product_images for each row execute function public.validate_product_image();
