import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await requirePermission("receivables.read"),
    q = await searchParams,
    page = Math.max(1, Number(q.page) || 1),
    size = 25,
    s = await createClient();
  let request = s.from("receivables").select("*", { count: "exact" });
  if (q.branch) request = request.eq("branch_id", q.branch);
  if (q.customer) request = request.eq("customer_id", q.customer);
  if (q.payment) request = request.eq("payment_status", q.payment);
  if (q.from) request = request.gte("sale_date", q.from);
  if (q.to) request = request.lte("sale_date", `${q.to}T23:59:59Z`);
  if (q.due === "overdue")
    request = request.lt(
      "payment_due_date",
      new Date().toISOString().slice(0, 10),
    );
  if (q.due === "none") request = request.is("payment_due_date", null);
  const [{ data, count }, { data: customers }] = await Promise.all([
    request
      .order("payment_due_date", { ascending: true, nullsFirst: false })
      .range((page - 1) * size, page * size - 1),
    s.from("customers").select("id,name").order("name"),
  ]);
  const total = (data ?? []).reduce((a, x) => a + Number(x.balance_due), 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Receivables"
        description="Outstanding named-customer sales in your authorized branch scope."
      />
      <Card>
        <form className="grid gap-3 md:grid-cols-4">
          <select
            name="branch"
            defaultValue={q.branch}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All branches</option>
            {context.accessibleBranches.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            name="customer"
            defaultValue={q.customer}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All customers</option>
            {customers?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            name="payment"
            defaultValue={q.payment}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All outstanding</option>
            <option>UNPAID</option>
            <option>PARTIALLY_PAID</option>
          </select>
          <select
            name="due"
            defaultValue={q.due}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">Any due date</option>
            <option value="overdue">Overdue</option>
            <option value="none">No due date</option>
          </select>
          <Input name="from" type="date" aria-label="From sale date" />
          <Input name="to" type="date" aria-label="To sale date" />
          <button className="rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            Filter
          </button>
        </form>
      </Card>
      <Card>
        <strong>{formatGhs(total)}</strong>
        <p className="text-sm text-muted-foreground">
          Outstanding on this page
        </p>
      </Card>
      <div className="space-y-3">
        {data?.map((x) => (
          <Link href={`/app/sales/${x.sale_id}`} key={x.sale_id}>
            <Card className="grid gap-2 sm:grid-cols-5">
              <strong>
                {x.sale_number} · {x.customer_name}
              </strong>
              <span>{x.branch_name}</span>
              <span>
                Total {formatGhs(x.total_amount)} · Paid{" "}
                {formatGhs(x.amount_paid)}
              </span>
              <span>
                Due {formatGhs(x.balance_due)} · {x.payment_status}
              </span>
              <span>
                {x.payment_due_date
                  ? `${x.payment_due_date}${x.days_overdue > 0 ? ` · ${x.days_overdue} days overdue` : ""}`
                  : "No due date"}
              </span>
            </Card>
          </Link>
        ))}
        {!data?.length ? <Card>No outstanding receivables.</Card> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {data?.length ?? 0} of {count ?? 0}.{" "}
        {page > 1 ? <Link href={`?page=${page - 1}`}>Previous</Link> : null}{" "}
        {(count ?? 0) > page * size ? (
          <Link href={`?page=${page + 1}`}>Next</Link>
        ) : null}
      </p>
    </div>
  );
}
