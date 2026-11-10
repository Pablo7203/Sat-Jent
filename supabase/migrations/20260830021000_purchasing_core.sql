-- SAT-J Ent Phase 4: suppliers, purchases, immutable receipts and payments.
alter type public.stock_movement_type add value 'PURCHASE_RECEIPT';
alter table public.stock_movements drop constraint stock_movements_reference_type_check;
alter table public.stock_movements add constraint stock_movements_reference_type_check check(reference_type in ('OPENING_STOCK','STOCK_ADJUSTMENT','STOCK_COUNT','GOODS_RECEIPT'));

create type public.purchase_status as enum('DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED');
create type public.purchase_payment_status as enum('UNPAID','PARTIALLY_PAID','PAID');
create type public.supplier_payment_method as enum('CASH','MOBILE_MONEY','BANK_TRANSFER','CARD_POS','OTHER');

create table public.purchasing_number_sequences(year integer not null,document_type text not null check(document_type in('SUP','PUR','GRN','SPY')),last_number bigint not null default 0,primary key(year,document_type));
create table public.suppliers(
 id uuid primary key default gen_random_uuid(),supplier_code text not null unique,name text not null check(char_length(trim(name)) between 2 and 160),company_name text,phone text,email text,address text,contact_person text,notes text,
 is_active boolean not null default true,created_by uuid not null references auth.users(id) on delete restrict,updated_by uuid references auth.users(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.purchases(
 id uuid primary key default gen_random_uuid(),purchase_number text not null unique,supplier_id uuid not null references public.suppliers(id) on delete restrict,branch_id uuid not null references public.branches(id) on delete restrict,
 supplier_invoice_number text,purchase_date date not null default current_date,expected_delivery_date date,status public.purchase_status not null default 'DRAFT',payment_status public.purchase_payment_status not null default 'UNPAID',
 subtotal numeric(14,2) not null default 0 check(subtotal>=0),discount_amount numeric(14,2) not null default 0 check(discount_amount>=0),other_costs numeric(14,2) not null default 0 check(other_costs>=0),total_amount numeric(14,2) not null default 0 check(total_amount>=0),amount_paid numeric(14,2) not null default 0 check(amount_paid>=0),balance_due numeric(14,2) not null default 0 check(balance_due>=0),currency_code text not null default 'GHS' check(currency_code='GHS'),notes text,
 created_by uuid not null references auth.users(id) on delete restrict,updated_by uuid references auth.users(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),cancelled_at timestamptz,cancelled_by uuid references auth.users(id) on delete restrict,
 check(total_amount=subtotal-discount_amount+other_costs),check(amount_paid+balance_due=total_amount),check(discount_amount<=subtotal+other_costs)
);
create table public.purchase_items(
 id uuid primary key default gen_random_uuid(),purchase_id uuid not null references public.purchases(id) on delete restrict,variant_id uuid not null references public.product_variants(id) on delete restrict,
 ordered_quantity numeric(14,3) not null check(ordered_quantity>0),received_quantity numeric(14,3) not null default 0 check(received_quantity>=0 and received_quantity<=ordered_quantity),unit_cost numeric(14,2) not null check(unit_cost>=0),discount_amount numeric(14,2) not null default 0 check(discount_amount>=0),line_total numeric(14,2) not null check(line_total>=0),notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(purchase_id,variant_id),check(line_total=round(ordered_quantity*unit_cost,2)-discount_amount),check(discount_amount<=round(ordered_quantity*unit_cost,2))
);
create table public.goods_receipts(
 id uuid primary key default gen_random_uuid(),receipt_number text not null unique,purchase_id uuid not null references public.purchases(id) on delete restrict,branch_id uuid not null references public.branches(id) on delete restrict,operation_key uuid not null,received_at timestamptz not null default now(),supplier_delivery_reference text,notes text,received_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now(),unique(purchase_id,operation_key)
);
create table public.goods_receipt_items(
 id uuid primary key default gen_random_uuid(),goods_receipt_id uuid not null references public.goods_receipts(id) on delete restrict,purchase_item_id uuid not null references public.purchase_items(id) on delete restrict,variant_id uuid not null references public.product_variants(id) on delete restrict,quantity_received numeric(14,3) not null check(quantity_received>0),stock_movement_id uuid not null unique references public.stock_movements(id) on delete restrict,created_at timestamptz not null default now(),unique(goods_receipt_id,purchase_item_id)
);
create table public.supplier_payments(
 id uuid primary key default gen_random_uuid(),payment_number text not null unique,supplier_id uuid not null references public.suppliers(id) on delete restrict,purchase_id uuid references public.purchases(id) on delete restrict,branch_id uuid not null references public.branches(id) on delete restrict,operation_key uuid not null,amount numeric(14,2) not null check(amount>0),payment_method public.supplier_payment_method not null,payment_reference text,payment_date date not null default current_date,notes text,recorded_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now(),unique(branch_id,operation_key)
);

create index suppliers_name_idx on public.suppliers(name);
create index purchases_branch_date_idx on public.purchases(branch_id,purchase_date desc);
create index purchases_supplier_date_idx on public.purchases(supplier_id,purchase_date desc);
create index purchases_status_idx on public.purchases(status,payment_status);
create index purchase_items_variant_idx on public.purchase_items(variant_id);
create index goods_receipts_purchase_idx on public.goods_receipts(purchase_id);
create index goods_receipts_branch_time_idx on public.goods_receipts(branch_id,received_at desc);
create index supplier_payments_supplier_date_idx on public.supplier_payments(supplier_id,payment_date desc);
create index supplier_payments_purchase_idx on public.supplier_payments(purchase_id);
create index supplier_payments_branch_date_idx on public.supplier_payments(branch_id,payment_date desc);
create trigger suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger purchases_updated_at before update on public.purchases for each row execute function public.set_updated_at();
create trigger purchase_items_updated_at before update on public.purchase_items for each row execute function public.set_updated_at();
