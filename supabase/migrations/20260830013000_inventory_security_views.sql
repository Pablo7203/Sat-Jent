-- SAT-J Ent Phase 3: branch-isolated reads and no direct stock writes.
alter table public.branch_inventory enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_adjustment_reasons enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;
alter table public.inventory_number_sequences enable row level security;

create policy branch_inventory_read on public.branch_inventory for select to authenticated using(public.has_permission('inventory.read') and public.can_access_branch(branch_id));
create policy stock_movements_read on public.stock_movements for select to authenticated using(public.has_permission('inventory.read') and public.can_access_branch(branch_id));
create policy adjustment_reasons_read on public.stock_adjustment_reasons for select to authenticated using(public.has_permission('inventory.read'));
create policy adjustments_read on public.stock_adjustments for select to authenticated using(public.has_permission('inventory.read') and public.can_access_branch(branch_id));
create policy adjustment_items_read on public.stock_adjustment_items for select to authenticated using(public.has_permission('inventory.read') and exists(select 1 from public.stock_adjustments a where a.id=adjustment_id and public.can_access_branch(a.branch_id)));
create policy counts_read on public.stock_counts for select to authenticated using(public.has_permission('inventory.read') and public.can_access_branch(branch_id));
create policy count_items_read on public.stock_count_items for select to authenticated using(public.has_permission('inventory.read') and exists(select 1 from public.stock_counts c where c.id=stock_count_id and public.can_access_branch(c.branch_id)));

grant select on public.branch_inventory,public.stock_movements,public.stock_adjustment_reasons,public.stock_adjustments,public.stock_adjustment_items,public.stock_counts,public.stock_count_items to authenticated;
revoke insert,update,delete on public.branch_inventory,public.stock_movements,public.stock_adjustment_reasons,public.stock_adjustments,public.stock_adjustment_items,public.stock_counts,public.stock_count_items,public.inventory_number_sequences from anon,authenticated;

create view public.inventory_catalog with(security_invoker=true) as
select bi.id,bi.branch_id,b.code branch_code,b.name branch_name,bi.variant_id,v.sku,v.barcode,v.name variant_name,
 p.id product_id,p.name product_name,p.category_id,c.name category_name,p.brand_id,br.name brand_name,u.code unit_code,u.symbol unit_symbol,u.allows_decimal,
 bi.quantity_on_hand,bi.minimum_stock_level,case when bi.quantity_on_hand=0 then 'OUT_OF_STOCK' when bi.quantity_on_hand<=bi.minimum_stock_level then 'LOW_STOCK' else 'IN_STOCK' end stock_status,
 (select max(sm.occurred_at) from public.stock_movements sm where sm.branch_id=bi.branch_id and sm.variant_id=bi.variant_id) last_movement_at
from public.branch_inventory bi join public.branches b on b.id=bi.branch_id join public.product_variants v on v.id=bi.variant_id
join public.products p on p.id=v.product_id join public.categories c on c.id=p.category_id left join public.brands br on br.id=p.brand_id join public.units_of_measure u on u.id=p.unit_of_measure_id;
grant select on public.inventory_catalog to authenticated;

create view public.company_stock_totals with(security_invoker=true) as select variant_id,sum(quantity_on_hand)::numeric(14,3) quantity_on_hand from public.branch_inventory group by variant_id;
grant select on public.company_stock_totals to authenticated;
