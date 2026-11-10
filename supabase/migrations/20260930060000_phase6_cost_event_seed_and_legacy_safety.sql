-- Initial known receipts with zero prior stock establish a known inventory
-- valuation even before an administrator starts a formal cost baseline.
create or replace function public.apply_inventory_movement_cost(target_movement uuid,target_unit_cost numeric,target_source text) returns void language plpgsql security definer set search_path='' as $$
declare m public.stock_movements%rowtype; c public.branch_inventory_costs%rowtype; resolved numeric(18,6):=target_unit_cost; source_name text:=target_source; status_value public.inventory_cost_status; reference_item uuid;
begin
 select * into m from public.stock_movements where id=target_movement; if not found then raise exception 'Stock movement not found while applying cost'; end if;
 insert into public.branch_inventory_costs(branch_id,variant_id,quantity_on_hand) values(m.branch_id,m.variant_id,m.balance_before) on conflict(branch_id,variant_id) do nothing;
 select * into c from public.branch_inventory_costs where branch_id=m.branch_id and variant_id=m.variant_id for update;
 if resolved is null and m.movement_type='TRANSFER_IN' then
  begin reference_item:=m.reason_code::uuid; exception when others then reference_item:=null; end;
  select e.unit_cost into resolved from public.stock_transfer_items i join public.inventory_cost_events e on e.stock_movement_id=i.transfer_out_movement_id where i.id=reference_item and e.cost_status='COMPLETE'; source_name:='TRANSFER';
 end if;
 if resolved is null and c.cost_status='COMPLETE' then resolved:=c.weighted_average_cost; source_name:=case when m.movement_type='TRANSFER_IN' then 'TRANSFER' else 'WAC_ISSUE' end; end if;
 status_value:=case when resolved is not null and (c.cost_status='COMPLETE' or (c.quantity_on_hand=0 and m.balance_before=0 and m.quantity_delta>0)) then 'COMPLETE'::public.inventory_cost_status else 'MISSING'::public.inventory_cost_status end;
 insert into public.inventory_cost_events(stock_movement_id,branch_id,variant_id,quantity_delta,unit_cost,value_delta,cost_status,source,effective_at)
 values(m.id,m.branch_id,m.variant_id,m.quantity_delta,resolved,case when status_value='COMPLETE' then round(m.quantity_delta*resolved,4) end,status_value,case when resolved is null then 'UNKNOWN' else source_name end,m.occurred_at)
 on conflict(stock_movement_id) do update set unit_cost=excluded.unit_cost,value_delta=excluded.value_delta,cost_status=excluded.cost_status,source=excluded.source,effective_at=excluded.effective_at;
 if c.initialized_at is not null then perform public.replay_inventory_cost(m.branch_id,m.variant_id);
 elsif status_value='COMPLETE' then
  update public.branch_inventory_costs set quantity_on_hand=m.balance_after,inventory_value=greatest(0,c.inventory_value+round(m.quantity_delta*resolved,4)),
   weighted_average_cost=case when m.balance_after=0 then c.weighted_average_cost when m.quantity_delta<0 then c.weighted_average_cost else round(greatest(0,c.inventory_value+round(m.quantity_delta*resolved,4))/m.balance_after,6) end,
   cost_status='COMPLETE',updated_at=now() where branch_id=m.branch_id and variant_id=m.variant_id;
 else update public.branch_inventory_costs set quantity_on_hand=m.balance_after,inventory_value=0,weighted_average_cost=null,cost_status='MISSING',updated_at=now() where branch_id=m.branch_id and variant_id=m.variant_id;
 end if;
end;$$;

create or replace function public.reverse_customer_payment_ledger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='POSTED' and new.status='REVERSED' and old.financial_account_id is not null then
  insert into public.financial_movements(account_id,branch_id,operation_key,movement_kind,direction,amount,reference_type,reference_id,effective_date,memo,recorded_by)
  values(old.financial_account_id,old.branch_id,md5(old.id::text||':customer-payment-reversal')::uuid,'ADJUSTMENT','OUT',old.amount,'CUSTOMER_PAYMENT_REVERSAL',old.id,(new.reversed_at at time zone 'Africa/Accra')::date,old.payment_number,new.reversed_by);
 end if; return new;
end;$$;
revoke all on function public.apply_inventory_movement_cost(uuid,numeric,text),public.reverse_customer_payment_ledger() from public,anon,authenticated;
