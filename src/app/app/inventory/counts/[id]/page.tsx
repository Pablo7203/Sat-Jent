import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelCount,
  completeCount,
  saveCountQuantity,
  startCount,
} from "@/features/inventory/actions";
import { formatQuantity, related } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("inventory.count");
  const { id } = await params,
    s = await createClient();
  const { data: c } = await s
    .from("stock_counts")
    .select(
      "id,count_number,status,notes,branch:branches(name),stock_count_items(id,system_quantity,counted_quantity,variance,notes,variant:product_variants(sku,name,product:products(name,unit:units_of_measure(symbol))))",
    )
    .eq("id", id)
    .single();
  if (!c) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={c.count_number}
        description={`${related(c.branch)?.name} · ${c.status}`}
      />
      {c.status === "DRAFT" ? (
        <Card>
          <p className="mb-3 text-sm">
            Starting captures all system quantities and locks included variants
            against opening stock or adjustments until completion.
          </p>
          <form action={startCount}>
            <input type="hidden" name="id" value={id} />
            <Button>Start count</Button>
          </form>
        </Card>
      ) : null}
      <div className="space-y-3">
        {c.stock_count_items.map((item) => {
          const v = related(item.variant),
            p = v ? related(v.product) : null,
            u = p ? related(p.unit) : null;
          const variance =
            item.counted_quantity == null
              ? null
              : Number(item.counted_quantity) - Number(item.system_quantity);
          return (
            <Card key={item.id}>
              <strong>
                Item Code {v?.sku} · {p?.name} / {v?.name}
              </strong>
              <p className="mt-1 text-sm">
                System:{" "}
                {item.system_quantity == null
                  ? "Captured when started"
                  : formatQuantity(item.system_quantity, u?.symbol)}{" "}
                · Counted: {item.counted_quantity ?? "Not entered"} · Variance:{" "}
                {variance == null
                  ? "—"
                  : variance > 0
                    ? `+${variance}`
                    : variance}
              </p>
              {c.status === "IN_PROGRESS" ? (
                <form
                  action={saveCountQuantity}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="itemId" value={item.id} />
                  <Label>
                    Physical quantity
                    <Input
                      name="quantity"
                      type="number"
                      min="0"
                      step="0.001"
                      required
                      defaultValue={item.counted_quantity ?? ""}
                    />
                  </Label>
                  <Label>
                    Item note
                    <Input name="notes" defaultValue={item.notes ?? ""} />
                  </Label>
                  <Button variant="secondary">Save count</Button>
                </form>
              ) : null}
            </Card>
          );
        })}
      </div>
      {c.status === "IN_PROGRESS" ? (
        <Card>
          <p className="mb-3 text-sm">
            Review every variance before posting. Completion creates movements
            only for non-zero differences and cannot be submitted twice.
          </p>
          <form action={completeCount}>
            <input type="hidden" name="id" value={id} />
            <Button>Complete and reconcile count</Button>
          </form>
        </Card>
      ) : null}
      {c.status === "DRAFT" || c.status === "IN_PROGRESS" ? (
        <form action={cancelCount}>
          <input type="hidden" name="id" value={id} />
          <Button variant="danger">Cancel count</Button>
        </form>
      ) : null}
    </div>
  );
}
