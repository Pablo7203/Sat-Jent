import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { PurchaseForm } from "@/features/purchasing/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page() {
  const context = await requirePermission("purchases.create"),
    s = await createClient();
  const { data: suppliers } = await s
    .from("suppliers")
    .select("id,supplier_code,name,phone")
    .eq("is_active", true)
    .order("name");
  return (
    <div className="space-y-6">
      <PageHeader
        title="New purchase"
        description="Saving a draft does not change inventory. Stock changes only when goods are received."
      />
      <Card>
        <PurchaseForm
          suppliers={
            suppliers?.map((x) => ({
              id: x.id,
              label: `${x.supplier_code} — ${x.name}${x.phone ? ` · ${x.phone}` : ""}`,
            })) ?? []
          }
          branches={context.accessibleBranches
            .filter((x) => x.isActive)
            .map((x) => ({ id: x.id, label: x.name }))}
          canBackdate={["SUPER_ADMIN", "OWNER"].includes(context.role.code)}
        />
      </Card>
    </div>
  );
}
