-- Employees may maintain their own contact details. Access controls and the
-- onboarding lifecycle remain administrator-controlled.
create or replace function public.protect_profile_privileges() returns trigger language plpgsql security definer set search_path = '' as $$
declare super_admin_role uuid := '10000000-0000-4000-8000-000000000001';
begin
  if auth.uid() = old.id and (
    new.role_id is distinct from old.role_id
    or new.is_active is distinct from old.is_active
    or new.onboarding_completed_at is distinct from old.onboarding_completed_at
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Users can only update their own contact details';
  end if;
  if old.role_id = super_admin_role and old.is_active and (new.role_id is distinct from old.role_id or not new.is_active) and
     (select count(*) from public.profiles where role_id = super_admin_role and is_active and id <> old.id) = 0 then
    raise exception 'Cannot remove the final active Super Admin';
  end if;
  return new;
end;
$$;

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
