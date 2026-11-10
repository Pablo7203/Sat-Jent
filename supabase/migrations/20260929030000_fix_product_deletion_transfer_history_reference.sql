-- Keep product deletion blocked when a variant has stock-transfer history.
-- The canonical transfer line table is stock_transfer_items.
create or replace function public.delete_unused_product(target_product_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  paths text[];
begin
  if not public.has_permission('products.delete') then
    raise exception 'Missing products.delete permission';
  end if;
  if not exists (
    select 1 from public.products p
    where p.id = target_product_id and p.status = 'DRAFT' and not p.is_public
  ) then
    raise exception 'Only internal draft products can be permanently deleted';
  end if;
  if exists (
    select 1
    from public.product_variants v
    where v.product_id = target_product_id
      and (
        exists (select 1 from public.branch_inventory bi where bi.variant_id = v.id)
        or exists (select 1 from public.stock_movements sm where sm.variant_id = v.id)
        or exists (select 1 from public.stock_adjustment_items sai where sai.variant_id = v.id)
        or exists (select 1 from public.stock_count_items sci where sci.variant_id = v.id)
        or exists (select 1 from public.purchase_items poi where poi.variant_id = v.id)
        or exists (select 1 from public.goods_receipt_items gri where gri.variant_id = v.id)
        or exists (select 1 from public.sale_items si where si.variant_id = v.id)
        or exists (select 1 from public.stock_transfer_items ti where ti.variant_id = v.id)
        or exists (select 1 from public.quotation_requests qr where qr.variant_id = v.id)
      )
  ) or exists (select 1 from public.quotation_requests qr where qr.product_id = target_product_id)
    or exists (select 1 from public.quotation_request_items qri where qri.product_id = target_product_id) then
    raise exception 'This product has operational history and must be archived instead';
  end if;

  select coalesce(array_agg(pi.storage_path), '{}'::text[]) into paths
  from public.product_images pi where pi.product_id = target_product_id;
  delete from public.product_images where product_id = target_product_id;
  delete from public.product_prices where variant_id in (select id from public.product_variants where product_id = target_product_id);
  delete from public.variant_attribute_values where variant_id in (select id from public.product_variants where product_id = target_product_id);
  delete from public.product_variants where product_id = target_product_id;
  delete from public.products where id = target_product_id;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id)
  values(auth.uid(), 'product.deleted', 'products', target_product_id);
  return paths;
end;
$$;
