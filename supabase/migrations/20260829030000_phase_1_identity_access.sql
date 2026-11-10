-- SAT-J Ent Phase 1: identity, branches, roles, permissions, RLS, and auditing.
create extension if not exists pgcrypto with schema extensions;

create type public.role_scope as enum ('COMPANY', 'BRANCH');

create table public.roles (
  id uuid primary key,
  code text not null unique check (code = upper(code)),
  name text not null,
  scope public.role_scope not null,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key,
  code text not null unique check (code = lower(code)),
  description text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete restrict,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null default '' check (char_length(full_name) <= 160),
  phone text check (phone is null or char_length(phone) <= 40),
  role_id uuid references public.roles(id) on delete restrict,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{2,20}$'),
  name text not null check (char_length(name) between 2 and 160),
  address text not null check (char_length(address) between 2 and 500),
  phone text not null check (char_length(phone) between 2 and 40),
  email text check (email is null or char_length(email) <= 254),
  opening_hours text check (opening_hours is null or char_length(opening_hours) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_branches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, branch_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index profiles_role_id_idx on public.profiles(role_id);
create index user_branches_user_active_idx on public.user_branches(user_id, is_active);
create index user_branches_branch_active_idx on public.user_branches(branch_id, is_active);
create index audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_user_id);

insert into public.roles (id, code, name, scope) values
  ('10000000-0000-4000-8000-000000000001', 'SUPER_ADMIN', 'Super Admin', 'COMPANY'),
  ('10000000-0000-4000-8000-000000000002', 'OWNER', 'Owner / Management', 'COMPANY'),
  ('10000000-0000-4000-8000-000000000003', 'BRANCH_MANAGER', 'Branch Manager', 'BRANCH'),
  ('10000000-0000-4000-8000-000000000004', 'SALES', 'Sales / Cashier', 'BRANCH'),
  ('10000000-0000-4000-8000-000000000005', 'INVENTORY', 'Inventory Officer', 'BRANCH')
on conflict (code) do update set name = excluded.name, scope = excluded.scope;

insert into public.permissions (id, code, description) values
  ('20000000-0000-4000-8000-000000000001', 'app.access', 'Access the internal application'),
  ('20000000-0000-4000-8000-000000000002', 'branches.read', 'Read accessible branches'),
  ('20000000-0000-4000-8000-000000000003', 'branches.manage', 'Create and update branches'),
  ('20000000-0000-4000-8000-000000000004', 'users.read', 'Read employee access records'),
  ('20000000-0000-4000-8000-000000000005', 'users.manage', 'Provision and manage employee access'),
  ('20000000-0000-4000-8000-000000000006', 'roles.read', 'Read roles and permissions'),
  ('20000000-0000-4000-8000-000000000007', 'audit.read', 'Read access audit history')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where (r.code = 'SUPER_ADMIN')
   or (r.code = 'OWNER' and p.code in ('app.access','branches.read','users.read','roles.read','audit.read'))
   or (r.code in ('BRANCH_MANAGER','SALES','INVENTORY') and p.code in ('app.access','branches.read'))
on conflict do nothing;

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger branches_updated_at before update on public.branches for each row execute function public.set_updated_at();

create function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone, role_id, is_active)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.raw_user_meta_data ->> 'phone', null, false)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create function public.current_user_is_active() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p join public.roles r on r.id = p.role_id where p.id = auth.uid() and p.is_active);
$$;
create function public.has_permission(permission_code text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions perm on perm.id = rp.permission_id
    where p.id = auth.uid() and p.is_active and perm.code = permission_code
  );
$$;
create function public.can_access_branch(branch_uuid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles p join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active and (
      r.scope = 'COMPANY' or (r.scope = 'BRANCH' and exists(
        select 1 from public.user_branches ub where ub.user_id = p.id and ub.branch_id = branch_uuid and ub.is_active
      ))
    )
  );
$$;

revoke all on function public.current_user_is_active() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.can_access_branch(uuid) from public;
grant execute on function public.current_user_is_active() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.can_access_branch(uuid) to authenticated;

create function public.protect_profile_privileges() returns trigger language plpgsql security definer set search_path = '' as $$
declare super_admin_role uuid := '10000000-0000-4000-8000-000000000001';
begin
  if auth.uid() = old.id and (new.role_id is distinct from old.role_id or new.is_active is distinct from old.is_active) then
    raise exception 'Users cannot change their own role or activation status';
  end if;
  if old.role_id = super_admin_role and old.is_active and (new.role_id is distinct from old.role_id or not new.is_active) and
     (select count(*) from public.profiles where role_id = super_admin_role and is_active and id <> old.id) = 0 then
    raise exception 'Cannot remove the final active Super Admin';
  end if;
  return new;
end;
$$;
create trigger protect_profile_privileges before update on public.profiles for each row execute function public.protect_profile_privileges();

create function public.audit_access_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare action_name text; entity_uuid uuid; branch_uuid uuid; old_doc jsonb; new_doc jsonb;
begin
  old_doc := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  new_doc := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;
  entity_uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  if tg_table_name = 'branches' then branch_uuid := entity_uuid; end if;
  action_name := lower(tg_table_name || '.' || tg_op);
  if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
    if new.role_id is distinct from old.role_id then action_name := 'user.role_changed';
    elsif new.is_active is distinct from old.is_active then action_name := case when new.is_active then 'user.activated' else 'user.deactivated' end;
    else action_name := 'user.updated'; end if;
  elsif tg_table_name = 'branches' and tg_op = 'INSERT' then action_name := 'branch.created';
  elsif tg_table_name = 'branches' and tg_op = 'UPDATE' then action_name := case when new.is_active is distinct from old.is_active then case when new.is_active then 'branch.activated' else 'branch.deactivated' end else 'branch.updated' end;
  elsif tg_table_name = 'user_branches' and tg_op = 'INSERT' then action_name := 'user.branch_assigned';
  elsif tg_table_name = 'user_branches' and tg_op in ('UPDATE','DELETE') then action_name := 'user.branch_assignment_changed';
  end if;
  insert into public.audit_logs(actor_user_id, branch_id, action, entity_type, entity_id, old_values, new_values)
  values(auth.uid(), branch_uuid, action_name, tg_table_name, entity_uuid, old_doc, new_doc);
  return coalesce(new, old);
end;
$$;
create trigger audit_profiles after update on public.profiles for each row execute function public.audit_access_change();
create trigger audit_branches after insert or update on public.branches for each row execute function public.audit_access_change();
create trigger audit_user_branches after insert or update or delete on public.user_branches for each row execute function public.audit_access_change();

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.user_branches enable row level security;
alter table public.audit_logs enable row level security;

create policy roles_read on public.roles for select to authenticated using (public.has_permission('roles.read') or public.current_user_is_active());
create policy permissions_read on public.permissions for select to authenticated using (public.has_permission('roles.read'));
create policy role_permissions_read on public.role_permissions for select to authenticated using (public.has_permission('roles.read'));
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.has_permission('users.read'));
create policy profiles_manage on public.profiles for update to authenticated using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));
create policy branches_read on public.branches for select to authenticated using (public.has_permission('branches.read') and public.can_access_branch(id));
create policy branches_insert on public.branches for insert to authenticated with check (public.has_permission('branches.manage'));
create policy branches_update on public.branches for update to authenticated using (public.has_permission('branches.manage')) with check (public.has_permission('branches.manage'));
create policy user_branches_read on public.user_branches for select to authenticated using (user_id = auth.uid() or public.has_permission('users.read'));
create policy user_branches_insert on public.user_branches for insert to authenticated with check (public.has_permission('users.manage') and user_id <> auth.uid());
create policy user_branches_update on public.user_branches for update to authenticated using (public.has_permission('users.manage') and user_id <> auth.uid()) with check (public.has_permission('users.manage') and user_id <> auth.uid());
create policy user_branches_delete on public.user_branches for delete to authenticated using (public.has_permission('users.manage') and user_id <> auth.uid());
create policy audit_logs_read on public.audit_logs for select to authenticated using (public.has_permission('audit.read'));

revoke insert, update, delete on public.roles, public.permissions, public.role_permissions, public.audit_logs from anon, authenticated;
grant select on public.roles, public.permissions, public.role_permissions, public.profiles, public.branches, public.user_branches, public.audit_logs to authenticated;
grant insert, update on public.branches to authenticated;
grant update on public.profiles to authenticated;
grant insert, update, delete on public.user_branches to authenticated;
