import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CancelSaleForm, CompleteSaleForm } from "@/features/sales/forms";
import { reversePayment } from "@/features/sales/actions";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("sales.read"),
    { id } = await params,
    s = await createClient();
  const [{ data: sale }, { data: items }, { data: payments }] =
    await Promise.all([
      s.from("sales_statement").select("*").eq("id", id).maybeSingle(),
      s.from("sale_items").select("*").eq("sale_id", id).order("created_at"),
      context.permissions.includes("customer_payments.read")
        ? s
            .from("customer_payments")
            .select("*")
            .eq("sale_id", id)
            .order("payment_date", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
  if (!sale) notFound();
  const { data: accountRows } = await s
    .from("financial_accounts")
    .select(
      "id,code,name,account_type,financial_account_branches!inner(branch_id)",
    )
    .eq("financial_account_branches.branch_id", sale.branch_id)
    .eq("is_active", true)
    .order("name");
  const accounts = (accountRows ?? []).map((account) => ({
    id: account.id,
    label: `${account.name} · ${account.account_type}`,
  }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <PageHeader
          title={sale.sale_number}
          description={`${sale.customer_name} · ${sale.branch_name} · ${sale.status} · ${sale.payment_status}`}
        />
        <div className="flex gap-2">
          {sale.receipt_number ? (
            <ButtonLink href={`/app/sales/${id}/receipt`}>
              Print receipt
            </ButtonLink>
          ) : null}
          {sale.status === "COMPLETED" &&
          Number(sale.balance_due) > 0 &&
          context.permissions.includes("customer_payments.create") ? (
            <ButtonLink href={`/app/sales/${id}/payment`} variant="secondary">
              Record payment
            </ButtonLink>
          ) : null}
        </div>
      </div>
      <Card>
        <dl className="grid gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-muted-foreground">Receipt</dt>
            <dd>{sale.receipt_number || "Not completed"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Date</dt>
            <dd>{new Date(sale.sale_date).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Total</dt>
            <dd>{formatGhs(sale.total_amount)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Paid / due</dt>
            <dd>
              {formatGhs(sale.amount_paid)} / {formatGhs(sale.balance_due)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Due date</dt>
            <dd>{sale.payment_due_date || "—"}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Discount</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((x) => (
                <tr className="border-t" key={x.id}>
                  <td className="py-3">
                    {x.sku_snapshot} · {x.product_name_snapshot} /{" "}
                    {x.variant_name_snapshot}
                  </td>
                  <td>
                    {x.quantity} {x.unit_snapshot}
                  </td>
                  <td>{formatGhs(x.unit_price)}</td>
                  <td>{formatGhs(x.discount_amount)}</td>
                  <td>{formatGhs(x.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-right">
          Subtotal {formatGhs(sale.subtotal)} · Sale discount{" "}
          {formatGhs(sale.discount_amount)} · Tax {formatGhs(sale.tax_amount)}
        </p>
      </Card>
      {sale.status === "DRAFT" &&
      context.permissions.includes("sales.complete") ? (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Complete sale</h2>
          <CompleteSaleForm
            saleId={id}
            total={String(sale.total_amount)}
            isWalkIn={sale.is_walk_in}
            accounts={accounts}
            canBackdate={["SUPER_ADMIN", "OWNER"].includes(context.role.code)}
          />
        </Card>
      ) : null}
      <Card>
        <h2 className="mb-3 text-lg font-bold">Payment history</h2>
        {payments?.map((p) => (
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-t py-3"
            key={p.id}
          >
            <span>
              {p.payment_number} · {new Date(p.payment_date).toLocaleString()} ·{" "}
              {formatGhs(p.amount)} · {p.payment_method} · {p.status}
            </span>
            {p.status === "POSTED" &&
            context.permissions.includes("customer_payments.reverse") ? (
              <form action={reversePayment} className="flex gap-2">
                <input type="hidden" name="paymentId" value={p.id} />
                <input type="hidden" name="saleId" value={id} />
                <input
                  required
                  name="reason"
                  aria-label={`Reversal reason for ${p.payment_number}`}
                  placeholder="Reversal reason"
                  className="rounded-lg border px-3"
                />
                <Button variant="danger">Reverse</Button>
              </form>
            ) : null}
          </div>
        ))}
        {!payments?.length ? <p>No payments.</p> : null}
      </Card>
      {sale.status !== "CANCELLED" &&
      context.permissions.includes("sales.cancel") ? (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Controlled cancellation</h2>
          <CancelSaleForm saleId={id} />
        </Card>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Created {new Date(sale.created_at).toLocaleString()} ·{" "}
        <Link
          className="text-primary"
          href={`/app/customers/${sale.customer_id}`}
        >
          Customer statement
        </Link>
      </p>
    </div>
  );
}
