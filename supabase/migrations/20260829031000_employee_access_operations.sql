create function public.configure_employee_access(target_user_id uuid, target_role_id uuid, target_branch_ids uuid[], target_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare target_scope public.role_scope;
begin
  if not public.has_permission('users.manage') then raise exception 'Insufficient permission'; end if;
  if target_user_id = auth.uid() then raise exception 'Self-management is not permitted'; end if;
  select scope into target_scope from public.roles where id = target_role_id;
  if target_scope is null then raise exception 'Invalid role'; end if;
  if target_scope = 'BRANCH' and target_active and coalesce(cardinality(target_branch_ids), 0) = 0 then raise exception 'Active branch roles require a branch assignment'; end if;

  update public.profiles set role_id = target_role_id, is_active = target_active where id = target_user_id;
  if not found then raise exception 'Employee profile not found'; end if;
  update public.user_branches set is_active = false where user_id = target_user_id;
  insert into public.user_branches(user_id, branch_id, is_active)
  select target_user_id, branch_id, true from unnest(coalesce(target_branch_ids, array[]::uuid[])) branch_id
  on conflict(user_id, branch_id) do update set is_active = true;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'user.access_configured', 'profiles', target_user_id, jsonb_build_object('role_id', target_role_id, 'branch_count', coalesce(cardinality(target_branch_ids), 0), 'is_active', target_active));
end;
$$;
revoke all on function public.configure_employee_access(uuid, uuid, uuid[], boolean) from public;
grant execute on function public.configure_employee_access(uuid, uuid, uuid[], boolean) to authenticated;
