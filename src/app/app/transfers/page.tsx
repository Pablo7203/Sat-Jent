import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await requirePermission("transfers.read");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const size = 25;
  const client = await createClient();
  let request = client
    .from("stock_transfers")
    .select("*,stock_transfer_items(count)", { count: "exact" });
  if (query.q) request = request.ilike("transfer_number", `%${query.q}%`);
  if (query.status) request = request.eq("status", query.status);
  if (query.source) request = request.eq("source_branch_id", query.source);
  if (query.destination)
    request = request.eq("destination_branch_id", query.destination);
  if (query.from) request = request.gte("created_at", `${query.from}T00:00:00`);
  if (query.to) request = request.lte("created_at", `${query.to}T23:59:59`);
  const [{ data: rows, count }, { data: branches }] = await Promise.all([
    request
      .order("created_at", { ascending: false })
      .range((page - 1) * size, page * size - 1),
    client.rpc("active_transfer_branches"),
  ]);
  const branchRows = (branches ?? []) as { id: string; name: string }[];
  const transfers = (rows ?? []) as unknown as {
    id: string;
    transfer_number: string;
    source_branch_id: string;
    destination_branch_id: string;
    status: string;
    requested_at: string | null;
    created_at: string;
    stock_transfer_items: { count: number }[];
  }[];
  const names = new Map(branchRows.map((branch) => [branch.id, branch.name]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Stock transfers"
          description="Controlled stock movement between branches, including goods currently in transit."
        />
        {context.permissions.includes("transfers.create") ? (
          <ButtonLink href="/app/transfers/new">New transfer</ButtonLink>
        ) : null}
      </div>
      <Card>
        <form className="grid gap-3 md:grid-cols-6">
          <Input
            name="q"
            defaultValue={query.q}
            placeholder="Transfer number"
          />
          <select
            name="status"
            defaultValue={query.status}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All statuses</option>
            {[
              "DRAFT",
              "REQUESTED",
              "APPROVED",
              "DISPATCHED",
              "RECEIVED",
              "CANCELLED",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select
            name="source"
            defaultValue={query.source}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All sources</option>
            {branchRows.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <select
            name="destination"
            defaultValue={query.destination}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All destinations</option>
            {branchRows.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <Input
            aria-label="From date"
            name="from"
            type="date"
            defaultValue={query.from}
          />
          <Input
            aria-label="To date"
            name="to"
            type="date"
            defaultValue={query.to}
          />
          <button className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground md:col-start-6">
            Filter
          </button>
        </form>
      </Card>
      <div className="space-y-3">
        {transfers.map((transfer) => {
          const countRow = transfer.stock_transfer_items;
          return (
            <Link key={transfer.id} href={`/app/transfers/${transfer.id}`}>
              <Card className="grid gap-2 sm:grid-cols-5">
                <strong>{transfer.transfer_number}</strong>
                <span>
                  {names.get(transfer.source_branch_id) ?? "Source"} →{" "}
                  {names.get(transfer.destination_branch_id) ?? "Destination"}
                </span>
                <span>{transfer.status}</span>
                <span>{countRow?.[0]?.count ?? 0} item(s)</span>
                <span>
                  {new Date(
                    transfer.requested_at ?? transfer.created_at,
                  ).toLocaleDateString()}
                </span>
              </Card>
            </Link>
          );
        })}
        {!transfers.length ? <Card>No transfers found.</Card> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {transfers.length} of {count ?? 0}.{" "}
        {page > 1 ? (
          <Link className="text-primary" href={`?page=${page - 1}`}>
            Previous
          </Link>
        ) : null}{" "}
        {(count ?? 0) > page * size ? (
          <Link className="text-primary" href={`?page=${page + 1}`}>
            Next
          </Link>
        ) : null}
      </p>
    </div>
  );
}
