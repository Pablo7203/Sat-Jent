-- Phase 9: make the PostgREST/RPC boundary explicit.
-- Number generators are implementation details and must never be client-readable.
alter table public.purchasing_number_sequences enable row level security;
alter table public.sales_number_sequences enable row level security;
revoke all on table public.purchasing_number_sequences from anon, authenticated;
revoke all on table public.sales_number_sequences from anon, authenticated;

-- PostgreSQL grants EXECUTE to PUBLIC for new functions by default. Remove that
-- implicit capability, then restore only the functions that are deliberate APIs.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

grant execute on function
  public.current_user_is_active(),
  public.has_permission(text),
  public.can_access_branch(uuid),
  public.current_permission_codes(),
  public.configure_employee_access(uuid,uuid,uuid[],boolean),
  public.create_product_with_default_variant(text,text,uuid,uuid,uuid,boolean,public.product_status,text,text,text,numeric,numeric),
  public.change_product_price(uuid,uuid,public.price_type,numeric,timestamptz),
  public.is_valid_product_image_path(text),
  public.post_opening_stock_batch(uuid,jsonb,text),
  public.validate_inventory_quantity(uuid,numeric,boolean),
  public.create_stock_adjustment(uuid,uuid,text,jsonb),
  public.complete_stock_adjustment(uuid),
  public.cancel_stock_adjustment(uuid),
  public.create_stock_count(uuid,text,jsonb),
  public.start_stock_count(uuid),
  public.set_stock_count_quantity(uuid,numeric,text),
  public.complete_stock_count(uuid),
  public.cancel_stock_count(uuid),
  public.set_minimum_stock_level(uuid,uuid,numeric),
  public.inventory_integrity_issues(),
  public.create_supplier(text,text,text,text,text,text,text),
  public.update_supplier(uuid,text,text,text,text,text,text,text),
  public.set_supplier_active(uuid,boolean),
  public.create_purchase(uuid,uuid,date,date,text,text,numeric,numeric,jsonb),
  public.order_purchase(uuid),
  public.cancel_purchase(uuid),
  public.receive_purchase(uuid,uuid,text,text,jsonb),
  public.record_supplier_payment(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,date,text),
  public.resolve_selling_price(uuid,uuid,public.price_type,timestamptz),
  public.create_customer(text,public.customer_type,text,text,text,text,text),
  public.update_customer(uuid,text,public.customer_type,text,text,text,text,text),
  public.set_customer_active(uuid,boolean),
  public.create_sale(uuid,uuid,date,text,numeric,text,jsonb),
  public.complete_sale(uuid,uuid,numeric,public.supplier_payment_method,text,text),
  public.record_customer_payment(uuid,uuid,uuid,uuid,numeric,public.supplier_payment_method,text,timestamptz,text),
  public.reverse_customer_payment(uuid,text),
  public.cancel_sale(uuid,text),
  public.active_transfer_branches(),
  public.create_transfer(uuid,uuid,text,boolean,jsonb),
  public.update_draft_transfer(uuid,uuid,uuid,text,jsonb),
  public.request_transfer(uuid),
  public.approve_transfer(uuid),
  public.dispatch_transfer(uuid,uuid),
  public.receive_transfer(uuid,uuid),
  public.cancel_transfer(uuid,text),
  public.dashboard_summary(date,date,uuid),
  public.reporting_sales(date,date,uuid,integer,integer),
  public.reporting_receivable_aging(date,uuid),
  public.update_quotation_status(uuid,public.quotation_status)
to authenticated;

grant execute on function
  public.is_public_product_image(text),
  public.public_site_config(),
  public.public_categories(),
  public.public_branches(),
  public.public_brands(),
  public.public_catalogue(text,text,text,text,integer,integer,jsonb),
  public.public_attribute_filters(text),
  public.public_product(text),
  public.public_sitemap_entries(),
  public.submit_quotation(text,text,text,text,uuid,uuid,numeric,uuid,text,public.quotation_source,text)
to anon, authenticated;
