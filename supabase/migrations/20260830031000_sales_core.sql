-- SAT-J Ent Phase 5: customers, sales, payment history and inventory movement extensions.
alter type public.stock_movement_type add value 'SALE';
alter type public.stock_movement_type add value 'SALE_REVERSAL';
alter table public.stock_movements drop constraint stock_movements_reference_type_check;
alter table public.stock_movements add constraint stock_movements_reference_type_check check(reference_type in('OPENING_STOCK','STOCK_ADJUSTMENT','STOCK_COUNT','GOODS_RECEIPT','SALE'));

create type public.customer_type as enum('INDIVIDUAL','CONTRACTOR','CONSTRUCTION_COMPANY','RETAILER','ARCHITECT_DESIGNER','OTHER');
create type public.sale_status as enum('DRAFT','COMPLETED','CANCELLED');
create type public.sale_payment_status as enum('UNPAID','PARTIALLY_PAID','PAID');
create type public.customer_payment_status as enum('POSTED','REVERSED');

create table public.sales_number_sequences(year integer not null,document_type text not null check(document_type in('CUS','SAL','RCP','CPY')),last_number bigint not null default 0,primary key(year,document_type));
create table public.customers(
 id uuid primary key default gen_random_uuid(),customer_code text not null unique,customer_type public.customer_type not null,name text not null check(char_length(trim(name)) between 2 and 160),company_name text,phone text,email text,address text,notes text,
 is_walk_in boolean not null default false,is_active boolean not null default true,created_by uuid references auth.users(id) on delete restrict,updated_by uuid references auth.users(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index customers_one_walk_in_idx on public.customers(is_walk_in) where is_walk_in;

create table public.sales(
 id uuid primary key default gen_random_uuid(),sale_number text not null unique,receipt_number text unique,branch_id uuid not null references public.branches(id) on delete restrict,customer_id uuid not null references public.customers(id) on delete restrict,
 status public.sale_status not null default 'DRAFT',payment_status public.sale_payment_status not null default 'UNPAID',sale_date timestamptz not null default now(),payment_due_date date,
 subtotal numeric(14,2) not null default 0 check(subtotal>=0),discount_amount numeric(14,2) not null default 0 check(discount_amount>=0),tax_amount numeric(14,2) not null default 0 check(tax_amount>=0),total_amount numeric(14,2) not null default 0 check(total_amount>=0),amount_paid numeric(14,2) not null default 0 check(amount_paid>=0),balance_due numeric(14,2) not null default 0 check(balance_due>=0),currency_code text not null default 'GHS' check(currency_code='GHS'),notes text,
 completion_operation_key uuid unique,created_by uuid not null references auth.users(id) on delete restrict,completed_by uuid references auth.users(id) on delete restrict,completed_at timestamptz,cancelled_by uuid references auth.users(id) on delete restrict,cancelled_at timestamptz,cancellation_reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(total_amount=subtotal-discount_amount+tax_amount),check(amount_paid+balance_due=total_amount),check(discount_amount<=subtotal+tax_amount)
);
create table public.sale_items(
 id uuid primary key default gen_random_uuid(),sale_id uuid not null references public.sales(id) on delete restrict,variant_id uuid not null references public.product_variants(id) on delete restrict,quantity numeric(14,3) not null check(quantity>0),price_type public.price_type not null default 'RETAIL',suggested_unit_price numeric(14,2) not null check(suggested_unit_price>=0),unit_price numeric(14,2) not null check(unit_price>=0),price_override_reason text,discount_amount numeric(14,2) not null default 0 check(discount_amount>=0),discount_reason text,line_total numeric(14,2) not null check(line_total>=0),stock_movement_id uuid unique references public.stock_movements(id) on delete restrict,reversal_movement_id uuid unique references public.stock_movements(id) on delete restrict,
 product_name_snapshot text not null,variant_name_snapshot text not null,sku_snapshot text not null,unit_snapshot text not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(sale_id,variant_id),check(line_total=round(quantity*unit_price,2)-discount_amount),check(discount_amount<=round(quantity*unit_price,2))
);
create table public.customer_payments(
 id uuid primary key default gen_random_uuid(),payment_number text not null unique,customer_id uuid not null references public.customers(id) on delete restrict,sale_id uuid not null references public.sales(id) on delete restrict,branch_id uuid not null references public.branches(id) on delete restrict,operation_key uuid not null,amount numeric(14,2) not null check(amount>0),payment_method public.supplier_payment_method not null,payment_reference text,payment_date timestamptz not null default now(),status public.customer_payment_status not null default 'POSTED',notes text,recorded_by uuid not null references auth.users(id) on delete restrict,reversed_at timestamptz,reversed_by uuid references auth.users(id) on delete restrict,reversal_reason text,created_at timestamptz not null default now(),unique(branch_id,operation_key),check((status='POSTED' and reversed_at is null and reversed_by is null and reversal_reason is null) or (status='REVERSED' and reversed_at is not null and reversed_by is not null and char_length(trim(reversal_reason))>=3))
);

create index customers_name_idx on public.customers(name);create index customers_phone_idx on public.customers(phone);
create index sales_branch_date_idx on public.sales(branch_id,sale_date desc);create index sales_customer_date_idx on public.sales(customer_id,sale_date desc);create index sales_status_idx on public.sales(status,payment_status);create index sales_due_idx on public.sales(payment_due_date) where balance_due>0;
create index sale_items_variant_idx on public.sale_items(variant_id);create index customer_payments_sale_idx on public.customer_payments(sale_id);create index customer_payments_customer_date_idx on public.customer_payments(customer_id,payment_date desc);create index customer_payments_branch_date_idx on public.customer_payments(branch_id,payment_date desc);
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();create trigger sales_updated_at before update on public.sales for each row execute function public.set_updated_at();create trigger sale_items_updated_at before update on public.sale_items for each row execute function public.set_updated_at();

insert into public.customers(id,customer_code,customer_type,name,is_walk_in,is_active) values('90000000-0000-4000-8000-000000000001','WALK-IN','INDIVIDUAL','Walk-In Customer',true,true);
