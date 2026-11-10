begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into public.categories(id,name,slug) values('51900000-0000-4000-8000-000000000001','Closure Tiles','closure-tiles');
insert into public.units_of_measure(id,code,name,symbol) values('53900000-0000-4000-8000-000000000001','CLPCS','Closure Pieces','pc');
insert into public.attributes(id,code,name,data_type) values
('54900000-0000-4000-8000-000000000001','SIZE','Size','SELECT'),
('54900000-0000-4000-8000-000000000002','FINISH','Finish','SELECT');
insert into public.attribute_values(id,attribute_id,value) values
('55900000-0000-4000-8000-000000000001','54900000-0000-4000-8000-000000000001','60x60'),
('55900000-0000-4000-8000-000000000002','54900000-0000-4000-8000-000000000001','30x30'),
('55900000-0000-4000-8000-000000000003','54900000-0000-4000-8000-000000000002','Matte'),
('55900000-0000-4000-8000-000000000004','54900000-0000-4000-8000-000000000002','Gloss'),
('55900000-0000-4000-8000-000000000005','54900000-0000-4000-8000-000000000002','Gold Private'),
('55900000-0000-4000-8000-000000000006','54900000-0000-4000-8000-000000000002','Satin Draft'),
('55900000-0000-4000-8000-000000000007','54900000-0000-4000-8000-000000000002','Bronze Archived');
insert into public.category_attributes(category_id,attribute_id,sort_order) values
('51900000-0000-4000-8000-000000000001','54900000-0000-4000-8000-000000000001',1),
('51900000-0000-4000-8000-000000000001','54900000-0000-4000-8000-000000000002',2);
insert into public.products(id,name,slug,category_id,unit_of_measure_id,status,is_public) values
('56900000-0000-4000-8000-000000000001','Carrara Combination Tile','carrara-combination-tile','51900000-0000-4000-8000-000000000001','53900000-0000-4000-8000-000000000001','DRAFT',false),
('56900000-0000-4000-8000-000000000002','Private Gold Tile','private-gold-tile','51900000-0000-4000-8000-000000000001','53900000-0000-4000-8000-000000000001','DRAFT',false),
('56900000-0000-4000-8000-000000000003','Draft Satin Tile','draft-satin-tile','51900000-0000-4000-8000-000000000001','53900000-0000-4000-8000-000000000001','DRAFT',false),
('56900000-0000-4000-8000-000000000004','Archived Bronze Tile','archived-bronze-tile','51900000-0000-4000-8000-000000000001','53900000-0000-4000-8000-000000000001','DRAFT',false);
insert into public.product_variants(id,product_id,name,sku,is_default) values
('57900000-0000-4000-8000-000000000001','56900000-0000-4000-8000-000000000001','60x60 Matte','CLOSURE-60-MATTE',true),
('57900000-0000-4000-8000-000000000002','56900000-0000-4000-8000-000000000001','30x30 Gloss','CLOSURE-30-GLOSS',false),
('57900000-0000-4000-8000-000000000003','56900000-0000-4000-8000-000000000002','Gold','CLOSURE-PRIVATE',true),
('57900000-0000-4000-8000-000000000004','56900000-0000-4000-8000-000000000003','Satin','CLOSURE-DRAFT',true),
('57900000-0000-4000-8000-000000000005','56900000-0000-4000-8000-000000000004','Bronze','CLOSURE-ARCHIVED',true);
insert into public.variant_attribute_values(variant_id,attribute_id,attribute_value_id) values
('57900000-0000-4000-8000-000000000001','54900000-0000-4000-8000-000000000001','55900000-0000-4000-8000-000000000001'),
('57900000-0000-4000-8000-000000000001','54900000-0000-4000-8000-000000000002','55900000-0000-4000-8000-000000000003'),
('57900000-0000-4000-8000-000000000002','54900000-0000-4000-8000-000000000001','55900000-0000-4000-8000-000000000002'),
('57900000-0000-4000-8000-000000000002','54900000-0000-4000-8000-000000000002','55900000-0000-4000-8000-000000000004'),
('57900000-0000-4000-8000-000000000003','54900000-0000-4000-8000-000000000002','55900000-0000-4000-8000-000000000005'),
('57900000-0000-4000-8000-000000000004','54900000-0000-4000-8000-000000000002','55900000-0000-4000-8000-000000000006'),
('57900000-0000-4000-8000-000000000005','54900000-0000-4000-8000-000000000002','55900000-0000-4000-8000-000000000007');
insert into public.product_images(product_id,storage_path) values
('56900000-0000-4000-8000-000000000001','products/56900000-0000-4000-8000-000000000001/carrara.webp'),
('56900000-0000-4000-8000-000000000003','products/56900000-0000-4000-8000-000000000003/draft.webp'),
('56900000-0000-4000-8000-000000000004','products/56900000-0000-4000-8000-000000000004/archived.webp');
update public.products set is_public=true where id in('56900000-0000-4000-8000-000000000001','56900000-0000-4000-8000-000000000003','56900000-0000-4000-8000-000000000004');
update public.products set status='ACTIVE' where id in('56900000-0000-4000-8000-000000000001','56900000-0000-4000-8000-000000000002');
set local session_replication_role=replica;
update public.products set status='ARCHIVED' where id='56900000-0000-4000-8000-000000000004';
set local session_replication_role=origin;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select is(jsonb_array_length(public.public_attribute_filters('closure-tiles')),2,'Selected category exposes only its configured used attributes');
select ok(public.public_attribute_filters('closure-tiles')::text like '%60x60%','Public product value is visible');
select ok(public.public_attribute_filters('closure-tiles')::text not like '%Gold Private%','Private-only value is isolated');
select ok(public.public_attribute_filters('closure-tiles')::text not like '%Satin Draft%','Draft-only value is isolated');
select ok(public.public_attribute_filters('closure-tiles')::text not like '%Bronze Archived%','Archived-only value is isolated');
select is((public.public_catalogue(null,'closure-tiles',null,'recommended',1,12,'{"size":"60x60","finish":"gloss"}') ->> 'total')::int,0,'Impossible cross-variant combination does not match');
select is((public.public_catalogue(null,'closure-tiles',null,'recommended',1,12,'{"finish":"gold-private"}') ->> 'total')::int,0,'Private attribute attack cannot return a private product');
select is((public.public_catalogue(null,'closure-tiles',null,'recommended',1,12,'{"finish":"satin-draft"}') ->> 'total')::int,0,'Draft attribute attack cannot return a draft product');
select is((public.public_catalogue(null,'closure-tiles',null,'recommended',1,12,'{"finish":"bronze-archived"}') ->> 'total')::int,0,'Archived attribute attack cannot return an archived product');
set local role postgres;
insert into public.product_variants(id,product_id,name,sku) values('57900000-0000-4000-8000-000000000006','56900000-0000-4000-8000-000000000001','60x60 Gloss','CLOSURE-60-GLOSS');
insert into public.variant_attribute_values(variant_id,attribute_id,attribute_value_id) values
('57900000-0000-4000-8000-000000000006','54900000-0000-4000-8000-000000000001','55900000-0000-4000-8000-000000000001'),
('57900000-0000-4000-8000-000000000006','54900000-0000-4000-8000-000000000002','55900000-0000-4000-8000-000000000004');
set local role anon;
select is((public.public_catalogue('Carrara','closure-tiles',null,'recommended',1,1,'{"size":"60x60","finish":"gloss"}') ->> 'total')::int,1,'One real variant satisfying both attributes matches with search');
select is(jsonb_array_length(public.public_catalogue('Carrara','closure-tiles',null,'recommended',1,1,'{"size":"60x60","finish":"gloss"}') -> 'items'),1,'Attribute filtering occurs before pagination');
select * from finish();
rollback;
