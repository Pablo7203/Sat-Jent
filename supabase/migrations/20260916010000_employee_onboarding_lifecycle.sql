-- Keep invited identities inactive and hidden until password setup completes.
alter table public.profiles
  add column onboarding_completed_at timestamptz;

-- Preserve existing password-based employees. Invite-only Auth identities have
-- no password hash and intentionally remain pending.
update public.profiles p
set onboarding_completed_at = p.created_at
from auth.users u
where u.id = p.id
  and coalesce(u.encrypted_password, '') <> '';

update public.profiles
set is_active = false
where onboarding_completed_at is null;

create index profiles_onboarding_completed_idx
  on public.profiles(onboarding_completed_at)
  where onboarding_completed_at is not null;

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = '' as $$
declare super_admin_role uuid := '10000000-0000-4000-8000-000000000001';
declare completing_own_onboarding boolean :=
  auth.uid() = old.id
  and old.onboarding_completed_at is null
  and new.onboarding_completed_at is not null
  and new.role_id is not distinct from old.role_id
  and new.is_active;
begin
  if auth.uid() = old.id
     and (new.role_id is distinct from old.role_id or new.is_active is distinct from old.is_active)
     and not completing_own_onboarding then
    raise exception 'Users cannot change their own role or activation status';
  end if;
  if old.role_id = super_admin_role and old.is_active
     and (new.role_id is distinct from old.role_id or not new.is_active)
     and (select count(*) from public.profiles where role_id = super_admin_role and is_active and id <> old.id) = 0 then
    raise exception 'Cannot remove the final active Super Admin';
  end if;
  return new;
end;
$$;

create function public.complete_employee_onboarding()
returns boolean language plpgsql security definer set search_path = '' as $$
declare employee_id uuid := auth.uid();
declare employee_scope public.role_scope;
begin
  if employee_id is null then raise exception 'Authentication required'; end if;

  select r.scope into employee_scope
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = employee_id
    and p.onboarding_completed_at is null
  for update of p;

  if not found then return false; end if;
  if employee_scope = 'BRANCH' and not exists(
    select 1 from public.user_branches ub
    join public.branches b on b.id = ub.branch_id
    where ub.user_id = employee_id and ub.is_active and b.is_active
  ) then
    raise exception 'A branch assignment is required before activation';
  end if;

  update public.profiles
  set onboarding_completed_at = now(), is_active = true
  where id = employee_id;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id)
  values(employee_id, 'user.onboarding_completed', 'profiles', employee_id);
  return true;
end;
$$;

revoke all on function public.complete_employee_onboarding() from public, anon;
grant execute on function public.complete_employee_onboarding() to authenticated;
