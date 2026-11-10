import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { AdjustmentForm } from "@/features/inventory/forms";
import { related } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page() {
  const context = await requirePermission("inventory.adjust"),
    s = await createClient();
  const [{ data: reasons }, { data: variants }] = await Promise.all([
    s
      .from("stock_adjustment_reasons")
      .select("id,name,direction")
      .eq("is_active", true)
      .order("name"),
    s
      .from("product_variants")
      .select("id,sku,name,product:products!inner(name,status)")
      .eq("is_active", true)
      .eq("product.status", "ACTIVE")
      .order("sku"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="New stock adjustment"
        description="Only completion changes stock; multi-item posting is atomic at the database boundary."
      />
      <Card>
        <AdjustmentForm
          branches={context.accessibleBranches
            .filter((b) => b.isActive)
            .map((b) => ({ id: b.id, name: b.name }))}
          reasons={reasons ?? []}
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
