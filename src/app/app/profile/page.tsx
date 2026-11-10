import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/features/profile/profile-form";
import { requireActiveProfile } from "@/lib/auth/authorization";
export default async function ProfilePage() {
  const context = await requireActiveProfile();
  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description="Update your contact details and review your current access configuration."
      />
      <Card>
        <h2 className="text-lg font-bold">Personal details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep your name and phone number current so the SAT-J team can reach
          you.
        </p>
        <div className="mt-5">
          <ProfileForm
            fullName={context.profile.fullName}
            phone={context.profile.phone}
          />
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">Access details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your email, role and branch access are managed by a Super Admin or
          Owner.
        </p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <Item
            label="Name"
            value={context.profile.fullName || "Not provided"}
          />
          <Item label="Email" value={context.user.email} />
          <Item label="Phone" value={context.profile.phone || "Not provided"} />
          <Item label="Role" value={context.role.name} />
          <Item label="Status" value="Active" />
          <Item
            label="Branches"
            value={
              context.role.scope === "COMPANY"
                ? "All branches"
                : context.accessibleBranches
                    .map((branch) => branch.name)
                    .join(", ") || "No active assignments"
            }
          />
        </dl>
      </Card>
    </div>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
