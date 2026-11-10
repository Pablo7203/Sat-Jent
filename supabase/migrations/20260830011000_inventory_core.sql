-- SAT-J Ent Phase 3: branch balances, immutable ledger, adjustments, and counts.
alter table public.units_of_measure add column allows_decimal boolean not null default false;

create type public.stock_movement_type as enum ('OPENING_STOCK','ADJUSTMENT_INCREASE','ADJUSTMENT_DECREASE','STOCK_COUNT_INCREASE','STOCK_COUNT_DECREASE');
create type public.inventory_document_status as enum ('DRAFT','COMPLETED','CANCELLED');
create type public.stock_count_status as enum ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED');
create type public.adjustment_direction as enum ('INCREASE','DECREASE','BOTH');

create table public.branch_inventory(
 id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id) on delete restrict,
 variant_id uuid not null references public.product_variants(id) on delete restrict,
 quantity_on_hand numeric(14,3) not null default 0 check(quantity_on_hand>=0),
 minimum_stock_level numeric(14,3) not null default 0 check(minimum_stock_level>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(branch_id,variant_id)
);
create table public.stock_movements(
 id uuid primary key default gen_random_uuid(), branch_id uuid not null references public.branches(id) on delete restrict,
 variant_id uuid not null references public.product_variants(id) on delete restrict, movement_type public.stock_movement_type not null,
 quantity_delta numeric(14,3) not null check(quantity_delta<>0), balance_before numeric(14,3) not null check(balance_before>=0),
 balance_after numeric(14,3) not null check(balance_after>=0 and balance_after=balance_before+quantity_delta),
 reference_type text not null check(reference_type in ('OPENING_STOCK','STOCK_ADJUSTMENT','STOCK_COUNT')), reference_id uuid,
 reason_code text, notes text check(notes is null or char_length(notes)<=1000), performed_by uuid not null references auth.users(id) on delete restrict,
 occurred_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.stock_adjustment_reasons(
 id uuid primary key, code text not null unique check(code=upper(code)), name text not null,
 direction public.adjustment_direction not null, requires_note boolean not null default false, is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.inventory_number_sequences(year integer not null, document_type text not null check(document_type in ('ADJ','CNT')), last_number bigint not null default 0, primary key(year,document_type));
create table public.stock_adjustments(
 id uuid primary key default gen_random_uuid(), adjustment_number text not null unique, branch_id uuid not null references public.branches(id) on delete restrict,
 status public.inventory_document_status not null default 'DRAFT', reason_id uuid not null references public.stock_adjustment_reasons(id) on delete restrict,
 notes text check(notes is null or char_length(notes)<=1000), created_by uuid not null references auth.users(id) on delete restrict,
 completed_by uuid references auth.users(id) on delete restrict, created_at timestamptz not null default now(), completed_at timestamptz
);
create table public.stock_adjustment_items(
 id uuid primary key default gen_random_uuid(), adjustment_id uuid not null references public.stock_adjustments(id) on delete restrict,
 variant_id uuid not null references public.product_variants(id) on delete restrict, quantity numeric(14,3) not null check(quantity>0),
 direction public.adjustment_direction not null check(direction in ('INCREASE','DECREASE')), notes text check(notes is null or char_length(notes)<=500),
 stock_movement_id uuid unique references public.stock_movements(id) on delete restrict, unique(adjustment_id,variant_id)
);
create table public.stock_counts(
 id uuid primary key default gen_random_uuid(), count_number text not null unique, branch_id uuid not null references public.branches(id) on delete restrict,
 status public.stock_count_status not null default 'DRAFT', notes text check(notes is null or char_length(notes)<=1000),
 started_by uuid not null references auth.users(id) on delete restrict, completed_by uuid references auth.users(id) on delete restrict,
 started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table public.stock_count_items(
 id uuid primary key default gen_random_uuid(), stock_count_id uuid not null references public.stock_counts(id) on delete restrict,
 variant_id uuid not null references public.product_variants(id) on delete restrict, system_quantity numeric(14,3), counted_quantity numeric(14,3) check(counted_quantity>=0),
 variance numeric(14,3), snapshot_at timestamptz, stock_movement_id uuid unique references public.stock_movements(id) on delete restrict,
 notes text check(notes is null or char_length(notes)<=500), unique(stock_count_id,variant_id)
);

create index branch_inventory_branch_idx on public.branch_inventory(branch_id);
create index branch_inventory_variant_idx on public.branch_inventory(variant_id);
create index stock_movements_branch_time_idx on public.stock_movements(branch_id,occurred_at desc);
create index stock_movements_variant_time_idx on public.stock_movements(variant_id,occurred_at desc);
create index stock_adjustments_branch_time_idx on public.stock_adjustments(branch_id,created_at desc);
create index stock_counts_branch_time_idx on public.stock_counts(branch_id,created_at desc);
create index count_items_count_idx on public.stock_count_items(stock_count_id);
create index adjustment_items_adjustment_idx on public.stock_adjustment_items(adjustment_id);
create trigger branch_inventory_updated_at before update on public.branch_inventory for each row execute function public.set_updated_at();

insert into public.stock_adjustment_reasons(id,code,name,direction,requires_note) values
('70000000-0000-4000-8000-000000000001','DAMAGED','Damaged Stock','DECREASE',true),
('70000000-0000-4000-8000-000000000002','BROKEN','Broken Stock','DECREASE',true),
('70000000-0000-4000-8000-000000000003','MISSING','Missing Stock','DECREASE',true),
('70000000-0000-4000-8000-000000000004','COUNT_DIFFERENCE','Count Difference','BOTH',false),
('70000000-0000-4000-8000-000000000005','DATA_CORRECTION','Data Correction','BOTH',true),
('70000000-0000-4000-8000-000000000006','FOUND_STOCK','Found Stock','INCREASE',true),
('70000000-0000-4000-8000-000000000007','OTHER','Other','BOTH',true)
on conflict(code) do update set name=excluded.name,direction=excluded.direction,requires_note=excluded.requires_note;
