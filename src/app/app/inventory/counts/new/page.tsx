import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { CountForm } from "@/features/inventory/forms";
import { related } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page() {
  const context = await requirePermission("inventory.count"),
    s = await createClient();
  const { data: variants } = await s
    .from("product_variants")
    .select("id,sku,name,product:products!inner(name,status)")
    .eq("is_active", true)
    .eq("product.status", "ACTIVE")
    .order("sku");
  return (
    <div className="space-y-6">
      <PageHeader
        title="New stock count"
        description="Choose variants, start the snapshot, then enter physical quantities on a phone or desktop."
      />
      <Card>
        <CountForm
          branches={context.accessibleBranches
            .filter((b) => b.isActive)
            .map((b) => ({ id: b.id, name: b.name }))}
          variants={
            variants?.map((v) => ({
              id: v.id,
              label: `Item Code ${v.sku} — ${related(v.product)?.name} / ${v.name}`,
            })) ?? []
          }
        />
      </Card>
    </div>
  );
}
