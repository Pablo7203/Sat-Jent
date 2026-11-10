import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { BranchForm, ConfirmForm } from "@/features/admin/forms";
import { setBranchActive, updateBranch } from "@/features/admin/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function BranchesPage() {
  const context = await requirePermission("branches.read");
  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select(
      "id, code, name, address, phone, email, opening_hours, is_active, is_public",
    )
    .order("name");
  const canManage = context.permissions.includes("branches.manage");
  return (
    <div className="space-y-8">
      <PageHeader
        title="Branches"
        description="Branch visibility is limited by company or assigned-branch scope."
      />
      {canManage ? (
        <Card>
          <h2 className="mb-5 text-xl font-bold">Create branch</h2>
          <BranchForm />
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {branches?.length ? (
          branches.map((branch) => (
            <Card key={branch.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {branch.code}
                  </p>
                  <h2 className="text-xl font-bold">{branch.name}</h2>
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                  {branch.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {branch.address}
                <br />
                {branch.phone}
                {branch.email ? (
                  <>
                    <br />
                    {branch.email}
                  </>
                ) : null}
              </p>
              {canManage ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <details className="w-full rounded-lg border p-3">
                    <summary className="cursor-pointer font-semibold">
                      Edit branch details
                    </summary>
                    <ConfirmForm
                      action={updateBranch}
                      message={`Save changes to ${branch.name}?`}
                    >
                      <input type="hidden" name="id" value={branch.id} />
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <EditField
                          label="Code"
                          name="code"
                          value={branch.code}
                        />
                        <EditField
                          label="Name"
                          name="name"
                          value={branch.name}
                        />
                        <EditField
                          label="Address"
                          name="address"
                          value={branch.address}
                        />
                        <EditField
                          label="Phone"
                          name="phone"
                          value={branch.phone}
                        />
                        <EditField
                          label="Email"
                          name="email"
                          value={branch.email ?? ""}
                          type="email"
                        />
                        <EditField
                          label="Opening hours"
                          name="openingHours"
                          value={branch.opening_hours ?? ""}
                        />
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="isPublic"
                            defaultChecked={branch.is_public}
                          />
                          Show on public website
                        </label>
                      </div>
                      <Button className="mt-4">Save branch</Button>
                    </ConfirmForm>
                  </details>
                  <ConfirmForm
                    action={setBranchActive}
                    message={`${branch.is_active ? "Deactivate" : "Activate"} ${branch.name}?`}
                  >
                    <input type="hidden" name="id" value={branch.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={String(!branch.is_active)}
                    />
                    <Button className="mt-5" variant="secondary">
                      {branch.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </ConfirmForm>
                </div>
              ) : null}
            </Card>
          ))
        ) : (
          <Card>
            <p>No branches configured.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function EditField({
  label,
  name,
  value,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
}) {
  return (
    <Label>
      {label}
      <Input
        className="mt-1 font-normal"
        name={name}
        type={type}
        defaultValue={value}
        required={["code", "name", "address", "phone"].includes(name)}
      />
    </Label>
  );
}
