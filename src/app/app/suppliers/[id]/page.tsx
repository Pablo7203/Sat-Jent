import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toggleSupplier } from "@/features/purchasing/actions";
import { requirePermission } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("suppliers.read"),
    { id } = await params,
    s = await createClient();
  const [
    { data: supplier },
    { data: purchases },
    { data: payments },
    { data: balance },
  ] = await Promise.all([
    s.from("suppliers").select("*").eq("id", id).maybeSingle(),
    s
      .from("purchase_statement")
      .select(
        "id,purchase_number,purchase_date,total_amount,payable_value,balance_due,status,payment_status",
      )
      .eq("supplier_id", id)
      .order("purchase_date", { ascending: false })
      .limit(20),
    context.permissions.includes("supplier_payments.read")
      ? s
          .from("supplier_payments")
          .select("id,payment_number,payment_date,amount,purchase_id")
          .eq("supplier_id", id)
          .order("payment_date", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    s
      .from("supplier_balances")
      .select("outstanding_balance")
      .eq("supplier_id", id)
      .maybeSingle(),
  ]);
  if (!supplier) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          backHref="/app/suppliers"
          title={`${supplier.supplier_code} · ${supplier.name}`}
          description={`${supplier.is_active ? "Active" : "Archived"} supplier · Outstanding ${formatGhs(balance?.outstanding_balance ?? 0)}`}
        />
        <div className="flex gap-2">
          {context.permissions.includes("suppliers.update") ? (
            <ButtonLink
              href={`/app/suppliers/${id}/edit`}
              size="compact"
              variant="secondary"
            >
              Edit
            </ButtonLink>
          ) : null}
          {context.permissions.includes("suppliers.archive") ? (
            <form action={toggleSupplier}>
              <input type="hidden" name="id" value={id} />
              <input
                type="hidden"
                name="active"
                value={String(!supplier.is_active)}
              />
              <Button variant={supplier.is_active ? "danger" : "secondary"}>
                {supplier.is_active ? "Archive" : "Reactivate"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
      <Card>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Contact</dt>
            <dd>{supplier.contact_person || "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Phone</dt>
            <dd>{supplier.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd>{supplier.email || "—"}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-sm text-muted-foreground">Address / notes</dt>
            <dd>
              {supplier.address || "—"} {supplier.notes}
            </dd>
          </div>
        </dl>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">Purchase history</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Ordered value and supplier balance are separate. New orders accrue
          payable as actual goods are received; legacy balances retain their
          previous purchase-order basis.
        </p>
        {purchases?.map((p) => (
          <Link
            key={p.id}
            href={`/app/purchases/${p.id}`}
            className="grid gap-2 border-t py-3 sm:grid-cols-5"
          >
            <strong>{p.purchase_number}</strong>
            <span>{p.purchase_date}</span>
            <span>Ordered {formatGhs(p.total_amount)}</span>
            <span>Recognized {formatGhs(p.payable_value)}</span>
            <span>
              {p.status} · Outstanding {formatGhs(p.balance_due)}
            </span>
          </Link>
        ))}
        {!purchases?.length ? <p>No purchases.</p> : null}
      </Card>
      {context.permissions.includes("supplier_payments.read") ? (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Recent payments</h2>
          {payments?.map((p) => (
            <p className="border-t py-3" key={p.id}>
              {p.payment_number} · {p.payment_date} · {formatGhs(p.amount)}
            </p>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
