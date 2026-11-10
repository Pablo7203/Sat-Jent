-- Enforce active branch access at the database boundary for branch pricing.
create or replace function public.change_product_price(
  target_variant_id uuid, target_branch_id uuid, target_price_type public.price_type,
  new_amount numeric, starts_at timestamptz default now()
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_price_id uuid;
begin
  if target_branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = target_branch_id and b.is_active and public.can_access_branch(b.id)
  ) then
    raise exception 'You cannot update prices for this branch';
  end if;
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
