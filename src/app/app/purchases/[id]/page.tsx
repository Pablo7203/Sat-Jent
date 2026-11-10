import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cancelPurchase, orderPurchase } from "@/features/purchasing/actions";
import { requirePermission } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("purchases.read"),
    { id } = await params,
    s = await createClient();
  const [{ data: p }, { data: items }, { data: receipts }, { data: payments }] =
    await Promise.all([
      s.from("purchase_statement").select("*").eq("id", id).maybeSingle(),
      s
        .from("purchase_items")
        .select("*,variant:product_variants(sku,name,product:products(name))")
        .eq("purchase_id", id)
        .order("created_at"),
      s
        .from("goods_receipts")
        .select(
          "id,receipt_number,received_at,supplier_delivery_reference,goods_receipt_items(id,variant_id,quantity_received,agreed_unit_cost_snapshot,actual_unit_cost,receipt_value,zero_cost_reason,standard_selling_price_snapshot,stock_movement_id,variant:product_variants(sku,name,product:products(name,unit:units_of_measure(symbol))))",
        )
        .eq("purchase_id", id)
        .order("received_at", { ascending: false }),
      context.permissions.includes("supplier_payments.read")
        ? s
            .from("supplier_payments")
            .select(
              "id,payment_number,payment_date,amount,payment_method,payment_reference",
            )
            .eq("purchase_id", id)
            .order("payment_date", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
  if (!p) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <PageHeader
          title={p.purchase_number}
          description={`${p.supplier_name} · ${p.branch_name} · ${p.status} · ${p.payment_status}`}
        />
        <div className="flex flex-wrap gap-2">
          {p.status === "DRAFT" &&
          context.permissions.includes("purchases.update") ? (
            <ButtonLink href={`/app/purchases/${id}/edit`} variant="secondary">
              Edit draft
            </ButtonLink>
          ) : null}
          {p.status === "DRAFT" &&
          context.permissions.includes("purchases.update") ? (
            <form action={orderPurchase}>
              <input type="hidden" name="id" value={id} />
              <Button>Mark ordered</Button>
            </form>
          ) : null}
          {["ORDERED", "PARTIALLY_RECEIVED"].includes(p.status) &&
          context.permissions.includes("purchases.receive") ? (
            <ButtonLink href={`/app/purchases/${id}/receive`}>
              Receive goods
            </ButtonLink>
          ) : null}
          {Number(p.balance_due) > 0 &&
          p.status !== "CANCELLED" &&
          context.permissions.includes("supplier_payments.create") ? (
            <ButtonLink
              href={`/app/purchases/${id}/payment`}
              variant="secondary"
            >
              Record payment
            </ButtonLink>
          ) : null}
          {["DRAFT", "ORDERED"].includes(p.status) &&
          context.permissions.includes("purchases.cancel") ? (
            <form action={cancelPurchase}>
              <input type="hidden" name="id" value={id} />
              <Button variant="danger">Cancel</Button>
            </form>
          ) : null}
        </div>
      </div>
      <Card>
        <dl className="grid gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">Purchase date</dt>
            <dd>{p.purchase_date}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Supplier invoice</dt>
            <dd>{p.supplier_invoice_number || "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Ordered value</dt>
            <dd>{formatGhs(p.total_amount)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              {p.payable_basis === "ACTUAL_RECEIPT_COST"
                ? "Supplier payable · actual receipts"
                : "Supplier payable · legacy order value"}
            </dt>
            <dd>{formatGhs(p.payable_value)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">
              Paid / outstanding
            </dt>
            <dd>
              {formatGhs(p.amount_paid)} / {formatGhs(p.balance_due)}
            </dd>
          </div>
        </dl>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Variant</th>
                <th>Ordered</th>
                <th>Received</th>
                <th>Remaining</th>
                <th>Unit cost</th>
                <th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((i) => {
                const v = i.variant as unknown as {
                  sku: string;
                  name: string;
                  product: { name: string };
                };
                return (
                  <tr className="border-t" key={i.id}>
                    <td className="py-3">
                      Item Code {v.sku} · {v.product.name} / {v.name}
                    </td>
                    <td>{i.ordered_quantity}</td>
                    <td>{i.received_quantity}</td>
                    <td>
                      {Number(i.ordered_quantity) - Number(i.received_quantity)}
                    </td>
                    <td>{formatGhs(i.unit_cost)}</td>
                    <td>{formatGhs(i.line_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-right">
          Subtotal {formatGhs(p.subtotal)} · Purchase discount{" "}
          {formatGhs(p.discount_amount)} · Other costs{" "}
          {formatGhs(p.other_costs)}
        </p>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Goods receipts</h2>
        {receipts?.map((r) => (
          <section
            key={r.id}
            id={`receipt-${r.receipt_number}`}
            className="border-t py-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{r.receipt_number}</strong>
              <span>{new Date(r.received_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {r.supplier_delivery_reference || "No delivery reference"}
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Agreed cost</th>
                    <th>Actual cost</th>
                    <th>Receipt value</th>
                    <th>Price at receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {r.goods_receipt_items?.map((rawItem) => {
                    const receiptItem = rawItem as unknown as {
                      id: string;
                      quantity_received: number;
                      agreed_unit_cost_snapshot: number | string;
                      actual_unit_cost: number | string | null;
                      receipt_value: number | string | null;
                      zero_cost_reason: string | null;
                      standard_selling_price_snapshot: number | string | null;
                      stock_movement_id: string;
                      variant: {
                        sku: string;
                        name: string;
                        product: { name: string; unit: { symbol: string } };
                      };
                    };
                    return (
                      <tr className="border-t" key={receiptItem.id}>
                        <td className="py-2">
                          Item Code {receiptItem.variant.sku} ·{" "}
                          {receiptItem.variant.product.name} /{" "}
                          {receiptItem.variant.name}
                        </td>
                        <td>
                          {receiptItem.quantity_received}{" "}
                          {receiptItem.variant.product.unit.symbol}
                        </td>
                        <td>
                          {formatGhs(receiptItem.agreed_unit_cost_snapshot)}
                        </td>
                        <td>
                          {receiptItem.actual_unit_cost === null
                            ? "Not captured on legacy receipt"
                            : `${formatGhs(receiptItem.actual_unit_cost)}${receiptItem.zero_cost_reason ? ` · ${receiptItem.zero_cost_reason}` : ""}`}
                        </td>
                        <td>
                          {receiptItem.receipt_value === null
                            ? "—"
                            : formatGhs(receiptItem.receipt_value)}
                        </td>
                        <td>
                          {receiptItem.standard_selling_price_snapshot === null
                            ? "Not set"
                            : formatGhs(
                                receiptItem.standard_selling_price_snapshot,
                              )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {r.goods_receipt_items?.length ? (
              <Link
                className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
                href={`/app/inventory/movements?reference=${r.id}`}
              >
                View stock movements for this receipt
              </Link>
            ) : null}
          </section>
        ))}
        {!receipts?.length ? <p>No goods received.</p> : null}
      </Card>
      {context.permissions.includes("supplier_payments.read") ? (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Supplier payments</h2>
          {payments?.map((x) => (
            <p key={x.id} className="border-t py-3">
              <strong>{x.payment_number}</strong> · {x.payment_date} ·{" "}
              {formatGhs(x.amount)} · {x.payment_method}
            </p>
          ))}
          {!payments?.length ? <p>No payments recorded.</p> : null}
        </Card>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Created {new Date(p.created_at).toLocaleString()} · Updated{" "}
        {new Date(p.updated_at).toLocaleString()} ·{" "}
        <Link href={`/app/suppliers/${p.supplier_id}`} className="text-primary">
          Supplier statement
        </Link>
      </p>
    </div>
  );
}
