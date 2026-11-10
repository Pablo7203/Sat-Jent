import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { configureEmployee } from "@/features/admin/actions";
import {
  ConfirmForm,
  DeleteEmployeeForm,
  InviteEmployeeForm,
  ResendInvitationForm,
} from "@/features/admin/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function UsersPage() {
  const context = await requirePermission("users.read");
  const supabase = await createClient();
  const canManage = context.permissions.includes("users.manage");
  const [
    { data: profiles },
    { data: pendingProfiles },
    { data: roles },
    { data: branches },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, phone, is_active, role_id, onboarding_completed_at, roles(name, code, scope), user_branches(branch_id, is_active, branches(name))",
      )
      .not("onboarding_completed_at", "is", null)
      .order("full_name"),
    canManage
      ? supabase
          .from("profiles")
          .select(
            "id, full_name, phone, created_at, role_id, roles(name, code, scope), user_branches(branch_id, is_active, branches(name))",
          )
          .is("onboarding_completed_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("roles").select("id, name, scope").order("name"),
    supabase
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
  ]);
  const authUsers = new Map<
    string,
    { email: string; invitedAt: string | null | undefined }
  >();
  try {
    const { data } = await createAdminClient().auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    data.users.forEach((user) =>
      authUsers.set(user.id, {
        email: user.email ?? "",
        invitedAt: user.invited_at,
      }),
    );
  } catch {
    /* Email listing requires server admin configuration. */
  }
  const canDelete = context.role.code === "SUPER_ADMIN";
  return (
    <div className="space-y-8">
      <PageHeader
        title="Employees"
        description="Employee access is deny-by-default and enforced by active profile, role, permissions, branch scope, and RLS."
      />
      {canManage && roles && branches ? (
        <Card>
          <h2 className="mb-5 text-xl font-bold">Invite employee</h2>
          <InviteEmployeeForm roles={roles} branches={branches} />
        </Card>
      ) : null}
      {canManage && pendingProfiles?.length ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Awaiting confirmation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These invitations have not yet been accepted. They cannot access
              SAT-J Ent and are not active employees.
            </p>
          </div>
          {pendingProfiles.map((profile) => {
            const role = profile.roles as unknown as {
              name: string;
              code: string;
              scope: string;
            } | null;
            const assignments = profile.user_branches as unknown as {
              branch_id: string;
              is_active: boolean;
              branches: { name: string } | null;
            }[];
            const invitedAt = authUsers.get(profile.id)?.invitedAt;
            return (
              <Card key={profile.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">
                      {profile.full_name || "Unnamed employee"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {authUsers.get(profile.id)?.email ||
                        "Email unavailable without admin configuration"}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                    Awaiting confirmation
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  <strong>Role on acceptance:</strong>{" "}
                  {role?.name ?? "Unassigned"}
                  <br />
                  <strong>Branches on acceptance:</strong>{" "}
                  {assignments
                    .filter((item) => item.is_active)
                    .map((item) => item.branches?.name)
                    .filter(Boolean)
                    .join(", ") ||
                    (role?.scope === "COMPANY" ? "All branches" : "None")}
                  <br />
                  <strong>Invitation sent:</strong>{" "}
                  {new Date(invitedAt || profile.created_at).toLocaleString()}
                </p>
                <ResendInvitationForm userId={profile.id} />
              </Card>
            );
          })}
        </section>
      ) : null}
      <div className="space-y-4">
        {profiles?.length ? (
          profiles.map((profile) => {
            const role = profile.roles as unknown as {
              name: string;
              code: string;
              scope: string;
            } | null;
            const assignments = profile.user_branches as unknown as {
              branch_id: string;
              is_active: boolean;
              branches: { name: string } | null;
            }[];
            return (
              <Card key={profile.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">
                      {profile.full_name || "Unnamed employee"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {authUsers.get(profile.id)?.email ||
                        "Email unavailable without admin configuration"}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                    {profile.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  <strong>Role:</strong> {role?.name ?? "Unassigned"}
                  <br />
                  <strong>Branches:</strong>{" "}
                  {assignments
                    .filter((item) => item.is_active)
                    .map((item) => item.branches?.name)
                    .filter(Boolean)
                    .join(", ") ||
                    (role?.scope === "COMPANY" ? "All branches" : "None")}
                </p>
                {canManage &&
                profile.id !== context.user.id &&
                roles &&
                branches ? (
                  <ConfirmForm
                    action={configureEmployee}
                    message={`Apply this access configuration to ${profile.full_name || "this employee"}?`}
                  >
                    <input type="hidden" name="userId" value={profile.id} />
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-semibold">
                        Role
                        <select
                          name="roleId"
                          defaultValue={profile.role_id ?? ""}
                          required
                          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
                        >
                          {roles.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-semibold">
                        Status
                        <select
                          name="isActive"
                          defaultValue={String(profile.is_active)}
                          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </label>
                    </div>
                    <fieldset className="mt-3">
                      <legend className="text-sm font-semibold">
                        Branch assignments
                      </legend>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {branches.map((branch) => (
                          <label
                            key={branch.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              name="branchIds"
                              value={branch.id}
                              defaultChecked={assignments.some(
                                (item) =>
                                  item.branch_id === branch.id &&
                                  item.is_active,
                              )}
                            />
                            {branch.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <Button className="mt-4" variant="secondary">
                      Update access
                    </Button>
                  </ConfirmForm>
                ) : null}
                {canDelete && profile.id !== context.user.id ? (
                  <DeleteEmployeeForm
                    userId={profile.id}
                    employeeName={profile.full_name || "this employee"}
                  />
                ) : null}
              </Card>
            );
          })
        ) : (
          <Card>
            <p>No employees found.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
