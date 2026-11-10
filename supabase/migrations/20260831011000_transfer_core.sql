-- SAT-J Ent Phase 6: transfer headers, immutable quantities and inventory extensions.
alter type public.stock_movement_type add value 'TRANSFER_OUT';
alter type public.stock_movement_type add value 'TRANSFER_IN';
alter table public.stock_movements drop constraint stock_movements_reference_type_check;
alter table public.stock_movements add constraint stock_movements_reference_type_check check(reference_type in('OPENING_STOCK','STOCK_ADJUSTMENT','STOCK_COUNT','GOODS_RECEIPT','SALE','STOCK_TRANSFER'));

create type public.stock_transfer_status as enum('DRAFT','REQUESTED','APPROVED','DISPATCHED','RECEIVED','CANCELLED');
create table public.transfer_number_sequences(year integer primary key,last_number bigint not null default 0 check(last_number>=0));

create table public.stock_transfers(
 id uuid primary key default gen_random_uuid(),transfer_number text not null unique,
 source_branch_id uuid not null references public.branches(id) on delete restrict,destination_branch_id uuid not null references public.branches(id) on delete restrict,
 status public.stock_transfer_status not null default 'DRAFT',notes text check(notes is null or char_length(notes)<=1000),
 requested_by uuid references auth.users(id) on delete restrict,requested_at timestamptz,
 approved_by uuid references auth.users(id) on delete restrict,approved_at timestamptz,
 dispatched_by uuid references auth.users(id) on delete restrict,dispatched_at timestamptz,dispatch_operation_key uuid unique,
 received_by uuid references auth.users(id) on delete restrict,received_at timestamptz,receive_operation_key uuid unique,
 cancelled_by uuid references auth.users(id) on delete restrict,cancelled_at timestamptz,cancellation_reason text,
 created_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint transfer_distinct_branches check(source_branch_id<>destination_branch_id),
 constraint transfer_lifecycle_fields check(
  (status='DRAFT') or
  (status='REQUESTED' and requested_by is not null and requested_at is not null) or
  (status='APPROVED' and requested_by is not null and requested_at is not null and approved_by is not null and approved_at is not null) or
  (status='DISPATCHED' and requested_by is not null and requested_at is not null and approved_by is not null and approved_at is not null and dispatched_by is not null and dispatched_at is not null and dispatch_operation_key is not null) or
  (status='RECEIVED' and requested_by is not null and requested_at is not null and approved_by is not null and approved_at is not null and dispatched_by is not null and dispatched_at is not null and dispatch_operation_key is not null and received_by is not null and received_at is not null and receive_operation_key is not null) or
  (status='CANCELLED' and cancelled_by is not null and cancelled_at is not null and char_length(trim(cancellation_reason))>=3)
 )
);

create table public.stock_transfer_items(
 id uuid primary key default gen_random_uuid(),transfer_id uuid not null references public.stock_transfers(id) on delete restrict,
 variant_id uuid not null references public.product_variants(id) on delete restrict,
 requested_quantity numeric(14,3) not null check(requested_quantity>0),approved_quantity numeric(14,3) check(approved_quantity>0 and approved_quantity<=requested_quantity),
 dispatched_quantity numeric(14,3) not null default 0 check(dispatched_quantity>=0),received_quantity numeric(14,3) not null default 0 check(received_quantity>=0 and received_quantity<=dispatched_quantity),
 transfer_out_movement_id uuid unique references public.stock_movements(id) on delete restrict,transfer_in_movement_id uuid unique references public.stock_movements(id) on delete restrict,
 product_name_snapshot text not null,variant_name_snapshot text not null,sku_snapshot text not null,unit_snapshot text not null,
 notes text check(notes is null or char_length(notes)<=500),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(transfer_id,variant_id),check(dispatched_quantity=0 or (approved_quantity is not null and dispatched_quantity=approved_quantity)),check(received_quantity=0 or received_quantity=dispatched_quantity)
);

create index transfers_source_time_idx on public.stock_transfers(source_branch_id,created_at desc);
create index transfers_destination_time_idx on public.stock_transfers(destination_branch_id,created_at desc);
create index transfers_status_time_idx on public.stock_transfers(status,created_at desc);
create index transfer_items_transfer_idx on public.stock_transfer_items(transfer_id);
create index transfer_items_variant_idx on public.stock_transfer_items(variant_id);
create trigger stock_transfers_updated_at before update on public.stock_transfers for each row execute function public.set_updated_at();
create trigger stock_transfer_items_updated_at before update on public.stock_transfer_items for each row execute function public.set_updated_at();
