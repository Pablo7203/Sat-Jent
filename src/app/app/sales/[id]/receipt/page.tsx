import { notFound } from "next/navigation";
import { PrintButton } from "@/components/shared/print-button";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("sales.read");
  const { id } = await params,
    s = await createClient();
  const [{ data: sale }, { data: items }, { data: payments }] =
    await Promise.all([
      s.from("sales_statement").select("*").eq("id", id).maybeSingle(),
      s.from("sale_items").select("*").eq("sale_id", id),
      s
        .from("customer_payments")
        .select("payment_number,amount,payment_method,status")
        .eq("sale_id", id),
    ]);
  if (!sale || !sale.receipt_number) notFound();
  return (
    <main className="mx-auto max-w-3xl space-y-5 print:max-w-none">
      <div className="flex justify-end print:hidden">
        <PrintButton />
      </div>
      <Card className="print:border-0 print:shadow-none">
        <header className="border-b pb-4 text-center">
          <h1 className="text-2xl font-bold">SAT-J Ent</h1>
          <p>{sale.branch_name}</p>
          <p>
            {sale.branch_address} · {sale.branch_phone}
          </p>
          <p className="mt-2 font-semibold">Receipt {sale.receipt_number}</p>
        </header>
        <dl className="my-4 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt>Sale</dt>
            <dd>{sale.sale_number}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{new Date(sale.completed_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Customer</dt>
            <dd>{sale.customer_name}</dd>
          </div>
          <div>
            <dt>Cashier</dt>
            <dd>{sale.completed_by}</dd>
          </div>
        </dl>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((x) => (
              <tr className="border-t" key={x.id}>
                <td className="py-2">
                  {x.product_name_snapshot} / {x.variant_name_snapshot}
                  <br />
                  <small>{x.sku_snapshot}</small>
                </td>
                <td>
                  {x.quantity} {x.unit_snapshot}
                </td>
                <td>{formatGhs(x.unit_price)}</td>
                <td>{formatGhs(x.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 border-t pt-3 text-right">
          <p>Subtotal: {formatGhs(sale.subtotal)}</p>
          <p>
            Discount:{" "}
            {formatGhs(
              Number(sale.discount_amount) +
                Number(
                  items?.reduce((a, x) => a + Number(x.discount_amount), 0) ??
                    0,
                ),
            )}
          </p>
          <p>Tax: {formatGhs(sale.tax_amount)}</p>
          <p className="text-lg font-bold">
            Total: {formatGhs(sale.total_amount)}
          </p>
          <p>Paid: {formatGhs(sale.amount_paid)}</p>
          <p>Outstanding: {formatGhs(sale.balance_due)}</p>
          {sale.payment_due_date ? <p>Due: {sale.payment_due_date}</p> : null}
        </div>
        <section className="mt-5 border-t pt-3">
          <h2 className="font-semibold">Payments</h2>
          {payments?.map((x) => (
            <p key={x.payment_number}>
              {x.payment_number} · {x.payment_method} · {formatGhs(x.amount)} ·{" "}
              {x.status}
            </p>
          ))}
        </section>
        <footer className="mt-8 text-center text-sm">
          Thank you for choosing SAT-J Ent.
        </footer>
      </Card>
    </main>
  );
}
