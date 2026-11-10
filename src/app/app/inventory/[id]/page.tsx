import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setMinimum } from "@/features/inventory/actions";
import { formatQuantity, movementLabel, related } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("inventory.read"),
    { id } = await params;
  const s = await createClient();
  const { data: item } = await s
    .from("branch_inventory")
    .select(
      "id,branch_id,variant_id,quantity_on_hand,minimum_stock_level,branch:branches(name),variant:product_variants(name,sku,barcode,product:products(name,unit:units_of_measure(symbol))),stock_movements(id,movement_type,quantity_delta,balance_before,balance_after,occurred_at)",
    )
    .eq("id", id)
    .order("occurred_at", {
      referencedTable: "stock_movements",
      ascending: false,
    })
    .limit(25, { referencedTable: "stock_movements" })
    .single();
  if (!item) notFound();
  const v = related(item.variant),
    p = v ? related(v.product) : null,
    u = p ? related(p.unit) : null,
    b = related(item.branch);
  const status =
    Number(item.quantity_on_hand) === 0
      ? "OUT OF STOCK"
      : Number(item.quantity_on_hand) <= Number(item.minimum_stock_level)
        ? "LOW STOCK"
        : "IN STOCK";
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${p?.name} · ${v?.name}`}
        description={`Item Code ${v?.sku} · ${b?.name}`}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <strong>{formatQuantity(item.quantity_on_hand, u?.symbol)}</strong>
          <p className="text-sm text-muted-foreground">Current balance</p>
        </Card>
        <Card>
          <strong>{formatQuantity(item.minimum_stock_level, u?.symbol)}</strong>
          <p className="text-sm text-muted-foreground">Minimum stock</p>
        </Card>
        <Card>
          <strong>{status}</strong>
          <p className="text-sm text-muted-foreground">Stock status</p>
        </Card>
      </div>
      {context.permissions.includes("inventory.settings.manage") ? (
        <Card>
          <form action={setMinimum} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="branchId" value={item.branch_id} />
            <input type="hidden" name="variantId" value={item.variant_id} />
            <Label>
              Minimum stock level
              <Input
                name="level"
                type="number"
                min="0"
                step="0.001"
                defaultValue={item.minimum_stock_level}
              />
            </Label>
            <Button>Update minimum</Button>
          </form>
        </Card>
      ) : null}
      <section>
        <h2 className="mb-3 text-xl font-bold">Recent movements</h2>
        <div className="space-y-2">
          {item.stock_movements?.map((m) => (
            <Card key={m.id}>
              <div className="flex justify-between gap-3">
                <span>
                  {movementLabel(m.movement_type)} ·{" "}
                  {new Date(m.occurred_at).toLocaleString()}
                </span>
                <strong>
                  {m.quantity_delta > 0 ? "+" : ""}
                  {formatQuantity(m.quantity_delta, u?.symbol)} ·{" "}
                  {formatQuantity(m.balance_before)} →{" "}
                  {formatQuantity(m.balance_after)}
                </strong>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
