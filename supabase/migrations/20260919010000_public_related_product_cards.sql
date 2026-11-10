-- Related products use the same public-safe shape as catalogue cards so
-- customers can compare the image, price and availability at a glance.
create or replace function public.public_product(product_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
   'id',p.id,'slug',p.slug,'name',p.name,'description',p.description,
   'category',jsonb_build_object('name',c.name,'slug',c.slug),'brand',b.name,
   'unit',u.symbol,'size',p.size,'colour',p.colour,'show_price_online',p.show_price_online,
   'images',(select coalesce(jsonb_agg(jsonb_build_object('path',pi.storage_path,'alt',coalesce(pi.alt_text,p.name),'variant_id',pi.variant_id) order by pi.is_primary desc,pi.sort_order),'[]') from public.product_images pi where pi.product_id=p.id),
   'variants',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'sku',v.sku,'price',case when p.show_price_online then (select pp.amount from public.product_prices pp where pp.variant_id=v.id and pp.price_type='RETAIL' and pp.branch_id is null and pp.effective_from<=now() and (pp.effective_to is null or pp.effective_to>now()) order by pp.effective_from desc limit 1) end,'attributes',(select coalesce(jsonb_object_agg(a.name,coalesce(av.value,vav.text_value,vav.number_value::text,vav.boolean_value::text)),'{}') from public.variant_attribute_values vav join public.attributes a on a.id=vav.attribute_id left join public.attribute_values av on av.id=vav.attribute_value_id where vav.variant_id=v.id)) order by v.is_default desc,v.name),'[]') from public.product_variants v where v.product_id=p.id and v.is_active),
   'availability',case when coalesce((select sum(bi.quantity_on_hand) from public.branch_inventory bi join public.branches br on br.id=bi.branch_id join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and br.is_active),0)<=0 then 'Currently unavailable' when exists(select 1 from public.branch_inventory bi join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and bi.quantity_on_hand>bi.minimum_stock_level) then 'Available' else 'Limited availability' end,
   'related',(
     select coalesce(jsonb_agg(jsonb_build_object(
       'slug',r.slug,'name',r.name,'description',r.description,
       'category',r.category,'category_slug',r.category_slug,'brand',r.brand,
       'image_path',r.image_path,'price',r.price,'availability',r.availability
     ) order by r.is_featured desc,r.updated_at desc),'[]'::jsonb)
     from (
       select rp.slug,rp.name,rp.description,c2.name category,c2.slug category_slug,b2.name brand,
         rp.is_featured,rp.updated_at,
         (select pi.storage_path from public.product_images pi where pi.product_id=rp.id order by pi.is_primary desc,pi.sort_order,pi.created_at limit 1) image_path,
         case when rp.show_price_online then (select min(pp.amount) from public.product_variants rv join public.product_prices pp on pp.variant_id=rv.id where rv.product_id=rp.id and rv.is_active and pp.price_type='RETAIL' and pp.branch_id is null and pp.effective_from<=now() and (pp.effective_to is null or pp.effective_to>now())) end price,
         case when coalesce((select sum(bi.quantity_on_hand) from public.branch_inventory bi join public.branches br on br.id=bi.branch_id join public.product_variants rv on rv.id=bi.variant_id where rv.product_id=rp.id and br.is_active),0)<=0 then 'Currently unavailable' when exists(select 1 from public.branch_inventory bi join public.product_variants rv on rv.id=bi.variant_id where rv.product_id=rp.id and bi.quantity_on_hand>bi.minimum_stock_level) then 'Available' else 'Limited availability' end availability
       from public.products rp
       join public.categories c2 on c2.id=rp.category_id
       left join public.brands b2 on b2.id=rp.brand_id
       where rp.category_id=p.category_id and rp.id<>p.id and rp.status='ACTIVE' and rp.is_public and c2.is_active
       order by rp.is_featured desc,rp.updated_at desc
       limit 4
     ) r
   )
 )
 from public.products p join public.categories c on c.id=p.category_id left join public.brands b on b.id=p.brand_id join public.units_of_measure u on u.id=p.unit_of_measure_id where p.slug=product_slug and p.status='ACTIVE' and p.is_public
$$;
