-- A complete perpetual WAC may exist before a formal physical/value baseline.
-- Owner-provided baseline is allowed exactly once whenever initialized_at is
-- still null, regardless of whether interim receipts had made WAC complete.
create or replace function public.initialize_inventory_cost(target_branch uuid,target_variant uuid,unit_cost numeric,effective_note text) returns void language plpgsql security definer set search_path='' as $$
declare current_qty numeric(14,3);
begin
 if auth.uid() is null or not public.has_permission('inventory.cost.initialize') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to initialize this inventory cost'; end if;
 if unit_cost is null or unit_cost<0 or unit_cost<>round(unit_cost,2) then raise exception 'Enter a non-negative unit cost with no more than two decimal places'; end if;
 if char_length(trim(coalesce(effective_note,'')))<5 then raise exception 'Describe the source of this opening cost'; end if;
 insert into public.branch_inventory(branch_id,variant_id) values(target_branch,target_variant) on conflict(branch_id,variant_id) do nothing;
 select quantity_on_hand into current_qty from public.branch_inventory where branch_id=target_branch and variant_id=target_variant for update;
 insert into public.branch_inventory_costs(branch_id,variant_id,quantity_on_hand,inventory_value,weighted_average_cost,cost_status,initialized_at,initialized_by,baseline_quantity,baseline_value,baseline_wac)
 values(target_branch,target_variant,current_qty,round(current_qty*unit_cost,4),unit_cost,'COMPLETE',now(),auth.uid(),current_qty,round(current_qty*unit_cost,4),unit_cost)
 on conflict(branch_id,variant_id) do update set quantity_on_hand=excluded.quantity_on_hand,inventory_value=excluded.inventory_value,weighted_average_cost=excluded.weighted_average_cost,cost_status='COMPLETE',initialized_at=now(),initialized_by=auth.uid(),baseline_quantity=excluded.baseline_quantity,baseline_value=excluded.baseline_value,baseline_wac=excluded.baseline_wac,updated_at=now()
 where public.branch_inventory_costs.initialized_at is null;
 if not found then raise exception 'An inventory cost baseline already exists'; end if;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,metadata) values(auth.uid(),target_branch,'inventory.cost_baseline_initialized','branch_inventory_costs',jsonb_build_object('variant_id',target_variant,'quantity',current_qty,'unit_cost',unit_cost,'inventory_value',round(current_qty*unit_cost,4),'source_note',trim(effective_note)));
end;$$;
