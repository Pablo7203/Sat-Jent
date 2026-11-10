import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { CustomerForm } from "@/features/sales/forms";
import { requirePermission } from "@/lib/auth/authorization";
export default async function Page() {
  await requirePermission("customers.create");
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/app/customers"
        title="Add customer"
        description="Use a named customer for partial-payment and credit sales."
      />
      <Card>
        <CustomerForm />
      </Card>
    </div>
  );
}
