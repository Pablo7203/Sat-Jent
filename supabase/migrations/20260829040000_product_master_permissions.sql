-- SAT-J Ent Phase 2: product-master permissions and role grants.
insert into public.permissions (id, code, description) values
  ('20000000-0000-4000-8000-000000000101', 'products.read', 'Read the company product catalogue'),
  ('20000000-0000-4000-8000-000000000102', 'products.create', 'Create products and variants'),
  ('20000000-0000-4000-8000-000000000103', 'products.update', 'Update products and variants'),
  ('20000000-0000-4000-8000-000000000104', 'products.archive', 'Archive and reactivate products'),
  ('20000000-0000-4000-8000-000000000105', 'categories.read', 'Read product categories'),
  ('20000000-0000-4000-8000-000000000106', 'categories.manage', 'Manage product categories'),
  ('20000000-0000-4000-8000-000000000107', 'brands.read', 'Read product brands'),
  ('20000000-0000-4000-8000-000000000108', 'brands.manage', 'Manage product brands'),
  ('20000000-0000-4000-8000-000000000109', 'units.read', 'Read units of measure'),
  ('20000000-0000-4000-8000-000000000110', 'units.manage', 'Manage units of measure'),
  ('20000000-0000-4000-8000-000000000111', 'product_attributes.read', 'Read product attributes'),
  ('20000000-0000-4000-8000-000000000112', 'product_attributes.manage', 'Manage product attributes'),
  ('20000000-0000-4000-8000-000000000113', 'product_prices.read', 'Read product price history'),
  ('20000000-0000-4000-8000-000000000114', 'product_prices.manage', 'Manage product prices'),
  ('20000000-0000-4000-8000-000000000115', 'product_images.manage', 'Upload, order, and remove product images')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('SUPER_ADMIN', 'OWNER')
  and p.code in (
    'products.read', 'products.create', 'products.update', 'products.archive',
    'categories.read', 'categories.manage', 'brands.read', 'brands.manage',
    'units.read', 'units.manage', 'product_attributes.read',
    'product_attributes.manage', 'product_prices.read',
    'product_prices.manage', 'product_images.manage'
  )
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('BRANCH_MANAGER', 'SALES', 'INVENTORY')
  and p.code in (
    'products.read', 'categories.read', 'brands.read', 'units.read',
    'product_attributes.read', 'product_prices.read'
  )
on conflict do nothing;
