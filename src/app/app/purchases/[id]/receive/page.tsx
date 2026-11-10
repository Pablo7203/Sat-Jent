import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { ReceiptForm } from "@/features/purchasing/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("purchases.receive");
  const { id } = await params,
    s = await createClient();
  const [{ data: p }, { data: items }] = await Promise.all([
    s
      .from("purchase_statement")
      .select("purchase_number,supplier_name,branch_id,branch_name,status")
      .eq("id", id)
      .maybeSingle(),
    s
      .from("purchase_items")
      .select(
        "id,variant_id,ordered_quantity,received_quantity,unit_cost,variant:product_variants(sku,name,product:products(name,unit:units_of_measure(symbol,allows_decimal)))",
      )
      .eq("purchase_id", id),
  ]);
  if (!p || !["ORDERED", "PARTIALLY_RECEIVED"].includes(p.status)) notFound();
  const outstanding = (items ?? []).filter(
    (item) => Number(item.received_quantity) < Number(item.ordered_quantity),
  );
  const { data: sellingPrices } = await s.rpc(
    "current_selling_prices_for_branch",
    {
      target_branch: p.branch_id,
      target_variants: outstanding.map((item) => item.variant_id),
    },
  );
  const priceRows = (sellingPrices ?? []) as {
    variant_id: string;
    standard_selling_price: number | string | null;
  }[];
  const priceByVariant = new Map(
    priceRows.map((price) => [
      price.variant_id,
      price.standard_selling_price == null
        ? null
        : String(price.standard_selling_price),
    ]),
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Receive goods · ${p.purchase_number}`}
        description={`${p.supplier_name} · ${p.branch_name}. Enter the quantity delivered and the actual buying price for this delivery.`}
      />
      <Card>
        <ReceiptForm
          purchaseId={id}
          operationId={randomUUID()}
          receiptDate={new Date().toISOString().slice(0, 10)}
          branchId={p.branch_id}
          canBackdate={["SUPER_ADMIN", "OWNER"].includes(context.role.code)}
          branches={context.accessibleBranches.map((branch) => ({
            id: branch.id,
            name: branch.name,
          }))}
          canManagePrices={context.permissions.includes(
            "product_prices.manage",
          )}
          items={outstanding.map((i) => {
            const v = i.variant as unknown as {
              sku: string;
              name: string;
              product: {
                name: string;
                unit: { symbol: string; allows_decimal: boolean };
              };
            };
            return {
              id: i.id,
              variantId: i.variant_id,
              itemCode: v.sku,
              label: `Item Code ${v.sku} — ${v.product.name} / ${v.name}`,
              unitSymbol: v.product.unit.symbol,
              allowsDecimal: v.product.unit.allows_decimal,
              ordered: String(i.ordered_quantity),
              received: String(i.received_quantity),
              agreedCost: String(i.unit_cost),
              currentSellingPrice: priceByVariant.get(i.variant_id) ?? null,
            };
          })}
        />
      </Card>
    </div>
  );
}
