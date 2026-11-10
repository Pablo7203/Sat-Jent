import Link from "next/link";
import { Truck } from "lucide-react";
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
  const context = await requirePermission("suppliers.read"),
    q = await searchParams,
    page = Math.max(1, Number(q.page) || 1),
    size = 25,
    s = await createClient();
  let request = s.from("suppliers").select("*", { count: "exact" });
  if (q.q)
    request = request.or(
      `name.ilike.%${q.q}%,supplier_code.ilike.%${q.q}%,phone.ilike.%${q.q}%,email.ilike.%${q.q}%`,
    );
  if (q.status) request = request.eq("is_active", q.status === "active");
  const [{ data, count, error }, { data: balances, error: balancesError }] =
    await Promise.all([
      request.order("name").range((page - 1) * size, page * size - 1),
      s.from("supplier_balances").select("supplier_id,outstanding_balance"),
    ]);
  if (error) throw new Error(`Unable to load suppliers: ${error.message}`);
  if (balancesError)
    throw new Error(
      `Unable to load supplier balances: ${balancesError.message}`,
    );
  const balanceBySupplier = new Map(
    (balances ?? []).map((balance) => [
      balance.supplier_id,
      Number(balance.outstanding_balance ?? 0),
    ]),
  );
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          backHref="/app/dashboard"
          title="Suppliers"
          description="Supplier master data and outstanding purchasing balances."
        />
        {context.permissions.includes("suppliers.create") ? (
          <ButtonLink
            className="shrink-0 shadow-[0_8px_18px_rgb(0_0_0_/_0.14)] hover:-translate-y-px hover:shadow-[0_12px_24px_rgb(0_0_0_/_0.18)]"
            href="/app/suppliers/new"
            size="compact"
          >
            <Truck aria-hidden="true" className="size-4" />
            Add supplier
          </ButtonLink>
        ) : null}
      </div>
      <Card>
        <form className="grid gap-3 sm:grid-cols-3">
          <Input
            name="q"
            defaultValue={q.q}
            placeholder="Code, name, phone or email"
          />
          <select
            name="status"
            defaultValue={q.status}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <button className="rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            Search
          </button>
        </form>
      </Card>
      <div className="space-y-3">
        {data?.map((x) => (
          <Link key={x.id} href={`/app/suppliers/${x.id}`}>
            <Card className="grid gap-2 sm:grid-cols-4">
              <strong>
                {x.supplier_code} · {x.name}
              </strong>
              <span>{x.contact_person || x.company_name || "—"}</span>
              <span>{x.phone || "—"}</span>
              <span>
                {formatGhs(balanceBySupplier.get(x.id) ?? 0)} ·{" "}
                {x.is_active ? "Active" : "Archived"}
              </span>
            </Card>
          </Link>
        ))}
        {!data?.length ? <Card>No suppliers found.</Card> : null}
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
