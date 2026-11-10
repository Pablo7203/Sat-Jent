begin;create extension if not exists pgtap with schema extensions;select no_plan();
insert into public.categories(id,name,slug,description) values('51800000-0000-4000-8000-000000000001','Public Tiles','public-tiles','Public category');
insert into public.units_of_measure(id,code,name,symbol) values('53800000-0000-4000-8000-000000000001','P8PC','Public Pieces','pc');
insert into public.brands(id,name,slug) values('52800000-0000-4000-8000-000000000001','Public Brand','public-brand');
insert into public.branches(id,code,name,address,phone,is_active,is_public) values('48800000-0000-4000-8000-000000000001','PUB8','Public Branch','Approved address','0200000000',true,true),('48800000-0000-4000-8000-000000000002','HID8','Hidden Branch','Private address','0200000001',true,false);
insert into public.products(id,name,slug,description,category_id,brand_id,unit_of_measure_id,status,is_public,show_price_online,is_featured) values
('56800000-0000-4000-8000-000000000001','Visible Tile','visible-tile','Visible description','51800000-0000-4000-8000-000000000001','52800000-0000-4000-8000-000000000001','53800000-0000-4000-8000-000000000001','DRAFT',false,true,true),
('56800000-0000-4000-8000-000000000002','Private Tile','private-tile','Must never leak','51800000-0000-4000-8000-000000000001',null,'53800000-0000-4000-8000-000000000001','DRAFT',false,true,false),
('56800000-0000-4000-8000-000000000003','Draft Tile','draft-tile','Must never leak','51800000-0000-4000-8000-000000000001',null,'53800000-0000-4000-8000-000000000001','DRAFT',false,true,false),
('56800000-0000-4000-8000-000000000004','Hidden Price Tile','hidden-price-tile','Public without price','51800000-0000-4000-8000-000000000001',null,'53800000-0000-4000-8000-000000000001','DRAFT',false,false,false),
('56800000-0000-4000-8000-000000000005','Unavailable Tile','unavailable-tile','Public zero-stock item','51800000-0000-4000-8000-000000000001',null,'53800000-0000-4000-8000-000000000001','DRAFT',false,false,false);
insert into public.product_variants(id,product_id,name,sku,is_default) values
('57800000-0000-4000-8000-000000000001','56800000-0000-4000-8000-000000000001','60 x 60','PUBLIC-SKU',true),
('57800000-0000-4000-8000-000000000002','56800000-0000-4000-8000-000000000002','Private','PRIVATE-SKU',true),
('57800000-0000-4000-8000-000000000003','56800000-0000-4000-8000-000000000003','Draft','DRAFT-SKU',true),
('57800000-0000-4000-8000-000000000004','56800000-0000-4000-8000-000000000004','Standard','HIDDEN-SKU',true),
('57800000-0000-4000-8000-000000000005','56800000-0000-4000-8000-000000000005','Standard','ZERO-SKU',true);
insert into public.product_images(product_id,storage_path) values
('56800000-0000-4000-8000-000000000001','products/56800000-0000-4000-8000-000000000001/visible.webp'),
('56800000-0000-4000-8000-000000000003','products/56800000-0000-4000-8000-000000000003/draft.webp'),
('56800000-0000-4000-8000-000000000004','products/56800000-0000-4000-8000-000000000004/hidden.webp'),
('56800000-0000-4000-8000-000000000005','products/56800000-0000-4000-8000-000000000005/unavailable.webp');
update public.products set is_public=true where id in('56800000-0000-4000-8000-000000000001','56800000-0000-4000-8000-000000000003','56800000-0000-4000-8000-000000000004','56800000-0000-4000-8000-000000000005');
update public.products set status='ACTIVE' where id in('56800000-0000-4000-8000-000000000001','56800000-0000-4000-8000-000000000002','56800000-0000-4000-8000-000000000004','56800000-0000-4000-8000-000000000005');
insert into public.product_prices(variant_id,price_type,amount) values('57800000-0000-4000-8000-000000000001','RETAIL',180),('57800000-0000-4000-8000-000000000002','RETAIL',999),('57800000-0000-4000-8000-000000000004','RETAIL',777);
insert into public.branch_inventory(branch_id,variant_id,quantity_on_hand,minimum_stock_level) values('48800000-0000-4000-8000-000000000001','57800000-0000-4000-8000-000000000001',20,5),('48800000-0000-4000-8000-000000000001','57800000-0000-4000-8000-000000000004',2,5),('48800000-0000-4000-8000-000000000001','57800000-0000-4000-8000-000000000005',0,5);

set local role anon;select set_config('request.jwt.claims','{"role":"anon"}',true);
select is((public.public_catalogue(null,'public-tiles',null,'recommended',1,12)->>'total')::int,3,'Only active public products enter catalogue');
select ok(public.public_product('visible-tile') is not null,'Public active product resolves');
select ok(public.public_product('private-tile') is null,'Private direct slug is hidden');
select ok(public.public_product('draft-tile') is null,'Draft direct slug is hidden');
select is(public.public_product('visible-tile')->'variants'->0->>'price','180.00','Approved retail price is exposed');
select ok((public.public_product('hidden-price-tile')->'variants'->0->'price')='null'::jsonb,'Hidden numeric price is not returned');
select is(public.public_product('visible-tile')->>'availability','Available','Positive healthy stock becomes Available');
select ok(public.public_product('visible-tile')->'related'->0 ? 'image_path','Related products expose a public product-card image path');
select ok(public.public_product('visible-tile')->'related'->0 ? 'price','Related products expose the public-safe price field');
select is(public.public_product('hidden-price-tile')->>'availability','Limited availability','Low positive stock becomes limited without quantity');
select is(public.public_product('unavailable-tile')->>'availability','Currently unavailable','Zero stock becomes unavailable without quantity');
select is(jsonb_array_length(public.public_branches()),1,'Only public active branch is exposed');
select is((public.public_catalogue('Private Tile',null,null,'recommended',1,12)->>'total')::int,0,'Private search match does not leak in count');
select is((select count(*) from public.products),0::bigint,'Anonymous reads no raw products');
select is((select count(*) from public.product_prices),0::bigint,'Anonymous reads no price history');
select is((select count(*) from public.branch_inventory),0::bigint,'Anonymous reads no raw inventory');
select is((select count(*) from public.stock_movements),0::bigint,'Anonymous reads no stock movements');
select is((select count(*) from public.suppliers),0::bigint,'Anonymous reads no suppliers');
select is((select count(*) from public.customers),0::bigint,'Anonymous reads no customers');
select is((select count(*) from public.sales),0::bigint,'Anonymous reads no sales');
select is((select count(*) from public.quotation_requests),0::bigint,'Anonymous reads no quotations');
-- Exercise the preserved submission function as the database owner. Anonymous
-- EXECUTE was intentionally revoked in redevelopment Phase 1.
set local role postgres;
select lives_ok($$select public.submit_quotation('Ama Visitor','0240000000','ama@example.com','', '56800000-0000-4000-8000-000000000001','57800000-0000-4000-8000-000000000001',10,'48800000-0000-4000-8000-000000000001','Please quote','PRODUCT','')$$,'Valid public product RFQ submits');
select throws_ok($$select public.submit_quotation('Bad Visitor','0240000002','','','56800000-0000-4000-8000-000000000002',null,1,null,'Private target','PRODUCT','')$$,'P0001','Invalid public product','Private product RFQ is rejected');
select throws_ok($$select public.submit_quotation('Bot Visitor','0240000003','','',null,null,null,null,'Bot','GENERAL_QUOTE','filled')$$,'P0001','Request rejected','Honeypot rejects bot submission');
set local role postgres;
select is((select status::text from public.quotation_requests where phone='0240000000'),'NEW','Public submission is forced to NEW');
select ok((select request_number like 'RFQ-%' from public.quotation_requests where phone='0240000000'),'RFQ number is generated');
select * from finish();rollback;
