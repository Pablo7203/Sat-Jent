-- Public catalogue entries must always have a product image.
create function public.validate_public_product_image_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_public
    and (tg_op = 'INSERT' or old.is_public is distinct from new.is_public)
    and not exists (
      select 1 from public.product_images where product_id = new.id
    ) then
    raise exception 'Upload at least one product image before making a product public';
  end if;
  return new;
end;
$$;

create trigger validate_public_product_image_requirement
before insert or update of is_public on public.products
for each row execute function public.validate_public_product_image_requirement();

create function public.prevent_last_public_product_image_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.products where id = old.product_id and is_public
  ) and not exists (
    select 1 from public.product_images
    where product_id = old.product_id and id <> old.id
  ) then
    raise exception 'Make the product internal before removing its final image';
  end if;
  return old;
end;
$$;

create trigger prevent_last_public_product_image_deletion
before delete on public.product_images
for each row execute function public.prevent_last_public_product_image_deletion();
