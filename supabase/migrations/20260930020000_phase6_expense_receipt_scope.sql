-- Ensure an expense can only reference a private receipt stored beneath the
-- same branch-scoped object prefix enforced by the Storage policies.
alter table public.expenses
  add constraint expenses_receipt_path_branch_scope check (
    receipt_object_path is null
    or left(receipt_object_path, char_length(branch_id::text) + 1) = branch_id::text || '/'
  );
