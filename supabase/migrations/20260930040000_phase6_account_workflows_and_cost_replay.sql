-- Explicit account selection wrappers for existing authoritative payment RPCs.
create function public.complete_sale_with_account(target_sale uuid,operation_id uuid,initial_payment numeric,method public.supplier_payment_method,payment_reference text,payment_notes text,payment_on date,target_account uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; recorded uuid;
begin
 if coalesce(initial_payment,0)>0 then
  if target_account is null then raise exception 'Select the account receiving this payment'; end if;
  perform set_config('app.financial_account_id',target_account::text,true);
 end if;
 result_id:=public.complete_sale(target_sale,operation_id,initial_payment,method,payment_reference,payment_notes,payment_on);
 if coalesce(initial_payment,0)>0 then
  select financial_account_id into recorded from public.customer_payments where branch_id=(select branch_id from public.sales where id=result_id) and operation_key=operation_id;
  if recorded is distinct from target_account then raise exception 'This payment operation was already recorded to a different account'; end if;
 end if;
 return result_id;
end;$$;

create function public.record_customer_payment_with_account(target_customer uuid,target_sale uuid,target_branch uuid,operation_id uuid,payment_amount numeric,method public.supplier_payment_method,reference text,payment_on timestamptz,payment_notes text,target_account uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; recorded uuid;
begin
 if target_account is null then raise exception 'Select the account receiving this payment'; end if;
 perform set_config('app.financial_account_id',target_account::text,true);
 result_id:=public.record_customer_payment(target_customer,target_sale,target_branch,operation_id,payment_amount,method,reference,payment_on,payment_notes);
 select financial_account_id into recorded from public.customer_payments where id=result_id;
 if recorded is distinct from target_account then raise exception 'This payment operation was already recorded to a different account'; end if;
 return result_id;
end;$$;

create function public.record_supplier_payment_with_account(target_supplier uuid,target_purchase uuid,target_branch uuid,operation_id uuid,payment_amount numeric,method public.supplier_payment_method,reference text,payment_on date,payment_notes text,target_account uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; recorded uuid;
begin
 if target_account is null then raise exception 'Select the account paying this supplier'; end if;
 perform set_config('app.financial_account_id',target_account::text,true);
 result_id:=public.record_supplier_payment(target_supplier,target_purchase,target_branch,operation_id,payment_amount,method,reference,payment_on,payment_notes);
 select financial_account_id into recorded from public.supplier_payments where id=result_id;
 if recorded is distinct from target_account then raise exception 'This payment operation was already recorded from a different account'; end if;
 return result_id;
end;$$;
revoke all on function public.complete_sale_with_account(uuid,uuid,numeric,public.supplier_payment_method,text,text,date,uuid),public.record_customer_payment_with_account(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,timestamptz,text,uuid),public.record_supplier_payment_with_account(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,date,text,uuid) from public,anon;
grant execute on function public.complete_sale_with_account(uuid,uuid,numeric,public.supplier_payment_method,text,text,date,uuid),public.record_customer_payment_with_account(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,timestamptz,text,uuid),public.record_supplier_payment_with_account(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,date,text,uuid) to authenticated;

-- In-transit stock is valued from the immutable dispatch movement cost event.
create view public.transfer_cost_in_transit with (security_invoker=true) as
select t.source_branch_id,t.destination_branch_id,t.id transfer_id,t.transfer_number,i.id transfer_item_id,i.variant_id,
 i.dispatched_quantity,i.received_quantity,e.unit_cost,
 case when e.cost_status='COMPLETE' then round(i.dispatched_quantity*e.unit_cost,4) else null end as in_transit_value,
 case when e.cost_status='COMPLETE' then 'COMPLETE'::public.inventory_cost_status else 'MISSING'::public.inventory_cost_status end as cost_status
from public.stock_transfers t join public.stock_transfer_items i on i.transfer_id=t.id
left join public.inventory_cost_events e on e.stock_movement_id=i.transfer_out_movement_id
where t.status='DISPATCHED';
revoke all on public.transfer_cost_in_transit from public,anon,authenticated;
grant select on public.transfer_cost_in_transit to authenticated;

-- Replaying an event earlier than an explicit cost baseline invalidates current
-- WAC: the baseline included a different physical history. Never invent costs.
alter table public.branch_inventory_costs add column baseline_quantity numeric(14,3),add column baseline_value numeric(18,4),add column baseline_wac numeric(18,6);
update public.branch_inventory_costs set baseline_quantity=quantity_on_hand,baseline_value=inventory_value,baseline_wac=weighted_average_cost where initialized_at is not null;
alter table public.inventory_cost_events add column effective_at timestamptz;
update public.inventory_cost_events e set effective_at=m.occurred_at from public.stock_movements m where m.id=e.stock_movement_id;
alter table public.inventory_cost_events alter column effective_at set not null;
create index inventory_cost_events_effective_idx on public.inventory_cost_events(branch_id,variant_id,effective_at,stock_movement_id);

create or replace function public.initialize_inventory_cost(target_branch uuid,target_variant uuid,unit_cost numeric,effective_note text) returns void language plpgsql security definer set search_path='' as $$
declare current_qty numeric(14,3); current_date date := (now() at time zone 'Africa/Accra')::date;
begin
 if auth.uid() is null or not public.has_permission('inventory.cost.initialize') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to initialize this inventory cost'; end if;
 if unit_cost is null or unit_cost<0 or unit_cost<>round(unit_cost,2) then raise exception 'Enter a non-negative unit cost with no more than two decimal places'; end if;
 if char_length(trim(coalesce(effective_note,'')))<5 then raise exception 'Describe the source of this opening cost'; end if;
 insert into public.branch_inventory(branch_id,variant_id) values(target_branch,target_variant) on conflict(branch_id,variant_id) do nothing;
 select quantity_on_hand into current_qty from public.branch_inventory where branch_id=target_branch and variant_id=target_variant for update;
 insert into public.branch_inventory_costs(branch_id,variant_id,quantity_on_hand,inventory_value,weighted_average_cost,cost_status,initialized_at,initialized_by,baseline_quantity,baseline_value,baseline_wac)
 values(target_branch,target_variant,current_qty,round(current_qty*unit_cost,4),unit_cost,'COMPLETE',now(),auth.uid(),current_qty,round(current_qty*unit_cost,4),unit_cost)
 on conflict(branch_id,variant_id) do update set quantity_on_hand=excluded.quantity_on_hand,inventory_value=excluded.inventory_value,weighted_average_cost=excluded.weighted_average_cost,cost_status='COMPLETE',initialized_at=now(),initialized_by=auth.uid(),baseline_quantity=excluded.baseline_quantity,baseline_value=excluded.baseline_value,baseline_wac=excluded.baseline_wac,updated_at=now()
 where public.branch_inventory_costs.initialized_at is null and public.branch_inventory_costs.cost_status='MISSING';
 if not found then raise exception 'An inventory cost baseline already exists'; end if;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,metadata) values(auth.uid(),target_branch,'inventory.cost_baseline_initialized','branch_inventory_costs',jsonb_build_object('variant_id',target_variant,'quantity',current_qty,'unit_cost',unit_cost,'inventory_value',round(current_qty*unit_cost,4),'source_note',trim(effective_note),'effective_date',current_date));
end;$$;

comment on view public.transfer_cost_in_transit is 'Dispatched transfer valuation uses dispatch-time source-branch cost; unknown dispatch cost remains null.';
