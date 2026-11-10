import { RoleExplorer } from "./role-explorer";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function AccessPage() {
  await requirePermission("roles.read");
  const supabase = await createClient();
  const { data: roles, error } = await supabase
    .from("roles")
    .select(
      "id, code, name, scope, role_permissions(permissions(code, description))",
    )
    .order("name");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & access"
        description="Review what each role can access. These system roles are read-only; assign employee roles from Employees."
      />
      {error ? (
        <p role="alert" className="rounded-lg bg-secondary p-4">
          Roles could not be loaded. Please refresh the page to try again.
        </p>
      ) : (
        <RoleExplorer
          roles={(roles ?? []).map((role) => ({
            id: role.id,
            code: role.code,
            name: role.name,
            scope: role.scope,
            permissions: role.role_permissions.flatMap((item) =>
              item.permissions
                ? Array.isArray(item.permissions)
                  ? item.permissions
                  : [item.permissions]
                : [],
            ),
          }))}
        />
      )}
    </div>
  );
}
