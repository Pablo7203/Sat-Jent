import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireActiveProfile } from "@/lib/auth/authorization";
import {
  canReadReport,
  isReportKind,
  reportCatalog,
} from "@/lib/report-catalog";
import { loadReport } from "@/lib/report-loader";
import {
  defaultReportingRange,
  reportingRangeForPreset,
  type ReportingPreset,
  validDateRange,
} from "@/lib/reporting";
import { createClient } from "@/lib/supabase/server";
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    branch?: string;
    page?: string;
    limit?: string;
    ranking?: string;
    q?: string;
    category?: string;
    brand?: string;
    source?: string;
    view?: string;
  }>;
}) {
  const { kind } = await params;
  if (!isReportKind(kind)) notFound();
  const context = await requireActiveProfile();
  if (
    !context.permissions.some(
      (p) => p === "reports.branch.read" || p === "reports.company.read",
    )
  )
    redirect("/access-denied?reason=permission");
  if (!canReadReport(kind, context.permissions))
    redirect("/access-denied?reason=permission");
  const q = await searchParams,
    d = defaultReportingRange(),
    from = q.from ?? d.from,
    to = q.to ?? d.to,
    page = Math.max(1, Number(q.page) || 1),
    limit = [10, 20, 50].includes(Number(q.limit)) ? Number(q.limit) : 50,
    ranking = [
      "BEST_QUANTITY",
      "BEST_REVENUE",
      "LEAST_QUANTITY",
      "LEAST_REVENUE",
      "NO_SALES",
      "SLOW_MOVING",
    ].includes(q.ranking ?? "")
      ? q.ranking!
      : "BEST_QUANTITY",
    sourceFilter = ["SALE", "DAILY_BATCH"].includes(q.source ?? "")
      ? q.source!
      : "ALL",
    salesView = ["detail", "daily", "weekly", "monthly", "annual"].includes(
      q.view ?? "",
    )
      ? q.view!
      : "detail";
  if (!validDateRange(from, to))
    redirect(`/app/reports/${kind}?from=${d.from}&to=${d.to}`);
  const companyReports = context.permissions.includes("reports.company.read"),
    branch = companyReports
      ? q.branch || null
      : q.branch || context.accessibleBranches[0]?.id || null;
  if (branch && !context.accessibleBranches.some((item) => item.id === branch))
    redirect("/access-denied?reason=branch");
  if (!companyReports && !branch) redirect("/access-denied?reason=unassigned");
  if (
    kind === "products" &&
    ["LEAST_QUANTITY", "LEAST_REVENUE", "NO_SALES", "SLOW_MOVING"].includes(
      q.ranking ?? "",
    ) &&
    !context.permissions.includes("inventory.read")
  )
    redirect("/access-denied?reason=permission");
  const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    category = uuidPattern.test(q.category ?? "") ? q.category! : null,
    brand = uuidPattern.test(q.brand ?? "") ? q.brand! : null;
  let report;
  let productFilters: {
    filter_type: string;
    filter_id: string;
    filter_name: string;
  }[] = [];
  try {
    report = await loadReport(
      kind,
      from,
      to,
      branch,
      page,
      limit,
      ranking,
      q.q?.trim().slice(0, 100) || null,
      category,
      brand,
      sourceFilter,
      salesView,
    );
    if (kind === "products") {
      const db = await createClient();
      const { data, error } = await db.rpc("reporting_product_filter_options", {
        target_branch: branch,
      });
      if (error) throw error;
      productFilters = (data ?? []) as typeof productFilters;
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("SCOPE"))
      redirect("/access-denied?reason=branch");
    throw e;
  }
  const exportQuery = new URLSearchParams({
    from,
    to,
    ...(q.branch ? { branch: q.branch } : {}),
    ...(kind === "products" ? { ranking } : {}),
    ...(kind === "products" ? { limit: String(limit) } : {}),
    ...(q.q ? { q: q.q.slice(0, 100) } : {}),
    ...(category ? { category } : {}),
    ...(brand ? { brand } : {}),
    ...(kind === "sales" && sourceFilter !== "ALL"
      ? { source: sourceFilter }
      : {}),
    ...(kind === "sales" && salesView !== "detail" ? { view: salesView } : {}),
  });
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams(exportQuery);
    params.set("page", String(targetPage));
    return `/app/reports/${kind}?${params}`;
  };
  const rangePresets: { key: ReportingPreset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "this_week", label: "This week" },
    { key: "last_week", label: "Last week" },
    { key: "this_month", label: "This month" },
    { key: "last_month", label: "Last month" },
    { key: "this_year", label: "This year" },
    { key: "last_year", label: "Last year" },
    { key: "last_30_days", label: "Last 30 days" },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={reportCatalog[kind].title}
          description={`${reportCatalog[kind].description} Scope: ${report.scopeName}${kind !== "inventory" && kind !== "receivables" ? ". Sales business dates use Africa/Accra." : "."}`}
        />
        {context.permissions.includes("reports.export") ? (
          <a
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
            href={`/app/reports/${kind}/export?${exportQuery}`}
          >
            Export CSV
          </a>
        ) : null}
      </div>
      <form className="grid gap-3 rounded-2xl border bg-surface p-4 sm:grid-cols-4">
        {kind !== "inventory" && kind !== "receivables" ? (
          <>
            <label className="text-sm font-medium">
              From
              <input
                className="mt-1 min-h-11 w-full rounded-lg border px-3"
                name="from"
                type="date"
                defaultValue={from}
              />
            </label>
            <label className="text-sm font-medium">
              To
              <input
                className="mt-1 min-h-11 w-full rounded-lg border px-3"
                name="to"
                type="date"
                defaultValue={to}
              />
            </label>
          </>
        ) : null}
        {context.permissions.includes("reports.company.read") ? (
          <label className="text-sm font-medium">
            Branch
            <select
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              name="branch"
              defaultValue={q.branch ?? ""}
            >
              <option value="">All branches</option>
              {context.accessibleBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div />
        )}
        {kind === "products" ? (
          <label className="text-sm font-medium">
            Rank products
            <select
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              name="ranking"
              defaultValue={ranking}
            >
              <option value="BEST_QUANTITY">Best by quantity sold</option>
              <option value="BEST_REVENUE">Best by sales revenue</option>
              {context.permissions.includes("inventory.read") ? (
                <>
                  <option value="LEAST_QUANTITY">Least by quantity sold</option>
                  <option value="LEAST_REVENUE">Least by sales revenue</option>
                  <option value="NO_SALES">No sales (in stock)</option>
                  <option value="SLOW_MOVING">
                    No sales in 90 days (in stock)
                  </option>
                </>
              ) : null}
            </select>
          </label>
        ) : null}
        {kind === "products" ? (
          <label className="text-sm font-medium">
            Results per page
            <select
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              name="limit"
              defaultValue={String(limit)}
            >
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
              <option value="50">All results (paged)</option>
            </select>
          </label>
        ) : null}
        {kind === "products" ? (
          <label className="text-sm font-medium">
            Category
            <select
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              name="category"
              defaultValue={category ?? ""}
            >
              <option value="">All categories</option>
              {productFilters
                .filter((item) => item.filter_type === "category")
                .map((item) => (
                  <option key={item.filter_id} value={item.filter_id}>
                    {item.filter_name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        {kind === "sales" ? (
          <label className="text-sm font-medium">
            Sales view
            <select
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              name="view"
              defaultValue={salesView}
            >
              <option value="detail">Transaction details</option>
              <option value="daily">Daily summary</option>
              <option value="weekly">Weekly summary</option>
              <option value="monthly">Monthly summary</option>
              <option value="annual">Annual summary</option>
            </select>
          </label>
        ) : null}
        {kind === "sales" ? (
          <label className="text-sm font-medium">
            Transaction source
            <select
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              name="source"
              defaultValue={sourceFilter}
            >
              <option value="ALL">All revenue records</option>
              <option value="SALE">Individual sales</option>
              <option value="DAILY_BATCH">Posted daily batches</option>
            </select>
          </label>
        ) : null}
        {kind === "products" ? (
          <label className="text-sm font-medium">
            Brand
            <select
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              name="brand"
              defaultValue={brand ?? ""}
            >
              <option value="">All brands</option>
              {productFilters
                .filter((item) => item.filter_type === "brand")
                .map((item) => (
                  <option key={item.filter_id} value={item.filter_id}>
                    {item.filter_name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        {kind === "products" ? (
          <label className="text-sm font-medium">
            Search product, variant or SKU
            <input
              className="mt-1 min-h-11 w-full rounded-lg border px-3"
              name="q"
              type="search"
              maxLength={100}
              defaultValue={q.q}
            />
          </label>
        ) : null}
        <button className="min-h-11 self-end rounded-lg bg-primary px-4 font-semibold text-white">
          Apply
        </button>
      </form>
      {kind !== "inventory" && kind !== "receivables" ? (
        <nav className="flex flex-wrap gap-2" aria-label="Report date presets">
          {rangePresets.map(({ key, label }) => {
            const range = reportingRangeForPreset(key);
            const active = range.from === from && range.to === to;
            const params = new URLSearchParams(exportQuery);
            params.set("from", range.from);
            params.set("to", range.to);
            params.delete("page");
            return (
              <Link
                aria-current={active ? "date" : undefined}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                href={`/app/reports/${kind}?${params}`}
                key={key}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-secondary">
              {report.headers.map((h) => (
                <th className="whitespace-nowrap p-3" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.length ? (
              report.rows.map((row, i) => (
                <tr className="border-b" key={i}>
                  {row.map((cell, j) => (
                    <td className="whitespace-nowrap p-3" key={j}>
                      {j === (report.rowLinkColumn ?? 0) &&
                      report.rowLinks?.[i] ? (
                        <Link
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          href={report.rowLinks[i]!}
                        >
                          {String(cell ?? "—")}
                        </Link>
                      ) : (
                        String(cell ?? "—")
                      )}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="p-8 text-center text-muted-foreground"
                  colSpan={report.headers.length}
                >
                  No report data matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {kind === "sales" ||
      kind === "products" ||
      kind === "stock-movements" ||
      kind === "inventory" ? (
        <nav className="flex justify-end gap-2" aria-label="Report pages">
          {page > 1 ? (
            <Link
              className="rounded-lg border px-4 py-2"
              href={pageHref(page - 1)}
            >
              Previous
            </Link>
          ) : null}
          {(
            kind === "products" ||
            kind === "stock-movements" ||
            kind === "inventory"
              ? page * limit < (report.totalCount ?? 0)
              : report.rows.length === limit
          ) ? (
            <Link
              className="rounded-lg border px-4 py-2"
              href={pageHref(page + 1)}
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
