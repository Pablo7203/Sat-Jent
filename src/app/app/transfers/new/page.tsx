import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { TransferForm } from "@/features/transfers/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function NewTransferPage() {
  await requirePermission("transfers.create");
  const client = await createClient();
  const [{ data: branches }, { data: variants }, { data: inventory }] =
    await Promise.all([
      client.rpc("active_transfer_branches"),
      client
        .from("product_variants")
        .select("id,sku,barcode,name,product:products!inner(name,status)")
        .eq("is_active", true)
        .eq("product.status", "ACTIVE")
        .order("sku"),
      client
        .from("inventory_catalog")
        .select(
          "branch_name,sku,product_name,variant_name,quantity_on_hand,unit_symbol",
        )
        .gt("quantity_on_hand", 0)
        .order("branch_name")
        .limit(100),
    ]);
  const branchRows = (branches ?? []) as {
    id: string;
    code: string;
    name: string;
  }[];
  return (
    <div className="space-y-6">
      <PageHeader
        title="New stock transfer"
        description="Request full quantities from an authorized source branch to any active destination branch."
      />
      <Card>
        <TransferForm
          branches={branchRows.map((b) => ({
            id: b.id,
            label: `${b.code} — ${b.name}`,
          }))}
          variants={(variants ?? []).map((v) => ({
            id: v.id,
            label: `Item Code ${v.sku} — ${(v.product as unknown as { name: string }).name} / ${v.name}${v.barcode ? ` · ${v.barcode}` : ""}`,
          }))}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-bold">Available source stock</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {inventory?.map((row, index) => (
            <p
              className="text-sm"
              key={`${row.branch_name}-${row.sku}-${index}`}
            >
              <strong>{row.branch_name}</strong> · Item Code {row.sku} ·{" "}
              {row.product_name} / {row.variant_name}: {row.quantity_on_hand}{" "}
              {row.unit_symbol}
            </p>
          ))}
          {!inventory?.length ? (
            <p className="text-sm text-muted-foreground">
              No positive stock is visible in your authorized source branches.
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
