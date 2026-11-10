import { PageHeader } from "@/components/shared/page-header";
import { SaleForm } from "@/features/sales/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page() {
  const context = await requirePermission("sales.create"),
    s = await createClient();
  const { data: customers } = await s
    .from("customers")
    .select("id,customer_code,name,is_walk_in")
    .eq("is_active", true)
    .order("is_walk_in", { ascending: false })
    .order("name");
  return (
    <div className="space-y-6">
      <PageHeader
        title="New sale"
        description="Add products at their retail prices. Enter a quantity and press Enter to add the item; authorized staff can adjust the unit price first. Stock is checked again when the sale is completed."
      />
      <SaleForm
        customers={
          customers?.map((x) => ({
            id: x.id,
            label: `${x.is_walk_in ? "★ " : ""}${x.customer_code} — ${x.name}`,
            isWalkIn: x.is_walk_in,
          })) ?? []
        }
        branches={context.accessibleBranches
          .filter((x) => x.isActive)
          .map((x) => ({ id: x.id, label: x.name }))}
        canOverride={context.permissions.includes("sales.price_override")}
        canBackdate={["SUPER_ADMIN", "OWNER"].includes(context.role.code)}
      />
    </div>
  );
}
