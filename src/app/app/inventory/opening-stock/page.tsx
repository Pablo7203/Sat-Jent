import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { OpeningStockForm } from "@/features/inventory/forms";
import { related } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page() {
  const context = await requirePermission("inventory.opening_stock");
  const s = await createClient();
  const { data: variants } = await s
    .from("product_variants")
    .select(
      "id,name,sku,product:products!inner(name,status,unit:units_of_measure(allows_decimal))",
    )
    .eq("is_active", true)
    .eq("product.status", "ACTIVE")
    .order("sku");
  const options =
    variants?.map((v) => {
      const p = related(v.product);
      const u = p ? related(p.unit) : null;
      return {
        id: v.id,
        label: `Item Code ${v.sku} — ${p?.name} / ${v.name}`,
        allowsDecimal: u?.allows_decimal ?? false,
      };
    }) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Opening stock"
        description="Initialize physical balances once. Future corrections must use adjustments or counts."
      />
      <Card>
        <p className="mb-5 rounded-lg bg-secondary p-3 text-sm">
          <strong>Confirmation required:</strong> posting creates permanent
          opening-stock ledger evidence. Empty rows are ignored; the submitted
          rows commit atomically.
        </p>
        <OpeningStockForm
          branches={context.accessibleBranches
            .filter((b) => b.isActive)
            .map((b) => ({ id: b.id, name: b.name }))}
          variants={options}
        />
      </Card>
    </div>
  );
}
