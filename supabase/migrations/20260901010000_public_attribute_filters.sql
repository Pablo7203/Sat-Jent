-- Phase 8 closure: category-safe public attribute facets and same-variant matching.
create function public.public_attribute_filters(target_category_slug text) returns jsonb
language sql stable security definer set search_path='' as $$
 with eligible as (
  select distinct a.id attribute_id,a.code,a.name,ca.sort_order,av.id value_id,av.value,
   regexp_replace(lower(a.code),'[^a-z0-9]+','-','g') attribute_key,
   trim(both '-' from regexp_replace(lower(av.value),'[^a-z0-9]+','-','g')) value_key
  from public.categories c
  join public.category_attributes ca on ca.category_id=c.id
  join public.attributes a on a.id=ca.attribute_id and a.is_active and a.data_type='SELECT'
  join public.attribute_values av on av.attribute_id=a.id and av.is_active
  join public.variant_attribute_values vav on vav.attribute_id=a.id and vav.attribute_value_id=av.id
  join public.product_variants v on v.id=vav.variant_id and v.is_active
  join public.products p on p.id=v.product_id and p.category_id=c.id and p.status='ACTIVE' and p.is_public
  where c.is_active and c.slug=target_category_slug
 ), attributes as (
  select e.attribute_id,e.code,e.name,e.sort_order,e.attribute_key,
   jsonb_agg(jsonb_build_object('key',e.value_key,'label',e.value) order by e.value) values
  from eligible e where e.value_key<>''
  group by e.attribute_id,e.code,e.name,e.sort_order,e.attribute_key
 )
 select coalesce(jsonb_agg(jsonb_build_object('key',attribute_key,'code',code,'name',name,'values',values) order by sort_order,name),'[]'::jsonb) from attributes
$$;

drop function public.public_catalogue(text,text,text,text,integer,integer);
create function public.public_catalogue(search_text text default null,category_slug text default null,brand_slug text default null,sort_by text default 'recommended',page_number integer default 1,page_size integer default 12,attribute_filters jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if page_number<1 or page_size not between 1 and 24 or sort_by not in('recommended','newest','name') or jsonb_typeof(coalesce(attribute_filters,'{}'::jsonb))<>'object' then raise exception 'Invalid catalogue filters';end if;
 select jsonb_build_object('total',coalesce(max(q.total_count),0),'items',coalesce(jsonb_agg(jsonb_build_object('slug',q.slug,'name',q.name,'description',q.description,'category',q.category,'category_slug',q.category_slug,'brand',q.brand,'image_path',q.image_path,'price',q.price,'availability',q.availability) order by q.row_order),'[]')) into result from(
  select p.slug,p.name,left(p.description,180) description,c.name category,c.slug category_slug,b.name brand,
   (select pi.storage_path from public.product_images pi where pi.product_id=p.id order by pi.is_primary desc,pi.sort_order,pi.created_at limit 1) image_path,
   case when p.show_price_online then (select min(pp.amount) from public.product_variants v join public.product_prices pp on pp.variant_id=v.id where v.product_id=p.id and v.is_active and pp.price_type='RETAIL' and pp.branch_id is null and pp.effective_from<=now() and (pp.effective_to is null or pp.effective_to>now())) end price,
   case when coalesce((select sum(bi.quantity_on_hand) from public.branch_inventory bi join public.branches br on br.id=bi.branch_id join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and br.is_active),0)<=0 then 'Currently unavailable' when exists(select 1 from public.branch_inventory bi join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and bi.quantity_on_hand>bi.minimum_stock_level) then 'Available' else 'Limited availability' end availability,
   row_number() over(order by case when sort_by='recommended' then p.is_featured::int end desc nulls last,case when sort_by='newest' then p.updated_at end desc nulls last,case when sort_by='name' then p.name end asc nulls last,p.name) row_order,count(*) over() total_count
  from public.products p join public.categories c on c.id=p.category_id left join public.brands b on b.id=p.brand_id
  where p.status='ACTIVE' and p.is_public and c.is_active
   and (search_text is null or trim(search_text)='' or concat_ws(' ',p.name,c.name,b.name,(select string_agg(v.sku,' ') from public.product_variants v where v.product_id=p.id)) ilike '%'||trim(search_text)||'%')
   and (category_slug is null or c.slug=category_slug) and (brand_slug is null or b.slug=brand_slug)
   and (coalesce(attribute_filters,'{}'::jsonb)='{}'::jsonb or (category_slug is not null and exists(
    select 1 from public.product_variants v where v.product_id=p.id and v.is_active and not exists(
     select 1 from jsonb_each_text(attribute_filters) requested where not exists(
      select 1 from public.variant_attribute_values vav
      join public.attributes a on a.id=vav.attribute_id and a.is_active and a.data_type='SELECT'
      join public.attribute_values av on av.id=vav.attribute_value_id and av.is_active
      join public.category_attributes ca on ca.attribute_id=a.id and ca.category_id=c.id
      where vav.variant_id=v.id
       and regexp_replace(lower(a.code),'[^a-z0-9]+','-','g')=requested.key
       and trim(both '-' from regexp_replace(lower(av.value),'[^a-z0-9]+','-','g'))=requested.value
     )
    )
   )))
  offset (page_number-1)*page_size limit page_size
 )q;
 return coalesce(result,jsonb_build_object('total',0,'items','[]'::jsonb));
end;$$;

revoke all on function public.public_attribute_filters(text),public.public_catalogue(text,text,text,text,integer,integer,jsonb) from public;
grant execute on function public.public_attribute_filters(text),public.public_catalogue(text,text,text,text,integer,integer,jsonb) to anon,authenticated;
