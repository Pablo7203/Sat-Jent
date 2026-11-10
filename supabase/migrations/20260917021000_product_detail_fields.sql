alter table public.products
  add column size text check (size is null or char_length(trim(size)) <= 160),
  add column colour text check (colour is null or char_length(trim(colour)) <= 160);

create function public.set_new_product_details(
  target_product_id uuid,
  product_size text default null,
  product_colour text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_permission('products.create') then
    raise exception 'Missing products.create permission';
  end if;
  update public.products
    set size = nullif(trim(product_size), ''), colour = nullif(trim(product_colour), '')
    where id = target_product_id and created_by = auth.uid();
  if not found then raise exception 'Product not found'; end if;
end;
$$;

revoke all on function public.set_new_product_details(uuid, text, text) from public;
grant execute on function public.set_new_product_details(uuid, text, text) to authenticated;
