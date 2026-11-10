-- SAT-J Ent Phase 8: public website settings, visibility flags and quotations.
alter table public.products add column slug text;
alter table public.products add column show_price_online boolean not null default false;
alter table public.products add column is_featured boolean not null default false;

update public.products set slug=trim(both '-' from regexp_replace(lower(name),'[^a-z0-9]+','-','g'))||'-'||left(id::text,8);
alter table public.products alter column slug set not null;
alter table public.products add constraint products_slug_format check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
create unique index products_slug_ci_unique on public.products(lower(slug));
create index products_public_catalogue_idx on public.products(is_featured desc,updated_at desc) where status='ACTIVE' and is_public;

create function public.assign_product_slug() returns trigger language plpgsql set search_path='' as $$
declare base text;candidate text;n integer:=1;
begin
 if new.slug is not null and new.slug<>'' then return new;end if;
 base:=trim(both '-' from regexp_replace(lower(new.name),'[^a-z0-9]+','-','g'));if base='' then base:='product';end if;candidate:=base;
 while exists(select 1 from public.products p where lower(p.slug)=lower(candidate) and p.id<>new.id) loop n:=n+1;candidate:=base||'-'||n;end loop;
 new.slug:=candidate;return new;
end;$$;
create trigger assign_product_slug before insert on public.products for each row execute function public.assign_product_slug();

alter table public.branches add column is_public boolean not null default false;
create table public.public_site_settings(
 id boolean primary key default true check(id),
 hero_eyebrow text not null default 'Building materials for every stage',
 hero_title text not null default 'Build with confidence.',
 hero_description text not null default 'Explore doors, tiles, sanitary ware and finishing materials from SAT-J Ent.',
 phone text,email text,whatsapp_number text,
 updated_at timestamptz not null default now(),updated_by uuid references auth.users(id) on delete set null
);
insert into public.public_site_settings(id) values(true);
create trigger public_site_settings_updated_at before update on public.public_site_settings for each row execute function public.set_updated_at();

create type public.quotation_status as enum('NEW','CONTACTED','IN_PROGRESS','CLOSED','CANCELLED');
create type public.quotation_source as enum('PRODUCT','GENERAL_QUOTE','CONTACT');
create table public.quotation_number_sequences(year integer primary key,last_number bigint not null default 0);
create table public.quotation_requests(
 id uuid primary key default gen_random_uuid(),request_number text not null unique,
 name text not null check(char_length(trim(name)) between 2 and 160),phone text not null check(char_length(trim(phone)) between 5 and 40),
 email text check(email is null or char_length(email)<=254),customer_company text check(customer_company is null or char_length(customer_company)<=160),
 product_id uuid references public.products(id) on delete restrict,variant_id uuid references public.product_variants(id) on delete restrict,
 product_name_snapshot text,variant_name_snapshot text,quantity numeric(14,3) check(quantity is null or quantity>0),preferred_branch_id uuid references public.branches(id) on delete restrict,
 message text check(message is null or char_length(message)<=2000),status public.quotation_status not null default 'NEW',source public.quotation_source not null,
 contacted_at timestamptz,closed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index quotation_requests_status_created_idx on public.quotation_requests(status,created_at desc);
create index quotation_requests_branch_created_idx on public.quotation_requests(preferred_branch_id,created_at desc);
create trigger quotation_requests_updated_at before update on public.quotation_requests for each row execute function public.set_updated_at();

insert into public.permissions(id,code,description) values
('20000000-0000-4000-8000-000000000701','website.manage','Manage public website content and visibility'),
('20000000-0000-4000-8000-000000000702','quotations.read','Read quotation requests in authorized scope'),
('20000000-0000-4000-8000-000000000703','quotations.update','Update quotation request status in authorized scope') on conflict(code) do update set description=excluded.description;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where
 (r.code in('SUPER_ADMIN','OWNER') and p.code in('website.manage','quotations.read','quotations.update')) or
 (r.code='BRANCH_MANAGER' and p.code in('quotations.read','quotations.update')) or
 (r.code='SALES' and p.code in('quotations.read','quotations.update')) on conflict do nothing;

alter table public.public_site_settings enable row level security;
alter table public.quotation_requests enable row level security;
alter table public.quotation_number_sequences enable row level security;
create policy site_settings_manage on public.public_site_settings for all to authenticated using(public.has_permission('website.manage')) with check(public.has_permission('website.manage'));
create policy quotations_read on public.quotation_requests for select to authenticated using(public.has_permission('quotations.read') and (preferred_branch_id is null or public.can_access_branch(preferred_branch_id)));
grant select,update on public.public_site_settings to authenticated;
grant select on public.quotation_requests to authenticated;

-- Storage is private at bucket level; anonymous reads are allowed only for images attached to public active products.
update storage.buckets set public=false where id='product-images';
drop policy if exists product_images_public_read on storage.objects;
create function public.is_public_product_image(object_name text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.product_images pi join public.products p on p.id=pi.product_id where pi.storage_path=object_name and p.status='ACTIVE' and p.is_public)$$;
revoke all on function public.is_public_product_image(text) from public;
grant execute on function public.is_public_product_image(text) to anon,authenticated;
create policy product_images_safe_public_read on storage.objects for select to anon using(bucket_id='product-images' and public.is_public_product_image(name));

create function public.public_site_config() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('hero_eyebrow',s.hero_eyebrow,'hero_title',s.hero_title,'hero_description',s.hero_description,'phone',s.phone,'email',s.email,'whatsapp_number',s.whatsapp_number) from public.public_site_settings s where s.id
$$;
create function public.public_categories() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x order by x.sort_order,x.name),'[]') from(select c.id,c.parent_id,c.name,c.slug,c.description,c.sort_order,(select pi.storage_path from public.products p join public.product_images pi on pi.product_id=p.id where p.category_id=c.id and p.status='ACTIVE' and p.is_public order by pi.is_primary desc,pi.sort_order limit 1) image_path from public.categories c where c.is_active and exists(select 1 from public.products p where p.category_id=c.id and p.status='ACTIVE' and p.is_public))x
$$;
create function public.public_branches() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',b.name,'address',b.address,'phone',b.phone,'email',b.email,'opening_hours',b.opening_hours) order by b.name),'[]') from public.branches b where b.is_active and b.is_public
$$;
create function public.public_brands() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('name',b.name,'slug',b.slug) order by b.name),'[]') from public.brands b where b.is_active and exists(select 1 from public.products p where p.brand_id=b.id and p.status='ACTIVE' and p.is_public)
$$;

create function public.public_catalogue(search_text text default null,category_slug text default null,brand_slug text default null,sort_by text default 'recommended',page_number integer default 1,page_size integer default 12) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if page_number<1 or page_size not between 1 and 24 or sort_by not in('recommended','newest','name') then raise exception 'Invalid catalogue filters';end if;
 select jsonb_build_object('total',coalesce(max(q.total_count),0),'items',coalesce(jsonb_agg(jsonb_build_object('slug',q.slug,'name',q.name,'description',q.description,'category',q.category,'category_slug',q.category_slug,'brand',q.brand,'image_path',q.image_path,'price',q.price,'availability',q.availability) order by q.row_order),'[]')) into result from(
  select p.slug,p.name,left(p.description,180) description,c.name category,c.slug category_slug,b.name brand,
   (select pi.storage_path from public.product_images pi where pi.product_id=p.id order by pi.is_primary desc,pi.sort_order,pi.created_at limit 1) image_path,
   case when p.show_price_online then (select min(pp.amount) from public.product_variants v join public.product_prices pp on pp.variant_id=v.id where v.product_id=p.id and v.is_active and pp.price_type='RETAIL' and pp.branch_id is null and pp.effective_from<=now() and (pp.effective_to is null or pp.effective_to>now())) end price,
   case when coalesce((select sum(bi.quantity_on_hand) from public.branch_inventory bi join public.branches br on br.id=bi.branch_id join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and br.is_active),0)<=0 then 'Currently unavailable' when exists(select 1 from public.branch_inventory bi join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and bi.quantity_on_hand>bi.minimum_stock_level) then 'Available' else 'Limited availability' end availability,
   row_number() over(order by case when sort_by='recommended' then p.is_featured::int end desc nulls last,case when sort_by='newest' then p.updated_at end desc nulls last,case when sort_by='name' then p.name end asc nulls last,p.name) row_order,count(*) over() total_count
  from public.products p join public.categories c on c.id=p.category_id left join public.brands b on b.id=p.brand_id where p.status='ACTIVE' and p.is_public and c.is_active and (search_text is null or trim(search_text)='' or concat_ws(' ',p.name,c.name,b.name,(select string_agg(v.sku,' ') from public.product_variants v where v.product_id=p.id)) ilike '%'||trim(search_text)||'%') and (category_slug is null or c.slug=category_slug) and (brand_slug is null or b.slug=brand_slug)
  offset (page_number-1)*page_size limit page_size
 )q;
 return coalesce(result,jsonb_build_object('total',0,'items','[]'::jsonb));
end;$$;

create function public.public_product(product_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'slug',p.slug,'name',p.name,'description',p.description,'category',jsonb_build_object('name',c.name,'slug',c.slug),'brand',b.name,'unit',u.symbol,'show_price_online',p.show_price_online,
 'images',(select coalesce(jsonb_agg(jsonb_build_object('path',pi.storage_path,'alt',coalesce(pi.alt_text,p.name),'variant_id',pi.variant_id) order by pi.is_primary desc,pi.sort_order),'[]') from public.product_images pi where pi.product_id=p.id),
 'variants',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'sku',v.sku,'price',case when p.show_price_online then (select pp.amount from public.product_prices pp where pp.variant_id=v.id and pp.price_type='RETAIL' and pp.branch_id is null and pp.effective_from<=now() and (pp.effective_to is null or pp.effective_to>now()) order by pp.effective_from desc limit 1) end,'attributes',(select coalesce(jsonb_object_agg(a.name,coalesce(av.value,vav.text_value,vav.number_value::text,vav.boolean_value::text)),'{}') from public.variant_attribute_values vav join public.attributes a on a.id=vav.attribute_id left join public.attribute_values av on av.id=vav.attribute_value_id where vav.variant_id=v.id)) order by v.is_default desc,v.name),'[]') from public.product_variants v where v.product_id=p.id and v.is_active),
 'availability',case when coalesce((select sum(bi.quantity_on_hand) from public.branch_inventory bi join public.branches br on br.id=bi.branch_id join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and br.is_active),0)<=0 then 'Currently unavailable' when exists(select 1 from public.branch_inventory bi join public.product_variants v on v.id=bi.variant_id where v.product_id=p.id and bi.quantity_on_hand>bi.minimum_stock_level) then 'Available' else 'Limited availability' end,
 'related',(select coalesce(jsonb_agg(jsonb_build_object('slug',r.slug,'name',r.name)),'[]') from(select rp.slug,rp.name from public.products rp where rp.category_id=p.category_id and rp.id<>p.id and rp.status='ACTIVE' and rp.is_public order by rp.is_featured desc,rp.updated_at desc limit 4)r))
 from public.products p join public.categories c on c.id=p.category_id left join public.brands b on b.id=p.brand_id join public.units_of_measure u on u.id=p.unit_of_measure_id where p.slug=product_slug and p.status='ACTIVE' and p.is_public
$$;
create function public.public_sitemap_entries() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('products',(select coalesce(jsonb_agg(jsonb_build_object('slug',p.slug,'updated_at',p.updated_at)),'[]') from public.products p where p.status='ACTIVE' and p.is_public),'categories',(select coalesce(jsonb_agg(jsonb_build_object('slug',c.slug,'updated_at',c.updated_at)),'[]') from public.categories c where c.is_active and exists(select 1 from public.products p where p.category_id=c.id and p.status='ACTIVE' and p.is_public)))
$$;

create function public.submit_quotation(visitor_name text,visitor_phone text,visitor_email text,visitor_company text,target_product uuid,target_variant uuid,requested_quantity numeric,target_branch uuid,visitor_message text,request_source public.quotation_source,honey text default null) returns text language plpgsql volatile security definer set search_path='' as $$
declare next_no bigint;request_no text;product_name text;variant_name text;
begin
 if coalesce(honey,'')<>'' then raise exception 'Request rejected';end if;
 if char_length(trim(visitor_name)) not between 2 and 160 or char_length(trim(visitor_phone)) not between 5 and 40 or (visitor_email is not null and visitor_email<>'' and visitor_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') or (visitor_message is not null and char_length(visitor_message)>2000) or (requested_quantity is not null and requested_quantity<=0) then raise exception 'Check the quotation details';end if;
 if target_branch is not null and not exists(select 1 from public.branches b where b.id=target_branch and b.is_active and b.is_public) then raise exception 'Invalid branch';end if;
 if (select count(*) from public.quotation_requests q where q.phone=trim(visitor_phone) and q.created_at>now()-interval '5 minutes')>=3 then raise exception 'Please wait before sending another request';end if;
 if target_product is not null then select p.name into product_name from public.products p where p.id=target_product and p.status='ACTIVE' and p.is_public;if product_name is null then raise exception 'Invalid public product';end if;if target_variant is not null then select v.name into variant_name from public.product_variants v where v.id=target_variant and v.product_id=target_product and v.is_active;if variant_name is null then raise exception 'Invalid product variant';end if;end if;end if;
 insert into public.quotation_number_sequences(year,last_number) values(extract(year from now())::int,1) on conflict(year) do update set last_number=public.quotation_number_sequences.last_number+1 returning last_number into next_no;request_no:='RFQ-'||extract(year from now())::int||'-'||lpad(next_no::text,6,'0');
 insert into public.quotation_requests(request_number,name,phone,email,customer_company,product_id,variant_id,product_name_snapshot,variant_name_snapshot,quantity,preferred_branch_id,message,status,source) values(request_no,trim(visitor_name),trim(visitor_phone),nullif(trim(visitor_email),''),nullif(trim(visitor_company),''),target_product,target_variant,product_name,variant_name,requested_quantity,target_branch,nullif(trim(visitor_message),''),'NEW',request_source);
 return request_no;
end;$$;

create function public.update_quotation_status(target_id uuid,new_status public.quotation_status) returns void language plpgsql volatile security definer set search_path='' as $$
declare branch uuid;
begin
 select preferred_branch_id into branch from public.quotation_requests where id=target_id;
 if not found or not public.has_permission('quotations.update') or (branch is not null and not public.can_access_branch(branch)) then raise exception 'Quotation unavailable';end if;
 update public.quotation_requests set status=new_status,contacted_at=case when new_status='CONTACTED' and contacted_at is null then now() else contacted_at end,closed_at=case when new_status in('CLOSED','CANCELLED') then now() else null end where id=target_id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,new_values) values(auth.uid(),branch,'quotation.status_changed','QUOTATION_REQUEST',target_id,jsonb_build_object('status',new_status));
end;$$;

revoke all on function public.public_site_config(),public.public_categories(),public.public_branches(),public.public_brands(),public.public_catalogue(text,text,text,text,integer,integer),public.public_product(text),public.public_sitemap_entries(),public.submit_quotation(text,text,text,text,uuid,uuid,numeric,uuid,text,public.quotation_source,text),public.update_quotation_status(uuid,public.quotation_status) from public;
grant execute on function public.public_site_config(),public.public_categories(),public.public_branches(),public.public_brands(),public.public_catalogue(text,text,text,text,integer,integer),public.public_product(text),public.public_sitemap_entries(),public.submit_quotation(text,text,text,text,uuid,uuid,numeric,uuid,text,public.quotation_source,text) to anon,authenticated;
grant execute on function public.update_quotation_status(uuid,public.quotation_status) to authenticated;
