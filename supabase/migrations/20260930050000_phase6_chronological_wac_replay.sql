-- Replay costed movement history from the last documented physical/value
-- baseline. A backdated event crossing that boundary invalidates the balance;
-- it never manufactures a replacement historical cost.
create function public.replay_inventory_cost(target_branch uuid,target_variant uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.branch_inventory_costs%rowtype; e public.inventory_cost_events%rowtype;
declare qty numeric(14,3); value numeric(18,4); wac numeric(18,6); running boolean:=true; line_cost numeric(18,6); line_value numeric(18,4);
declare physical_qty numeric(14,3);
begin
 select * into c from public.branch_inventory_costs where branch_id=target_branch and variant_id=target_variant for update;
 if not found or c.initialized_at is null or c.baseline_quantity is null then return; end if;
 select quantity_on_hand into physical_qty from public.branch_inventory where branch_id=target_branch and variant_id=target_variant;
 if exists(select 1 from public.inventory_cost_events where branch_id=target_branch and variant_id=target_variant and effective_at<=c.initialized_at and created_at>c.initialized_at) then
  update public.branch_inventory_costs set cost_status='MISSING',weighted_average_cost=null,inventory_value=0,updated_at=now() where branch_id=target_branch and variant_id=target_variant;
  update public.inventory_cost_events set cost_status='MISSING',unit_cost=null,value_delta=null where branch_id=target_branch and variant_id=target_variant;
  update public.sale_items i set cost_status='MISSING',cost_unit_snapshot=null,cost_total_snapshot=null from public.stock_movements m
   where i.stock_movement_id=m.id and m.branch_id=target_branch and m.variant_id=target_variant;
  update public.daily_sales_batch_items i set cost_status='MISSING',cost_unit_snapshot=null,cost_total_snapshot=null from public.stock_movements m
   where i.stock_movement_id=m.id and m.branch_id=target_branch and m.variant_id=target_variant;
  return;
 end if;
 qty:=c.baseline_quantity; value:=c.baseline_value; wac:=c.baseline_wac;
 running:=c.cost_status='COMPLETE' or c.baseline_wac is not null;
 for e in select * from public.inventory_cost_events where branch_id=target_branch and variant_id=target_variant and effective_at>c.initialized_at order by effective_at,stock_movement_id loop
  line_cost:=null; line_value:=null;
  if running then
   if e.quantity_delta>0 then
    line_cost:=e.unit_cost;
    if line_cost is null then running:=false;
    else value:=value+round(e.quantity_delta*line_cost,4); qty:=qty+e.quantity_delta; line_value:=round(e.quantity_delta*line_cost,4); wac:=case when qty=0 then wac else round(value/qty,6) end; end if;
   else
    line_cost:=wac;
    if line_cost is null or qty+e.quantity_delta<0 then running:=false;
    else line_value:=round(e.quantity_delta*line_cost,4); value:=greatest(0,value+line_value); qty:=qty+e.quantity_delta; if qty=0 then value:=0; else wac:=round(value/qty,6); end if; end if;
   end if;
  end if;
  update public.inventory_cost_events set unit_cost=line_cost,value_delta=line_value,cost_status=case when running then 'COMPLETE'::public.inventory_cost_status else 'MISSING'::public.inventory_cost_status end where id=e.id;
  if e.stock_movement_id is not null then
   update public.sale_items i set cost_unit_snapshot=line_cost,cost_total_snapshot=case when running then round(i.quantity*line_cost,4) else null end,
    cost_status=case when running then 'COMPLETE'::public.inventory_cost_status else 'MISSING'::public.inventory_cost_status end where i.stock_movement_id=e.stock_movement_id;
   update public.daily_sales_batch_items i set cost_unit_snapshot=line_cost,cost_total_snapshot=case when running then round(i.quantity*line_cost,4) else null end,
    cost_status=case when running then 'COMPLETE'::public.inventory_cost_status else 'MISSING'::public.inventory_cost_status end where i.stock_movement_id=e.stock_movement_id;
  end if;
 end loop;
 if qty is distinct from physical_qty then running:=false; end if;
 update public.branch_inventory_costs set quantity_on_hand=physical_qty,
  inventory_value=case when running then value else 0 end,
  weighted_average_cost=case when running then coalesce(wac,0) else null end,
  cost_status=case when running then 'COMPLETE'::public.inventory_cost_status else 'MISSING'::public.inventory_cost_status end,updated_at=now()
 where branch_id=target_branch and variant_id=target_variant;
end;$$;

create or replace function public.apply_inventory_movement_cost(target_movement uuid,target_unit_cost numeric,target_source text) returns void language plpgsql security definer set search_path='' as $$
declare m public.stock_movements%rowtype; c public.branch_inventory_costs%rowtype; resolved numeric(18,6):=target_unit_cost; source_name text:=target_source; status_value public.inventory_cost_status;
declare reference_item uuid;
begin
 select * into m from public.stock_movements where id=target_movement; if not found then raise exception 'Stock movement not found while applying cost'; end if;
 insert into public.branch_inventory_costs(branch_id,variant_id,quantity_on_hand) values(m.branch_id,m.variant_id,m.balance_before) on conflict(branch_id,variant_id) do nothing;
 select * into c from public.branch_inventory_costs where branch_id=m.branch_id and variant_id=m.variant_id for update;
 if resolved is null and m.movement_type='TRANSFER_IN' then
  begin reference_item:=m.reason_code::uuid; exception when others then reference_item:=null; end;
  select e.unit_cost into resolved from public.stock_transfer_items i join public.inventory_cost_events e on e.stock_movement_id=i.transfer_out_movement_id where i.id=reference_item and e.cost_status='COMPLETE';
  source_name:='TRANSFER';
 end if;
 if resolved is null and c.cost_status='COMPLETE' then resolved:=c.weighted_average_cost; source_name:=case when m.movement_type='TRANSFER_IN' then 'TRANSFER' else 'WAC_ISSUE' end; end if;
 status_value:=case when resolved is not null and (c.cost_status='COMPLETE' or (c.quantity_on_hand=0 and m.balance_before=0 and m.quantity_delta>0)) then 'COMPLETE'::public.inventory_cost_status else 'MISSING'::public.inventory_cost_status end;
 insert into public.inventory_cost_events(stock_movement_id,branch_id,variant_id,quantity_delta,unit_cost,value_delta,cost_status,source,effective_at)
 values(m.id,m.branch_id,m.variant_id,m.quantity_delta,resolved,case when status_value='COMPLETE' then round(m.quantity_delta*resolved,4) end,
  status_value,
  case when resolved is null then 'UNKNOWN' else source_name end,m.occurred_at)
 on conflict(stock_movement_id) do update set unit_cost=excluded.unit_cost,value_delta=excluded.value_delta,cost_status=excluded.cost_status,source=excluded.source,effective_at=excluded.effective_at;
 if c.initialized_at is not null then
  perform public.replay_inventory_cost(m.branch_id,m.variant_id);
 elsif status_value='COMPLETE' then
  update public.branch_inventory_costs set quantity_on_hand=m.balance_after,
   inventory_value=greatest(0,c.inventory_value+round(m.quantity_delta*resolved,4)),
   weighted_average_cost=case when m.balance_after=0 then c.weighted_average_cost when m.quantity_delta<0 then c.weighted_average_cost else round(greatest(0,c.inventory_value+round(m.quantity_delta*resolved,4))/m.balance_after,6) end,
   cost_status='COMPLETE',updated_at=now() where branch_id=m.branch_id and variant_id=m.variant_id;
 else
  update public.branch_inventory_costs set quantity_on_hand=m.balance_after,inventory_value=0,weighted_average_cost=null,cost_status='MISSING',updated_at=now() where branch_id=m.branch_id and variant_id=m.variant_id;
 end if;
end;$$;

create or replace function public.record_inventory_movement_cost() returns trigger language plpgsql security definer set search_path='' as $$
declare unit_cost numeric(18,6); reference_item uuid;
begin
 if new.movement_type='PURCHASE_RECEIPT' then return new; end if;
 if new.movement_type='SALE_REVERSAL' then
  if new.reference_type='DAILY_SALES_BATCH' then begin reference_item:=new.reason_code::uuid; exception when others then reference_item:=null; end;
   select i.cost_unit_snapshot into unit_cost from public.daily_sales_batch_items i where i.id=reference_item and i.variant_id=new.variant_id;
  elsif new.reference_type='SALE' then select i.cost_unit_snapshot into unit_cost from public.sale_items i where i.sale_id=new.reference_id and i.variant_id=new.variant_id and i.cost_status='COMPLETE' limit 1; end if;
  perform public.apply_inventory_movement_cost(new.id,unit_cost,'WAC_ISSUE'); return new;
 end if;
 perform public.apply_inventory_movement_cost(new.id,null,case when new.movement_type='TRANSFER_IN' then 'TRANSFER' else 'WAC_ISSUE' end); return new;
end;$$;

create or replace function public.record_receipt_inventory_cost() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.apply_inventory_movement_cost(new.stock_movement_id,new.actual_unit_cost,'RECEIPT'); return new; end;$$;

-- A completed backdated sale consumes stock at its business date, not the day
-- the clerk happened to enter/complete it. This makes subsequent cost replay
-- deterministic and properly chronological.
create or replace function public.complete_sale_with_account(target_sale uuid,operation_id uuid,initial_payment numeric,method public.supplier_payment_method,payment_reference text,payment_notes text,payment_on date,target_account uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; recorded uuid; sale_business_date date;
begin
 if coalesce(initial_payment,0)>0 then if target_account is null then raise exception 'Select the account receiving this payment'; end if; perform set_config('app.financial_account_id',target_account::text,true); end if;
 select sale_date::date into sale_business_date from public.sales where id=target_sale;
 perform set_config('app.stock_movement_at',coalesce(sale_business_date::timestamptz::text,''),true);
 result_id:=public.complete_sale(target_sale,operation_id,initial_payment,method,payment_reference,payment_notes,payment_on);
 perform set_config('app.stock_movement_at','',true);
 if coalesce(initial_payment,0)>0 then select financial_account_id into recorded from public.customer_payments where branch_id=(select branch_id from public.sales where id=result_id) and operation_key=operation_id; if recorded is distinct from target_account then raise exception 'This payment operation was already recorded to a different account'; end if; end if;
 return result_id;
end;$$;

revoke all on function public.replay_inventory_cost(uuid,uuid),public.apply_inventory_movement_cost(uuid,numeric,text),public.record_inventory_movement_cost(),public.record_receipt_inventory_cost() from public,anon,authenticated;
