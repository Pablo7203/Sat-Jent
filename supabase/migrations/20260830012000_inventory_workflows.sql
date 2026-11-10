-- SAT-J Ent Phase 3: locked, atomic, workflow-specific inventory operations.
create function public.next_inventory_number(kind text) returns text language plpgsql security definer set search_path='' as $$
declare yr integer:=extract(year from now())::integer; n bigint;
begin
 if kind not in ('ADJ','CNT') then raise exception 'Invalid document type'; end if;
 insert into public.inventory_number_sequences(year,document_type,last_number) values(yr,kind,1)
 on conflict(year,document_type) do update set last_number=public.inventory_number_sequences.last_number+1 returning last_number into n;
 return kind||'-'||yr||'-'||lpad(n::text,6,'0');
end;$$;

create function public.validate_inventory_quantity(target_variant uuid, qty numeric, allow_zero boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare decimal_allowed boolean;
begin
 if qty is null or qty<0 or (not allow_zero and qty=0) then raise exception 'Quantity must be positive'; end if;
 select u.allows_decimal into decimal_allowed from public.product_variants v join public.products p on p.id=v.product_id join public.units_of_measure u on u.id=p.unit_of_measure_id where v.id=target_variant;
 if decimal_allowed is null then raise exception 'Unknown product variant'; end if;
 if not decimal_allowed and qty<>trunc(qty) then raise exception 'This unit requires a whole-number quantity'; end if;
end;$$;

create function public.inventory_apply_movement(target_branch uuid,target_variant uuid,target_type public.stock_movement_type,delta numeric,target_reference_type text,target_reference_id uuid,target_reason text,target_notes text) returns uuid
language plpgsql security definer set search_path='' as $$
declare before_qty numeric(14,3); after_qty numeric(14,3); movement_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if delta=0 then raise exception 'Movement quantity cannot be zero'; end if;
 perform public.validate_inventory_quantity(target_variant,abs(delta),false);
 if not exists(select 1 from public.branches where id=target_branch and is_active) then raise exception 'Inventory mutations require an active branch'; end if;
 if not exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id where v.id=target_variant and v.is_active and p.status='ACTIVE') then raise exception 'Inventory mutations require an active product variant'; end if;
 if target_type not in ('STOCK_COUNT_INCREASE','STOCK_COUNT_DECREASE') and exists(select 1 from public.stock_counts c join public.stock_count_items i on i.stock_count_id=c.id where c.branch_id=target_branch and c.status='IN_PROGRESS' and i.variant_id=target_variant) then raise exception 'Stock is locked by an in-progress count'; end if;
 insert into public.branch_inventory(branch_id,variant_id) values(target_branch,target_variant) on conflict(branch_id,variant_id) do nothing;
 select quantity_on_hand into before_qty from public.branch_inventory where branch_id=target_branch and variant_id=target_variant for update;
 after_qty:=before_qty+delta; if after_qty<0 then raise exception 'There is not enough stock to complete this operation'; end if;
 insert into public.stock_movements(branch_id,variant_id,movement_type,quantity_delta,balance_before,balance_after,reference_type,reference_id,reason_code,notes,performed_by)
 values(target_branch,target_variant,target_type,delta,before_qty,after_qty,target_reference_type,target_reference_id,target_reason,nullif(trim(target_notes),''),auth.uid()) returning id into movement_id;
 update public.branch_inventory set quantity_on_hand=after_qty where branch_id=target_branch and variant_id=target_variant;
 return movement_id;
end;$$;
revoke all on function public.inventory_apply_movement(uuid,uuid,public.stock_movement_type,numeric,text,uuid,text,text) from public;

create function public.post_opening_stock_batch(target_branch uuid,items jsonb,operation_notes text default null) returns integer
language plpgsql security definer set search_path='' as $$
declare item jsonb; variant uuid; qty numeric; minimum numeric; posted integer:=0; op_id uuid:=gen_random_uuid();
begin
 if not public.has_permission('inventory.opening_stock') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to initialize this branch'; end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 then raise exception 'At least one opening stock item is required'; end if;
 if (select count(*) from (select value->>'variant_id' from jsonb_array_elements(items) group by 1 having count(*)>1) d)>0 then raise exception 'Duplicate variants are not allowed'; end if;
 for item in select value from jsonb_array_elements(items) loop
   variant:=(item->>'variant_id')::uuid; qty:=(item->>'quantity')::numeric; minimum:=coalesce((item->>'minimum_stock_level')::numeric,0);
   perform public.validate_inventory_quantity(variant,qty,true); perform public.validate_inventory_quantity(variant,minimum,true);
   if exists(select 1 from public.branch_inventory where branch_id=target_branch and variant_id=variant) or exists(select 1 from public.stock_movements where branch_id=target_branch and variant_id=variant) then raise exception 'Opening stock has already been posted for an item'; end if;
   if qty=0 then insert into public.branch_inventory(branch_id,variant_id,minimum_stock_level) values(target_branch,variant,minimum);
   else perform public.inventory_apply_movement(target_branch,variant,'OPENING_STOCK',qty,'OPENING_STOCK',op_id,null,operation_notes); update public.branch_inventory set minimum_stock_level=minimum where branch_id=target_branch and variant_id=variant; end if;
   posted:=posted+1;
 end loop;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),target_branch,'inventory.opening_stock_posted','opening_stock',op_id,jsonb_build_object('item_count',posted));
 return posted;
end;$$;

create function public.create_stock_adjustment(target_branch uuid,target_reason uuid,target_notes text,items jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare adjustment_id uuid; item jsonb;
begin
 if not public.has_permission('inventory.adjust') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to adjust this branch'; end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 then raise exception 'At least one adjustment item is required'; end if;
 insert into public.stock_adjustments(adjustment_number,branch_id,reason_id,notes,created_by) values(public.next_inventory_number('ADJ'),target_branch,target_reason,nullif(trim(target_notes),''),auth.uid()) returning id into adjustment_id;
 for item in select value from jsonb_array_elements(items) loop
  insert into public.stock_adjustment_items(adjustment_id,variant_id,quantity,direction,notes) values(adjustment_id,(item->>'variant_id')::uuid,(item->>'quantity')::numeric,(item->>'direction')::public.adjustment_direction,nullif(trim(item->>'notes'),''));
 end loop;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),target_branch,'inventory.adjustment_created','stock_adjustments',adjustment_id,jsonb_build_object('item_count',jsonb_array_length(items)));
 return adjustment_id;
end;$$;

create function public.complete_stock_adjustment(target_adjustment uuid) returns void language plpgsql security definer set search_path='' as $$
declare header public.stock_adjustments%rowtype; reason public.stock_adjustment_reasons%rowtype; item public.stock_adjustment_items%rowtype; delta numeric; movement uuid;
begin
 select * into header from public.stock_adjustments where id=target_adjustment for update; if not found then raise exception 'Adjustment not found'; end if;
 if not public.has_permission('inventory.adjust') or not public.can_access_branch(header.branch_id) then raise exception 'You do not have permission to complete this adjustment'; end if;
 if header.status<>'DRAFT' then raise exception 'Only draft adjustments can be completed'; end if;
 select * into reason from public.stock_adjustment_reasons where id=header.reason_id and is_active; if not found then raise exception 'Adjustment reason is inactive'; end if;
 if reason.requires_note and coalesce(trim(header.notes),'')='' then raise exception 'This adjustment reason requires a note'; end if;
 for item in select * from public.stock_adjustment_items where adjustment_id=target_adjustment order by variant_id loop
  perform public.validate_inventory_quantity(item.variant_id,item.quantity,false);
  if reason.direction<>'BOTH' and item.direction::text<>reason.direction::text then raise exception 'Adjustment direction is not allowed for this reason'; end if;
  delta:=case item.direction when 'INCREASE' then item.quantity else -item.quantity end;
  movement:=public.inventory_apply_movement(header.branch_id,item.variant_id,(case when delta>0 then 'ADJUSTMENT_INCREASE' else 'ADJUSTMENT_DECREASE' end)::public.stock_movement_type,delta,'STOCK_ADJUSTMENT',header.id,reason.code,coalesce(item.notes,header.notes));
  update public.stock_adjustment_items set stock_movement_id=movement where id=item.id;
 end loop;
 update public.stock_adjustments set status='COMPLETED',completed_by=auth.uid(),completed_at=now() where id=header.id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),header.branch_id,'inventory.adjustment_completed','stock_adjustments',header.id,jsonb_build_object('adjustment_number',header.adjustment_number));
end;$$;

create function public.cancel_stock_adjustment(target_adjustment uuid) returns void language plpgsql security definer set search_path='' as $$
declare header public.stock_adjustments%rowtype; begin select * into header from public.stock_adjustments where id=target_adjustment for update;
 if not public.has_permission('inventory.adjust') or not public.can_access_branch(header.branch_id) then raise exception 'Permission denied'; end if;
 if header.status<>'DRAFT' then raise exception 'Only draft adjustments can be cancelled'; end if;
 update public.stock_adjustments set status='CANCELLED' where id=header.id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),header.branch_id,'inventory.adjustment_cancelled','stock_adjustments',header.id,jsonb_build_object('adjustment_number',header.adjustment_number)); end;$$;

create function public.create_stock_count(target_branch uuid,target_notes text,variant_ids jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare count_id uuid; item_value jsonb; begin
 if not public.has_permission('inventory.count') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to count this branch'; end if;
 if jsonb_typeof(variant_ids)<>'array' or jsonb_array_length(variant_ids)=0 then raise exception 'At least one count item is required'; end if;
 insert into public.stock_counts(count_number,branch_id,notes,started_by) values(public.next_inventory_number('CNT'),target_branch,nullif(trim(target_notes),''),auth.uid()) returning id into count_id;
 for item_value in select element from jsonb_array_elements(variant_ids) as entries(element) loop insert into public.stock_count_items(stock_count_id,variant_id) values(count_id,(item_value#>>'{}')::uuid); end loop; return count_id; end;$$;

create function public.start_stock_count(target_count uuid) returns void language plpgsql security definer set search_path='' as $$
declare header public.stock_counts%rowtype; item public.stock_count_items%rowtype; qty numeric; begin
 select * into header from public.stock_counts where id=target_count for update; if not public.has_permission('inventory.count') or not public.can_access_branch(header.branch_id) then raise exception 'Permission denied'; end if;
 if header.status<>'DRAFT' then raise exception 'Only draft counts can be started'; end if;
 for item in select * from public.stock_count_items where stock_count_id=target_count order by variant_id loop
  insert into public.branch_inventory(branch_id,variant_id) values(header.branch_id,item.variant_id) on conflict do nothing;
  select quantity_on_hand into qty from public.branch_inventory where branch_id=header.branch_id and variant_id=item.variant_id for update;
  update public.stock_count_items set system_quantity=qty,snapshot_at=now() where id=item.id;
 end loop; update public.stock_counts set status='IN_PROGRESS',started_at=now() where id=header.id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id) values(auth.uid(),header.branch_id,'inventory.stock_count_started','stock_counts',header.id); end;$$;

create function public.set_stock_count_quantity(target_item uuid,physical_quantity numeric,item_notes text default null) returns void language plpgsql security definer set search_path='' as $$
declare header public.stock_counts%rowtype; variant uuid; begin
 select c.* into header from public.stock_counts c join public.stock_count_items i on i.stock_count_id=c.id where i.id=target_item;
 select i.variant_id into variant from public.stock_count_items i where i.id=target_item;
 if not public.has_permission('inventory.count') or not public.can_access_branch(header.branch_id) then raise exception 'Permission denied'; end if;
 if header.status<>'IN_PROGRESS' then raise exception 'Count is not in progress'; end if; perform public.validate_inventory_quantity(variant,physical_quantity,true);
 update public.stock_count_items set counted_quantity=physical_quantity,notes=nullif(trim(item_notes),'') where id=target_item; end;$$;

create function public.complete_stock_count(target_count uuid) returns void language plpgsql security definer set search_path='' as $$
declare header public.stock_counts%rowtype; item public.stock_count_items%rowtype; current_qty numeric; change_qty numeric; movement uuid; begin
 select * into header from public.stock_counts where id=target_count for update; if not public.has_permission('inventory.count') or not public.can_access_branch(header.branch_id) then raise exception 'Permission denied'; end if;
 if header.status<>'IN_PROGRESS' then raise exception 'Only in-progress counts can be completed'; end if;
 if exists(select 1 from public.stock_count_items where stock_count_id=target_count and counted_quantity is null) then raise exception 'Every item requires a physical quantity'; end if;
 for item in select * from public.stock_count_items where stock_count_id=target_count order by variant_id loop
  select quantity_on_hand into current_qty from public.branch_inventory where branch_id=header.branch_id and variant_id=item.variant_id for update;
  if current_qty<>item.system_quantity then raise exception 'Stock changed after the count snapshot; restart the count'; end if;
  change_qty:=item.counted_quantity-item.system_quantity; movement:=null;
  if change_qty<>0 then movement:=public.inventory_apply_movement(header.branch_id,item.variant_id,(case when change_qty>0 then 'STOCK_COUNT_INCREASE' else 'STOCK_COUNT_DECREASE' end)::public.stock_movement_type,change_qty,'STOCK_COUNT',header.id,'COUNT_DIFFERENCE',item.notes); end if;
  update public.stock_count_items set variance=change_qty,stock_movement_id=movement where id=item.id;
 end loop; update public.stock_counts set status='COMPLETED',completed_by=auth.uid(),completed_at=now() where id=header.id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id) values(auth.uid(),header.branch_id,'inventory.stock_count_completed','stock_counts',header.id); end;$$;

create function public.cancel_stock_count(target_count uuid) returns void language plpgsql security definer set search_path='' as $$
declare header public.stock_counts%rowtype; begin select * into header from public.stock_counts where id=target_count for update;
 if not public.has_permission('inventory.count') or not public.can_access_branch(header.branch_id) then raise exception 'Permission denied'; end if;
 if header.status not in ('DRAFT','IN_PROGRESS') then raise exception 'Completed counts cannot be cancelled'; end if;
 update public.stock_counts set status='CANCELLED' where id=header.id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id) values(auth.uid(),header.branch_id,'inventory.stock_count_cancelled','stock_counts',header.id); end;$$;

create function public.set_minimum_stock_level(target_branch uuid,target_variant uuid,new_level numeric) returns void language plpgsql security definer set search_path='' as $$
begin if not public.has_permission('inventory.settings.manage') or not public.can_access_branch(target_branch) then raise exception 'Permission denied'; end if; perform public.validate_inventory_quantity(target_variant,new_level,true);
 insert into public.branch_inventory(branch_id,variant_id,minimum_stock_level) values(target_branch,target_variant,new_level) on conflict(branch_id,variant_id) do update set minimum_stock_level=excluded.minimum_stock_level;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,metadata) values(auth.uid(),target_branch,'inventory.minimum_level_changed','branch_inventory',jsonb_build_object('variant_id',target_variant,'new_level',new_level)); end;$$;

create function public.inventory_integrity_issues() returns table(branch_id uuid,variant_id uuid,current_balance numeric,ledger_balance numeric) language sql stable security invoker set search_path='' as $$
 select bi.branch_id,bi.variant_id,bi.quantity_on_hand,coalesce(sum(sm.quantity_delta),0) from public.branch_inventory bi left join public.stock_movements sm on sm.branch_id=bi.branch_id and sm.variant_id=bi.variant_id group by bi.branch_id,bi.variant_id,bi.quantity_on_hand having bi.quantity_on_hand<>coalesce(sum(sm.quantity_delta),0);$$;

revoke all on function public.post_opening_stock_batch(uuid,jsonb,text),public.create_stock_adjustment(uuid,uuid,text,jsonb),public.complete_stock_adjustment(uuid),public.cancel_stock_adjustment(uuid),public.create_stock_count(uuid,text,jsonb),public.start_stock_count(uuid),public.set_stock_count_quantity(uuid,numeric,text),public.complete_stock_count(uuid),public.cancel_stock_count(uuid),public.set_minimum_stock_level(uuid,uuid,numeric),public.inventory_integrity_issues() from public;
grant execute on function public.post_opening_stock_batch(uuid,jsonb,text),public.create_stock_adjustment(uuid,uuid,text,jsonb),public.complete_stock_adjustment(uuid),public.cancel_stock_adjustment(uuid),public.create_stock_count(uuid,text,jsonb),public.start_stock_count(uuid),public.set_stock_count_quantity(uuid,numeric,text),public.complete_stock_count(uuid),public.cancel_stock_count(uuid),public.set_minimum_stock_level(uuid,uuid,numeric),public.inventory_integrity_issues() to authenticated;
