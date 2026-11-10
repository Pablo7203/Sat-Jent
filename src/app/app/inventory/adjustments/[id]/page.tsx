import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  cancelAdjustment,
  completeAdjustment,
} from "@/features/inventory/actions";
import { formatQuantity, related } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("inventory.adjust");
  const { id } = await params,
    s = await createClient();
  const { data: a } = await s
    .from("stock_adjustments")
    .select(
      "id,adjustment_number,status,notes,branch:branches(name),reason:stock_adjustment_reasons(name,direction),stock_adjustment_items(id,quantity,direction,notes,stock_movement_id,variant:product_variants(sku,name,product:products(name,unit:units_of_measure(symbol))))",
    )
    .eq("id", id)
    .single();
  if (!a) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={a.adjustment_number}
        description={`${related(a.branch)?.name} · ${related(a.reason)?.name}`}
      />
      <Card>
        <p>
          Status: <strong>{a.status}</strong>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {a.notes || "No notes."}
        </p>
      </Card>
      <div className="space-y-2">
        {a.stock_adjustment_items.map((i) => {
          const v = related(i.variant),
            p = v ? related(v.product) : null,
            u = p ? related(p.unit) : null;
          return (
            <Card key={i.id}>
              <strong>
                Item Code {v?.sku} · {p?.name} / {v?.name}
              </strong>
              <p>
                {i.direction} {formatQuantity(i.quantity, u?.symbol)}
              </p>
            </Card>
          );
        })}
      </div>
      {a.status === "DRAFT" ? (
        <Card>
          <p className="mb-3 text-sm">
            Completing posts every item atomically. A failure leaves the entire
            adjustment as draft.
          </p>
          <div className="flex gap-2">
            <form action={completeAdjustment}>
              <input type="hidden" name="id" value={id} />
              <Button>Complete adjustment</Button>
            </form>
            <form action={cancelAdjustment}>
              <input type="hidden" name="id" value={id} />
              <Button variant="danger">Cancel draft</Button>
            </form>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
