import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { SupplierForm } from "@/features/purchasing/forms";
import { requirePermission } from "@/lib/auth/authorization";
export default async function Page() {
  await requirePermission("suppliers.create");
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/app/suppliers"
        title="Add supplier"
        description="Create a reusable supplier record. Similar names are allowed and are never silently merged."
      />
      <Card>
        <SupplierForm />
      </Card>
    </div>
  );
}
