import Link from "next/link";
import { PackagePlus } from "lucide-react";
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
  const context = await requirePermission("purchases.read"),
    q = await searchParams,
    page = Math.max(1, Number(q.page) || 1),
    size = 25,
    s = await createClient();
  let request = s.from("purchase_statement").select("*", { count: "exact" });
  if (q.q)
    request = request.or(
      `purchase_number.ilike.%${q.q}%,supplier_name.ilike.%${q.q}%,supplier_invoice_number.ilike.%${q.q}%`,
    );
  if (q.branch) request = request.eq("branch_id", q.branch);
  if (q.supplier) request = request.eq("supplier_id", q.supplier);
  if (q.status === "awaiting")
    request = request.in("status", ["ORDERED", "PARTIALLY_RECEIVED"]);
  else if (q.status) request = request.eq("status", q.status);
  if (q.payment) request = request.eq("payment_status", q.payment);
  if (q.from) request = request.gte("purchase_date", q.from);
  if (q.to) request = request.lte("purchase_date", q.to);
  const [{ data, count }, { data: suppliers }] = await Promise.all([
    request
      .order("purchase_date", { ascending: false })
      .range((page - 1) * size, page * size - 1),
    s.from("suppliers").select("id,name").order("name"),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Purchases"
          description="Orders, goods receipts, and supplier balances by authorized branch."
        />
        {context.permissions.includes("purchases.create") ? (
          <ButtonLink
            className="shrink-0 shadow-[0_8px_18px_rgb(0_0_0_/_0.14)] hover:-translate-y-px hover:shadow-[0_12px_24px_rgb(0_0_0_/_0.18)]"
            href="/app/purchases/new"
            size="compact"
          >
            <PackagePlus aria-hidden="true" className="size-4" />
            New purchase
          </ButtonLink>
        ) : null}
      </div>
      <Card>
        <form className="grid gap-3 md:grid-cols-4">
          <Input
            name="q"
            defaultValue={q.q}
            placeholder="Purchase, supplier or invoice"
          />
          <select
            name="branch"
            defaultValue={q.branch}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All branches</option>
            {context.accessibleBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            name="supplier"
            defaultValue={q.supplier}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All suppliers</option>
            {suppliers?.map((x) => (
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
            <option value="">All receipt statuses</option>
            <option value="awaiting">Awaiting goods</option>
            {[
              "DRAFT",
              "ORDERED",
              "PARTIALLY_RECEIVED",
              "RECEIVED",
              "CANCELLED",
            ].map((x) => (
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
            aria-label="From date"
            name="from"
            type="date"
            defaultValue={q.from}
          />
          <Input
            aria-label="To date"
            name="to"
            type="date"
            defaultValue={q.to}
          />
          <button className="rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            Filter
          </button>
        </form>
      </Card>
      <div className="space-y-3">
        {data?.map((p) => (
          <Link key={p.id} href={`/app/purchases/${p.id}`}>
            <Card className="grid gap-2 sm:grid-cols-5">
              <strong>{p.purchase_number}</strong>
              <span>
                {p.supplier_name} · {p.branch_name}
              </span>
              <span>{p.purchase_date}</span>
              <span>
                {formatGhs(p.total_amount)} · Due {formatGhs(p.balance_due)}
              </span>
              <span>
                {p.status} · {p.payment_status}
              </span>
            </Card>
          </Link>
        ))}
        {!data?.length ? <Card>No purchases found.</Card> : null}
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
