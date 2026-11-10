import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toggleCustomer } from "@/features/sales/actions";
import { requirePermission } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("customers.read"),
    { id } = await params,
    s = await createClient();
  const [{ data: c }, { data: sales }, { data: payments }, { data: balance }] =
    await Promise.all([
      s.from("customers").select("*").eq("id", id).maybeSingle(),
      s
        .from("sales_statement")
        .select(
          "id,sale_number,receipt_number,sale_date,total_amount,balance_due,status,payment_status,branch_name",
        )
        .eq("customer_id", id)
        .order("sale_date", { ascending: false })
        .limit(25),
      context.permissions.includes("customer_payments.read")
        ? s
            .from("customer_payments")
            .select("id,payment_number,payment_date,amount,status,sale_id")
            .eq("customer_id", id)
            .order("payment_date", { ascending: false })
            .limit(25)
        : Promise.resolve({ data: [] }),
      s
        .from("customer_balances")
        .select("outstanding_balance")
        .eq("customer_id", id)
        .maybeSingle(),
    ]);
  if (!c) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          backHref="/app/customers"
          title={`${c.customer_code} · ${c.name}`}
          description={`${c.is_walk_in ? "Protected system customer" : c.is_active ? "Active customer" : "Archived customer"} · Outstanding ${formatGhs(balance?.outstanding_balance ?? 0)}`}
        />
        {!c.is_walk_in ? (
          <div className="flex gap-2">
            {context.permissions.includes("customers.update") ? (
              <ButtonLink
                href={`/app/customers/${id}/edit`}
                size="compact"
                variant="secondary"
              >
                Edit
              </ButtonLink>
            ) : null}
            {context.permissions.includes("customers.archive") ? (
              <form action={toggleCustomer}>
                <input type="hidden" name="id" value={id} />
                <input
                  type="hidden"
                  name="active"
                  value={String(!c.is_active)}
                />
                <Button variant={c.is_active ? "danger" : "secondary"}>
                  {c.is_active ? "Archive" : "Reactivate"}
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
      <Card>
        <p>
          {String(c.customer_type).replaceAll("_", " ")} ·{" "}
          {c.company_name || "No company"} · {c.phone || "No phone"} ·{" "}
          {c.email || "No email"}
        </p>
        <p className="mt-2 text-muted-foreground">
          {c.address} {c.notes}
        </p>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Sale history</h2>
        {sales?.map((x) => (
          <Link
            href={`/app/sales/${x.id}`}
            key={x.id}
            className="grid gap-2 border-t py-3 sm:grid-cols-4"
          >
            <strong>{x.sale_number}</strong>
            <span>
              {x.branch_name} · {new Date(x.sale_date).toLocaleDateString()}
            </span>
            <span>{formatGhs(x.total_amount)}</span>
            <span>
              {x.status} · Due {formatGhs(x.balance_due)}
            </span>
          </Link>
        ))}
        {!sales?.length ? <p>No sales.</p> : null}
      </Card>
      {context.permissions.includes("customer_payments.read") ? (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Payment history</h2>
          {payments?.map((x) => (
            <p key={x.id} className="border-t py-3">
              {x.payment_number} ·{" "}
              {new Date(x.payment_date).toLocaleDateString()} ·{" "}
              {formatGhs(x.amount)} · {x.status}
            </p>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
