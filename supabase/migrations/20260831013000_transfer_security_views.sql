-- SAT-J Ent Phase 6: branch-aware reads, derived transit and integrity projections.
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.transfer_number_sequences enable row level security;
create policy transfers_read on public.stock_transfers for select to authenticated using(public.has_permission('transfers.read') and (public.can_access_branch(source_branch_id) or public.can_access_branch(destination_branch_id)));
create policy transfer_items_read on public.stock_transfer_items for select to authenticated using(exists(select 1 from public.stock_transfers t where t.id=transfer_id and public.has_permission('transfers.read') and (public.can_access_branch(t.source_branch_id) or public.can_access_branch(t.destination_branch_id))));
grant select on public.stock_transfers,public.stock_transfer_items to authenticated;
revoke insert,update,delete on public.stock_transfers,public.stock_transfer_items,public.transfer_number_sequences from anon,authenticated;

create view public.transfer_in_transit with(security_invoker=true) as select t.id transfer_id,t.transfer_number,t.source_branch_id,t.destination_branch_id,i.id transfer_item_id,i.variant_id,i.dispatched_quantity,i.received_quantity,(i.dispatched_quantity-i.received_quantity)::numeric(14,3) in_transit_quantity from public.stock_transfers t join public.stock_transfer_items i on i.transfer_id=t.id where t.status='DISPATCHED' and i.dispatched_quantity>i.received_quantity;
grant select on public.transfer_in_transit to authenticated;

create view public.transfer_summary with(security_invoker=true) as select t.*,sb.name source_branch_name,db.name destination_branch_name,count(i.id)::integer item_count,coalesce(sum(i.dispatched_quantity-i.received_quantity),0)::numeric(14,3) in_transit_quantity from public.stock_transfers t join public.branches sb on sb.id=t.source_branch_id join public.branches db on db.id=t.destination_branch_id left join public.stock_transfer_items i on i.transfer_id=t.id group by t.id,sb.name,db.name;
grant select on public.transfer_summary to authenticated;

create function public.transfer_integrity_issues() returns table(transfer_id uuid,transfer_item_id uuid,issue text) language sql stable security definer set search_path='' as $$
 select t.id,i.id,'QUANTITY_RECONCILIATION' from public.stock_transfers t join public.stock_transfer_items i on i.transfer_id=t.id where (t.status='DISPATCHED' and (i.dispatched_quantity<=0 or i.received_quantity<>0)) or (t.status='RECEIVED' and (i.dispatched_quantity<>i.received_quantity or i.dispatched_quantity<=0))
 union all select t.id,i.id,'MOVEMENT_RECONCILIATION' from public.stock_transfers t join public.stock_transfer_items i on i.transfer_id=t.id where (i.transfer_out_movement_id is not null and not exists(select 1 from public.stock_movements m where m.id=i.transfer_out_movement_id and m.branch_id=t.source_branch_id and m.movement_type='TRANSFER_OUT' and m.quantity_delta=-i.dispatched_quantity)) or (i.transfer_in_movement_id is not null and not exists(select 1 from public.stock_movements m where m.id=i.transfer_in_movement_id and m.branch_id=t.destination_branch_id and m.movement_type='TRANSFER_IN' and m.quantity_delta=i.received_quantity))
 union all select t.id,i.id,'COMPANY_CONSERVATION' from public.stock_transfers t join public.stock_transfer_items i on i.transfer_id=t.id where t.status='RECEIVED' and coalesce((select sum(m.quantity_delta) from public.stock_movements m where m.id in(i.transfer_out_movement_id,i.transfer_in_movement_id)),0)<>0
$$;
revoke all on function public.transfer_integrity_issues() from public;
