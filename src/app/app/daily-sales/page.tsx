import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const pageSize = 25;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await requirePermission("daily_sales.read");
  const q = await searchParams;
  const page = Math.max(1, Number(q.page) || 1);
  const client = await createClient();
  let query = client
    .from("daily_sales_statement")
    .select("*", { count: "exact" });
  if (q.q?.trim()) query = query.ilike("batch_number", `%${q.q.trim()}%`);
  if (q.branch) query = query.eq("branch_id", q.branch);
  if (q.status) query = query.eq("status", q.status);
  if (q.from) query = query.gte("sales_date", q.from);
  if (q.to) query = query.lte("sales_date", q.to);
  const { data, count, error } = await query
    .order("sales_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error("Daily sales could not be loaded.");
  const filters = new URLSearchParams();
  if (q.q) filters.set("q", q.q);
  if (q.branch) filters.set("branch", q.branch);
  if (q.status) filters.set("status", q.status);
  if (q.from) filters.set("from", q.from);
  if (q.to) filters.set("to", q.to);
  const formatDate = (value: string) =>
    new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GH", {
      dateStyle: "medium",
      timeZone: "Africa/Accra",
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Daily sales"
          description="Review end-of-day sales batches. Drafts do not change stock; posted revenue is separate from collections and customer payments."
        />
        {context.permissions.includes("daily_sales.create") ? (
          <ButtonLink href="/app/daily-sales/new" size="compact">
            <CalendarPlus aria-hidden="true" className="size-4" />
            Record daily sales
          </ButtonLink>
        ) : null}
      </div>

      <Card>
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Input
            name="q"
            defaultValue={q.q}
            placeholder="Batch number"
            aria-label="Search batch number"
          />
          <select
            className="min-h-11 rounded-lg border bg-surface px-3"
            name="branch"
            defaultValue={q.branch ?? ""}
            aria-label="Branch"
          >
            <option value="">All accessible branches</option>
            {context.accessibleBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <select
            className="min-h-11 rounded-lg border bg-surface px-3"
            name="status"
            defaultValue={q.status ?? ""}
            aria-label="Batch status"
          >
            <option value="">All statuses</option>
            {[
              ["DRAFT", "Draft"],
              ["POSTED", "Posted"],
              ["REVERSED", "Reversed"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Input
            name="from"
            type="date"
            defaultValue={q.from}
            aria-label="Sales date from"
          />
          <Input
            name="to"
            type="date"
            defaultValue={q.to}
            aria-label="Sales date to"
          />
          <button className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            Apply filters
          </button>
        </form>
      </Card>

      <div className="space-y-3">
        {data?.map((batch) => (
          <Link
            key={batch.id}
            href={`/app/daily-sales/${batch.id}`}
            className="block rounded-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Card className="grid gap-3 transition-colors hover:bg-secondary/30 sm:grid-cols-2 xl:grid-cols-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Batch number
                </p>
                <strong>{batch.batch_number}</strong>
                {batch.entry_kind !== "STANDARD" ? (
                  <p className="text-xs text-muted-foreground">
                    {batch.entry_kind === "ADDITIONAL"
                      ? "Additional batch"
                      : "Correction batch"}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Branch · Sales date
                </p>
                <span>
                  {batch.branch_name} · {formatDate(batch.sales_date)}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Product lines · Revenue
                </p>
                <span>
                  {batch.line_count} · {formatGhs(batch.total_revenue)}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <span className="font-medium">{batch.status}</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Created · Posted
                </p>
                <span className="text-sm">
                  {String(batch.created_by).slice(0, 8)} ·{" "}
                  {batch.posted_at
                    ? new Date(batch.posted_at).toLocaleString("en-GH", {
                        timeZone: "Africa/Accra",
                      })
                    : "—"}
                </span>
              </div>
            </Card>
          </Link>
        ))}
        {!data?.length ? (
          <Card className="py-10 text-center">
            <p className="font-semibold">No daily sales batches found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try changing the filters or record the day&apos;s first batch.
            </p>
          </Card>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {data?.length ?? 0} of {count ?? 0}.{" "}
        {page > 1 ? (
          <Link
            className="font-medium text-foreground underline"
            href={`?${new URLSearchParams({ ...Object.fromEntries(filters), page: String(page - 1) })}`}
          >
            Previous
          </Link>
        ) : null}{" "}
        {(count ?? 0) > page * pageSize ? (
          <Link
            className="font-medium text-foreground underline"
            href={`?${new URLSearchParams({ ...Object.fromEntries(filters), page: String(page + 1) })}`}
          >
            Next
          </Link>
        ) : null}
      </p>
    </div>
  );
}
