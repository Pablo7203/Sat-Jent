import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/ui/button";
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
  const context = await requirePermission("sales.read"),
    q = await searchParams,
    page = Math.max(1, Number(q.page) || 1),
    size = 25,
    s = await createClient();
  let request = s.from("sales_statement").select("*", { count: "exact" });
  if (q.q)
    request = request.or(
      `sale_number.ilike.%${q.q}%,receipt_number.ilike.%${q.q}%,customer_name.ilike.%${q.q}%,customer_phone.ilike.%${q.q}%`,
    );
  if (q.branch) request = request.eq("branch_id", q.branch);
  if (q.customer) request = request.eq("customer_id", q.customer);
  if (q.status) request = request.eq("status", q.status);
  if (q.payment) request = request.eq("payment_status", q.payment);
  if (q.from) request = request.gte("sale_date", q.from);
  if (q.to) request = request.lte("sale_date", `${q.to}T23:59:59Z`);
  const [{ data, count }, { data: customers }] = await Promise.all([
    request
      .order("sale_date", { ascending: false })
      .range((page - 1) * size, page * size - 1),
    s.from("customers").select("id,name").order("name"),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Sales"
          description="Branch sales, payment state, receipts, and inventory traceability."
        />
        {context.permissions.includes("sales.create") ? (
          <ButtonLink
            className="shrink-0 shadow-[0_8px_18px_rgb(0_0_0_/_0.14)] hover:-translate-y-px hover:shadow-[0_12px_24px_rgb(0_0_0_/_0.18)]"
            href="/app/sales/new"
            size="compact"
          >
            <ReceiptText aria-hidden="true" className="size-4" />
            Add sale
          </ButtonLink>
        ) : null}
      </div>
      <Card>
        <form className="grid gap-3 md:grid-cols-4">
          <Input
            name="q"
            defaultValue={q.q}
            placeholder="Sale, receipt, customer or phone"
          />
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
            name="status"
            defaultValue={q.status}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All sale statuses</option>
            {["DRAFT", "COMPLETED", "CANCELLED"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            name="payment"
            defaultValue={q.payment}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All payment statuses</option>
            {["UNPAID", "PARTIALLY_PAID", "PAID"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <Input
            name="from"
            type="date"
            aria-label="From date"
            defaultValue={q.from}
          />
          <Input
            name="to"
            type="date"
            aria-label="To date"
            defaultValue={q.to}
          />
          <button className="rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            Filter
          </button>
        </form>
      </Card>
      <div className="space-y-3">
        {data?.map((x) => (
          <Link href={`/app/sales/${x.id}`} key={x.id}>
            <Card className="grid gap-2 sm:grid-cols-5">
              <strong>
                {x.sale_number}
                {x.receipt_number ? ` · ${x.receipt_number}` : ""}
              </strong>
              <span>
                {x.customer_name} · {x.branch_name}
              </span>
              <span>{new Date(x.sale_date).toLocaleString()}</span>
              <span>
                {formatGhs(x.total_amount)} · Due {formatGhs(x.balance_due)}
              </span>
              <span>
                {x.status} · {x.payment_status}
              </span>
            </Card>
          </Link>
        ))}
        {!data?.length ? <Card>No sales found.</Card> : null}
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
