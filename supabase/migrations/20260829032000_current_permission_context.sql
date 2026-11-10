create function public.current_permission_codes() returns table(code text)
language sql stable security definer set search_path = '' as $$
  select perm.code from public.profiles p
  join public.role_permissions rp on rp.role_id = p.role_id
  join public.permissions perm on perm.id = rp.permission_id
  where p.id = auth.uid() and p.is_active;
$$;
revoke all on function public.current_permission_codes() from public;
grant execute on function public.current_permission_codes() to authenticated;

drop policy roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated using (
  public.has_permission('roles.read') or id = (select role_id from public.profiles where id = auth.uid() and is_active)
);
