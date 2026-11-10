-- Direct product updates must not bypass the category/active-type checks used
-- by the create-product workflow. Existing assignments remain valid if a type
-- is later deactivated; assigning an inactive type to a different product is
-- rejected.
create or replace function public.validate_product_type_assignment()
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
revoke all on function public.validate_product_type_assignment()
  from public, anon, authenticated;
drop trigger if exists validate_product_type_assignment on public.products;
create trigger validate_product_type_assignment
  before insert or update of product_type_id, category_id on public.products
  for each row execute function public.validate_product_type_assignment();
notify pgrst, 'reload schema';
