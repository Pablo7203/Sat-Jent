-- SAT-J Ent Phase 4: trusted purchasing transactions.
create function public.next_purchasing_number(kind text) returns text language plpgsql security definer set search_path='' as $$
declare yr integer:=extract(year from now())::integer;n bigint;
begin
 if kind not in('SUP','PUR','GRN','SPY') then raise exception 'Invalid document type';end if;
 insert into public.purchasing_number_sequences(year,document_type,last_number) values(yr,kind,1)
 on conflict(year,document_type) do update set last_number=public.purchasing_number_sequences.last_number+1 returning last_number into n;
 if kind='SUP' then return 'SUP-'||lpad(n::text,6,'0');end if;
 return kind||'-'||yr||'-'||lpad(n::text,6,'0');
end;$$;

create function public.create_supplier(supplier_name text,company text default null,contact text default null,phone_number text default null,email_address text default null,postal_address text default null,supplier_notes text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
 if not public.has_permission('suppliers.create') then raise exception 'You do not have permission to create suppliers';end if;
 if char_length(trim(coalesce(supplier_name,'')))<2 then raise exception 'Supplier name is required';end if;
 insert into public.suppliers(supplier_code,name,company_name,contact_person,phone,email,address,notes,created_by)
 values(public.next_purchasing_number('SUP'),trim(supplier_name),nullif(trim(company),''),nullif(trim(contact),''),nullif(trim(phone_number),''),nullif(lower(trim(email_address)),''),nullif(trim(postal_address),''),nullif(trim(supplier_notes),''),auth.uid()) returning id into new_id;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),'supplier.created','suppliers',new_id,jsonb_build_object('name',trim(supplier_name)));
 return new_id;
end;$$;

create function public.update_supplier(target_supplier uuid,supplier_name text,company text default null,contact text default null,phone_number text default null,email_address text default null,postal_address text default null,supplier_notes text default null) returns void language plpgsql security definer set search_path='' as $$
declare old_row public.suppliers%rowtype;
begin
 if not public.has_permission('suppliers.update') then raise exception 'You do not have permission to update suppliers';end if;
 select * into old_row from public.suppliers where id=target_supplier for update;if not found then raise exception 'Supplier not found';end if;
 if char_length(trim(coalesce(supplier_name,'')))<2 then raise exception 'Supplier name is required';end if;
 update public.suppliers set name=trim(supplier_name),company_name=nullif(trim(company),''),contact_person=nullif(trim(contact),''),phone=nullif(trim(phone_number),''),email=nullif(lower(trim(email_address)),''),address=nullif(trim(postal_address),''),notes=nullif(trim(supplier_notes),''),updated_by=auth.uid() where id=target_supplier;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values) values(auth.uid(),'supplier.updated','suppliers',target_supplier,to_jsonb(old_row)-'created_by',jsonb_build_object('name',trim(supplier_name),'company_name',company,'phone',phone_number,'email',email_address));
end;$$;

create function public.set_supplier_active(target_supplier uuid,new_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare old_active boolean;
begin
 if not public.has_permission('suppliers.archive') then raise exception 'You do not have permission to archive suppliers';end if;
 select is_active into old_active from public.suppliers where id=target_supplier for update;if not found then raise exception 'Supplier not found';end if;
 update public.suppliers set is_active=new_active,updated_by=auth.uid() where id=target_supplier;
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values) values(auth.uid(),case when new_active then 'supplier.reactivated' else 'supplier.archived' end,'suppliers',target_supplier,jsonb_build_object('is_active',old_active),jsonb_build_object('is_active',new_active));
end;$$;

create function public.create_purchase(target_supplier uuid,target_branch uuid,purchase_on date,expected_on date,supplier_invoice text,purchase_notes text,purchase_discount numeric,purchase_other_costs numeric,items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;item jsonb;variant uuid;qty numeric;cost numeric;discount numeric;line numeric;subtotal_value numeric(14,2):=0;total_value numeric(14,2);
begin
 if not public.has_permission('purchases.create') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to create a purchase for this branch';end if;
 if not exists(select 1 from public.branches where id=target_branch and is_active) then raise exception 'Purchases require an active branch';end if;
 if not exists(select 1 from public.suppliers where id=target_supplier and is_active) then raise exception 'Choose an active supplier';end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 then raise exception 'At least one purchase item is required';end if;
 if exists(select 1 from(select value->>'variant_id' from jsonb_array_elements(items) group by 1 having count(*)>1)d) then raise exception 'Duplicate variants are not allowed';end if;
 if coalesce(purchase_discount,0)<0 or coalesce(purchase_other_costs,0)<0 then raise exception 'Purchase adjustments cannot be negative';end if;
 insert into public.purchases(purchase_number,supplier_id,branch_id,purchase_date,expected_delivery_date,supplier_invoice_number,notes,created_by)
 values(public.next_purchasing_number('PUR'),target_supplier,target_branch,coalesce(purchase_on,current_date),expected_on,nullif(trim(supplier_invoice),''),nullif(trim(purchase_notes),''),auth.uid()) returning id into new_id;
 for item in select value from jsonb_array_elements(items) loop
  variant:=(item->>'variant_id')::uuid;qty:=(item->>'quantity')::numeric;cost:=(item->>'unit_cost')::numeric;discount:=coalesce((item->>'discount_amount')::numeric,0);
  perform public.validate_inventory_quantity(variant,qty,false);
  if cost<0 or discount<0 then raise exception 'Item costs and discounts cannot be negative';end if;
  line:=round(qty*cost,2)-discount;if line<0 then raise exception 'An item discount cannot exceed its value';end if;
  insert into public.purchase_items(purchase_id,variant_id,ordered_quantity,unit_cost,discount_amount,line_total,notes) values(new_id,variant,qty,cost,discount,line,nullif(trim(item->>'notes'),''));
  subtotal_value:=subtotal_value+line;
 end loop;
 total_value:=subtotal_value-coalesce(purchase_discount,0)+coalesce(purchase_other_costs,0);if total_value<0 then raise exception 'Purchase discount cannot exceed the purchase value';end if;
 update public.purchases set subtotal=subtotal_value,discount_amount=coalesce(purchase_discount,0),other_costs=coalesce(purchase_other_costs,0),total_amount=total_value,balance_due=total_value where id=new_id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),target_branch,'purchase.created','purchases',new_id,jsonb_build_object('supplier_id',target_supplier,'item_count',jsonb_array_length(items),'total_amount',total_value));
 return new_id;
end;$$;

create function public.order_purchase(target_purchase uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.purchases%rowtype;
begin select * into p from public.purchases where id=target_purchase for update;if not found then raise exception 'Purchase not found';end if;
 if not public.has_permission('purchases.update') or not public.can_access_branch(p.branch_id) then raise exception 'You do not have permission to order this purchase';end if;
 if p.status<>'DRAFT' then raise exception 'Only draft purchases can be ordered';end if;
 update public.purchases set status='ORDERED',updated_by=auth.uid() where id=p.id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),p.branch_id,'purchase.ordered','purchases',p.id,jsonb_build_object('purchase_number',p.purchase_number));end;$$;

create function public.cancel_purchase(target_purchase uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.purchases%rowtype;
begin select * into p from public.purchases where id=target_purchase for update;if not found then raise exception 'Purchase not found';end if;
 if not public.has_permission('purchases.cancel') or not public.can_access_branch(p.branch_id) then raise exception 'You do not have permission to cancel this purchase';end if;
 if p.status not in('DRAFT','ORDERED') or exists(select 1 from public.purchase_items where purchase_id=p.id and received_quantity>0) then raise exception 'A purchase with received goods cannot be cancelled';end if;
 update public.purchases set status='CANCELLED',cancelled_at=now(),cancelled_by=auth.uid(),updated_by=auth.uid() where id=p.id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),p.branch_id,'purchase.cancelled','purchases',p.id,jsonb_build_object('purchase_number',p.purchase_number));end;$$;

create function public.receive_purchase(target_purchase uuid,operation_id uuid,delivery_reference text,receipt_notes text,items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.purchases%rowtype;line public.purchase_items%rowtype;entry jsonb;qty numeric;movement uuid;receipt_id uuid;existing_id uuid;received_count integer:=0;received_total numeric:=0;remaining_items integer;
begin
 if operation_id is null then raise exception 'A receipt operation identifier is required';end if;
 select id into existing_id from public.goods_receipts where purchase_id=target_purchase and operation_key=operation_id;if found then return existing_id;end if;
 select * into p from public.purchases where id=target_purchase for update;if not found then raise exception 'Purchase not found';end if;
 if not public.has_permission('purchases.receive') or not public.can_access_branch(p.branch_id) then raise exception 'You do not have permission to receive this purchase';end if;
 if p.status not in('ORDERED','PARTIALLY_RECEIVED') then raise exception 'This purchase is not open for receiving';end if;
 if jsonb_typeof(items)<>'array' or jsonb_array_length(items)=0 then raise exception 'At least one receipt item is required';end if;
 if exists(select 1 from(select value->>'purchase_item_id' from jsonb_array_elements(items) group by 1 having count(*)>1)d) then raise exception 'Duplicate receipt items are not allowed';end if;
 insert into public.goods_receipts(receipt_number,purchase_id,branch_id,operation_key,supplier_delivery_reference,notes,received_by) values(public.next_purchasing_number('GRN'),p.id,p.branch_id,operation_id,nullif(trim(delivery_reference),''),nullif(trim(receipt_notes),''),auth.uid()) returning id into receipt_id;
 for entry in select value from jsonb_array_elements(items) order by value->>'purchase_item_id' loop
  select * into line from public.purchase_items where id=(entry->>'purchase_item_id')::uuid and purchase_id=p.id for update;if not found then raise exception 'Receipt item does not belong to this purchase';end if;
  qty:=(entry->>'quantity')::numeric;perform public.validate_inventory_quantity(line.variant_id,qty,false);
  if line.received_quantity+qty>line.ordered_quantity then raise exception 'You cannot receive more than the remaining ordered quantity';end if;
  movement:=public.inventory_apply_movement(p.branch_id,line.variant_id,'PURCHASE_RECEIPT',qty,'GOODS_RECEIPT',receipt_id,p.purchase_number,receipt_notes);
  insert into public.goods_receipt_items(goods_receipt_id,purchase_item_id,variant_id,quantity_received,stock_movement_id) values(receipt_id,line.id,line.variant_id,qty,movement);
  update public.purchase_items set received_quantity=received_quantity+qty where id=line.id;received_count:=received_count+1;received_total:=received_total+qty;
 end loop;
 select count(*) into remaining_items from public.purchase_items where purchase_id=p.id and received_quantity<ordered_quantity;
 update public.purchases set status=(case when remaining_items=0 then 'RECEIVED' else 'PARTIALLY_RECEIVED' end)::public.purchase_status,updated_by=auth.uid() where id=p.id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),p.branch_id,'purchase.goods_received','goods_receipts',receipt_id,jsonb_build_object('purchase_id',p.id,'purchase_number',p.purchase_number,'supplier_id',p.supplier_id,'item_count',received_count,'total_quantity',received_total));
 return receipt_id;
end;$$;

create function public.record_supplier_payment(target_supplier uuid,target_purchase uuid,target_branch uuid,operation_id uuid,payment_amount numeric,method public.supplier_payment_method,reference text,payment_on date,payment_notes text) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.purchases%rowtype;payment_id uuid;existing_id uuid;paid numeric(14,2);balance numeric(14,2);new_status public.purchase_payment_status;
begin
 if operation_id is null then raise exception 'A payment operation identifier is required';end if;
 select id into existing_id from public.supplier_payments where branch_id=target_branch and operation_key=operation_id;if found then return existing_id;end if;
 if not public.has_permission('supplier_payments.create') or not public.can_access_branch(target_branch) then raise exception 'You do not have permission to record this payment';end if;
 if payment_amount is null or payment_amount<=0 then raise exception 'Payment amount must be greater than zero';end if;
 if target_purchase is null then raise exception 'Supplier prepayments are not supported in this phase';end if;
 select * into p from public.purchases where id=target_purchase for update;if not found then raise exception 'Purchase not found';end if;
 if p.branch_id<>target_branch or p.supplier_id<>target_supplier then raise exception 'Payment does not match the purchase supplier and branch';end if;
 if p.status='CANCELLED' then raise exception 'A cancelled purchase cannot be paid';end if;
 if payment_amount>p.balance_due then raise exception 'The payment amount exceeds the outstanding balance';end if;
 insert into public.supplier_payments(payment_number,supplier_id,purchase_id,branch_id,operation_key,amount,payment_method,payment_reference,payment_date,notes,recorded_by)
 values(public.next_purchasing_number('SPY'),target_supplier,p.id,target_branch,operation_id,payment_amount,method,nullif(trim(reference),''),coalesce(payment_on,current_date),nullif(trim(payment_notes),''),auth.uid()) returning id into payment_id;
 paid:=p.amount_paid+payment_amount;balance:=p.total_amount-paid;new_status:=case when balance=0 then 'PAID'::public.purchase_payment_status when paid>0 then 'PARTIALLY_PAID'::public.purchase_payment_status else 'UNPAID'::public.purchase_payment_status end;
 update public.purchases set amount_paid=paid,balance_due=balance,payment_status=new_status,updated_by=auth.uid() where id=p.id;
 insert into public.audit_logs(actor_user_id,branch_id,action,entity_type,entity_id,metadata) values(auth.uid(),p.branch_id,'supplier_payment.recorded','supplier_payments',payment_id,jsonb_build_object('purchase_id',p.id,'supplier_id',target_supplier,'amount',payment_amount,'payment_number',(select payment_number from public.supplier_payments where id=payment_id)));
 return payment_id;
end;$$;

revoke all on function public.next_purchasing_number(text) from public;
grant execute on function public.create_supplier(text,text,text,text,text,text,text),public.update_supplier(uuid,text,text,text,text,text,text,text),public.set_supplier_active(uuid,boolean),public.create_purchase(uuid,uuid,date,date,text,text,numeric,numeric,jsonb),public.order_purchase(uuid),public.cancel_purchase(uuid),public.receive_purchase(uuid,uuid,text,text,jsonb),public.record_supplier_payment(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,date,text) to authenticated;
