import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { PurchaseForm } from "@/features/purchasing/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("purchases.update");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: purchase }, { data: suppliers }, { data: items }] =
    await Promise.all([
      supabase
        .from("purchase_statement")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("suppliers")
        .select("id,supplier_code,name,phone")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("purchase_items")
        .select(
          "id,variant_id,ordered_quantity,unit_cost,discount_amount,variant:product_variants!inner(sku,name,product:products!inner(name,unit:units_of_measure!inner(symbol,allows_decimal)))",
        )
        .eq("purchase_id", id)
        .order("created_at"),
    ]);
  if (!purchase || purchase.status !== "DRAFT") notFound();
  if (
    !context.accessibleBranches.some(
      (branch) => branch.id === purchase.branch_id,
    )
  )
    notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/app/purchases/${id}`}
        title={`Edit ${purchase.purchase_number}`}
        description="Only draft orders can be edited. Saving or confirming the order does not change inventory."
      />
      <Card>
        <PurchaseForm
          suppliers={
            suppliers?.map((supplier) => ({
              id: supplier.id,
              label: `${supplier.supplier_code} — ${supplier.name}${supplier.phone ? ` · ${supplier.phone}` : ""}`,
            })) ?? []
          }
          branches={context.accessibleBranches
            .filter((branch) => branch.isActive)
            .map((branch) => ({ id: branch.id, label: branch.name }))}
          canBackdate={["SUPER_ADMIN", "OWNER"].includes(context.role.code)}
          purchase={{
            id,
            supplierId: purchase.supplier_id,
            branchId: purchase.branch_id,
            purchaseDate: purchase.purchase_date,
            expectedDate: purchase.expected_delivery_date ?? "",
            invoice: purchase.supplier_invoice_number ?? "",
            notes: purchase.notes ?? "",
            discount: String(purchase.discount_amount),
            otherCosts: String(purchase.other_costs),
          }}
          initialItems={
            items?.map((item) => {
              const variant = item.variant as unknown as {
                sku: string;
                name: string;
                product: {
                  name: string;
                  unit: { symbol: string; allows_decimal: boolean };
                };
              };
              return {
                variantId: item.variant_id,
                itemCode: variant.sku,
                productName: variant.product.name,
                variantName: variant.name,
                unitSymbol: variant.product.unit.symbol,
                allowsDecimal: variant.product.unit.allows_decimal,
                quantity: String(item.ordered_quantity),
                unitCost: String(item.unit_cost),
                discount: String(item.discount_amount),
              };
            }) ?? []
          }
        />
      </Card>
    </div>
  );
}
