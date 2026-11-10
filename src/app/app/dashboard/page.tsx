import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  ArrowRightLeft,
  PackageSearch,
  ReceiptText,
  Truck,
} from "lucide-react";
import {
  DashboardTicker,
  DashboardSection,
  MetricCard,
  RankedBars,
  StatusGrid,
  TrendChart,
} from "@/components/dashboard/dashboard-components";
import { ButtonLink } from "@/components/ui/button";
import { requireActiveProfile } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import {
  defaultReportingRange,
  reportingRangeForPreset,
  type ReportingPreset,
  validDateRange,
} from "@/lib/reporting";
import { createClient } from "@/lib/supabase/server";

type Summary = {
  timezone: string;
  comparison_window?: { from: string; to: string; policy: string };
  kpis: Record<string, number | null>;
  prior: Record<string, number | null>;
  trend: { date: string; sales: number; collections: number | null }[];
  branches: {
    id: string;
    name: string;
    sales_revenue: number;
    sales_count: number;
  }[];
  top_products: {
    variant_id: string;
    product: string;
    variant: string;
    sku: string;
    revenue: number;
    quantity: number;
    unit: string;
  }[];
  activity?: {
    action: string;
    entity_type: string;
    entity_id: string;
    branch_id: string;
    created_at: string;
    metadata?: Record<string, unknown>;
  }[];
  inventory: null | {
    health: Record<string, number>;
    urgent: {
      id: string;
      product: string;
      variant: string;
      branch: string;
      quantity_on_hand: number;
      minimum_stock_level: number;
      unit: string;
    }[];
  };
  aging: null | Record<string, number>;
  payment_methods: null | { method: string; amount: number }[];
  transfers: null | Record<string, number>;
};
const n = (v: number | null | undefined) => Number(v ?? 0);
const queryString = (from: string, to: string, branch: string | null) =>
  new URLSearchParams({ from, to, ...(branch ? { branch } : {}) }).toString();
const reportGranularities = ["day", "week", "month", "year"] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    branch?: string;
    granularity?: string;
  }>;
}) {
  const context = await requireActiveProfile();
  if (
    !context.permissions.some(
      (p) => p === "dashboard.company.read" || p === "dashboard.branch.read",
    )
  )
    redirect("/access-denied?reason=permission");
  const query = await searchParams,
    defaults = defaultReportingRange(),
    from = query.from ?? defaults.from,
    to = query.to ?? defaults.to,
    requestedGranularity = query.granularity,
    granularity = reportGranularities.includes(
      requestedGranularity as (typeof reportGranularities)[number],
    )
      ? (requestedGranularity as (typeof reportGranularities)[number])
      : to.slice(0, 4) !== from.slice(0, 4)
        ? "month"
        : to.slice(5, 7) !== from.slice(5, 7)
          ? "week"
          : "day";
  if (!validDateRange(from, to))
    redirect(`/app/dashboard?from=${defaults.from}&to=${defaults.to}`);
  const company = context.permissions.includes("dashboard.company.read");
  const branch = company
    ? query.branch || null
    : query.branch || context.accessibleBranches[0]?.id || null;
  if (branch && !context.accessibleBranches.some((item) => item.id === branch))
    redirect("/access-denied?reason=branch");
  if (!company && !branch) redirect("/access-denied?reason=unassigned");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_summary", {
    from_date: from,
    to_date: to,
    target_branch: branch,
  });
  if (error) throw new Error(`Unable to load dashboard: ${error.message}`);
  const canReadProfitability = context.permissions.includes(
    "reports.profitability.read",
  );
  const profitabilityResult = canReadProfitability
    ? await supabase.rpc("reporting_profit_and_loss", {
        date_from: from,
        date_to: to,
        target_branch: branch,
      })
    : null;
  if (profitabilityResult?.error)
    throw new Error(
      `Unable to load dashboard profitability: ${profitabilityResult.error.message}`,
    );
  const pendingReceipts = context.permissions.includes("purchases.read")
    ? await (async () => {
        let query = supabase
          .from("purchase_statement")
          .select(
            "id,purchase_number,supplier_name,branch_name,purchase_date,expected_delivery_date,balance_due,status",
            { count: "exact" },
          )
          .in("status", ["ORDERED", "PARTIALLY_RECEIVED"]);
        if (branch) query = query.eq("branch_id", branch);
        return query
          .order("expected_delivery_date", {
            ascending: true,
            nullsFirst: false,
          })
          .limit(6);
      })()
    : null;
  const recentReceipts = context.permissions.includes("purchases.read")
    ? await (async () => {
        let query = supabase
          .from("goods_receipts")
          .select(
            "id,receipt_number,purchase_id,received_at,branch_id,purchase:purchases!inner(purchase_number,supplier:suppliers!inner(name)),items:goods_receipt_items(quantity_received,receipt_value,variant:product_variants!inner(name,product:products!inner(name,unit:units_of_measure!inner(symbol))))",
          )
          .order("received_at", { ascending: false })
          .limit(5);
        if (branch) query = query.eq("branch_id", branch);
        return query;
      })()
    : null;
  const recentTransfers = context.permissions.includes("transfers.read")
    ? await (async () => {
        let query = supabase
          .from("transfer_summary")
          .select(
            "id,transfer_number,status,source_branch_name,destination_branch_name,created_at,dispatched_at,received_at,source_branch_id,destination_branch_id",
          )
          .order("updated_at", { ascending: false })
          .limit(5);
        if (branch)
          query = query.or(
            `source_branch_id.eq.${branch},destination_branch_id.eq.${branch}`,
          );
        return query;
      })()
    : null;
  const unpostedBatches = context.permissions.includes("daily_sales.read")
    ? await (async () => {
        let query = supabase
          .from("daily_sales_statement")
          .select(
            "id,batch_number,sales_date,branch_id,branch_name,line_count,total_revenue,updated_at",
          )
          .eq("status", "DRAFT")
          .gte("sales_date", from)
          .lte("sales_date", to)
          .order("sales_date", { ascending: true })
          .order("updated_at", { ascending: true })
          .limit(6);
        if (branch) query = query.eq("branch_id", branch);
        return query;
      })()
    : null;
  if (pendingReceipts?.error)
    throw new Error(
      `Unable to load pending receipts: ${pendingReceipts.error.message}`,
    );
  if (recentReceipts?.error)
    throw new Error(
      `Unable to load recent receipts: ${recentReceipts.error.message}`,
    );
  if (recentTransfers?.error)
    throw new Error(
      `Unable to load recent transfers: ${recentTransfers.error.message}`,
    );
  if (unpostedBatches?.error)
    throw new Error(
      `Unable to load unposted sales batches: ${unpostedBatches.error.message}`,
    );
  const pendingPurchaseIds = (pendingReceipts?.data ?? []).map(
    (purchase) => purchase.id,
  );
  const pendingPurchaseLines = pendingPurchaseIds.length
    ? await supabase
        .from("purchase_items")
        .select(
          "purchase_id,ordered_quantity,received_quantity,variant:product_variants!inner(product:products!inner(unit:units_of_measure!inner(symbol)))",
        )
        .in("purchase_id", pendingPurchaseIds)
    : null;
  if (pendingPurchaseLines?.error)
    throw new Error(
      `Unable to load outstanding purchase quantities: ${pendingPurchaseLines.error.message}`,
    );
  const quantitiesByPurchase = new Map<
    string,
    Map<string, { ordered: number; received: number }>
  >();
  for (const line of (pendingPurchaseLines?.data ?? []) as unknown as {
    purchase_id: string;
    ordered_quantity: number;
    received_quantity: number;
    variant: { product: { unit: { symbol: string } } };
  }[]) {
    const unit = line.variant.product.unit.symbol;
    const units =
      quantitiesByPurchase.get(line.purchase_id) ??
      new Map<string, { ordered: number; received: number }>();
    const totals = units.get(unit) ?? { ordered: 0, received: 0 };
    totals.ordered += Number(line.ordered_quantity);
    totals.received += Number(line.received_quantity);
    units.set(unit, totals);
    quantitiesByPurchase.set(line.purchase_id, units);
  }
  const summary = data as unknown as Summary,
    executive = ["SUPER_ADMIN", "OWNER"].includes(context.role.code),
    inventoryRole = context.role.code === "INVENTORY",
    salesRole = context.role.code === "SALES",
    reportAccess =
      context.permissions.includes("reports.branch.read") ||
      context.permissions.includes("reports.company.read"),
    profitAndLoss = profitabilityResult?.data as {
      revenue: number;
      known_cogs: number;
      gross_profit: number | null;
      approved_expenses: number;
      operating_profit: number | null;
      unvalued_sale_lines: number;
    } | null,
    suffix = queryString(from, to, branch),
    rangePresets: { key: ReportingPreset; label: string }[] = [
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
  const { data: periodData, error: periodError } = await supabase.rpc(
    "reporting_sales_periods",
    { from_date: from, to_date: to, target_branch: branch, granularity },
  );
  if (periodError)
    throw new Error(`Unable to load dashboard trend: ${periodError.message}`);
  const branchPerformance = company
    ? await supabase.rpc("reporting_branch_performance", {
        from_date: from,
        to_date: to,
        target_branch: branch,
      })
    : null;
  if (branchPerformance?.error)
    throw new Error(
      `Unable to load branch performance: ${branchPerformance.error.message}`,
    );
  const quantityByUnit =
    context.role.code === "INVENTORY"
      ? null
      : await supabase.rpc("reporting_sales_quantity_by_unit", {
          from_date: from,
          to_date: to,
          target_branch: branch,
          source_filter: "ALL",
        });
  if (quantityByUnit?.error)
    throw new Error(
      `Unable to load sales quantities: ${quantityByUnit.error.message}`,
    );
  const quantityRankedProducts = !inventoryRole
    ? await supabase.rpc("reporting_product_performance", {
        from_date: from,
        to_date: to,
        target_branch: branch,
        ranking: "BEST_QUANTITY",
        category_filter: null,
        brand_filter: null,
        search_text: null,
        row_limit: 5,
        row_offset: 0,
      })
    : null;
  if (quantityRankedProducts?.error)
    throw new Error(
      `Unable to load best-selling product lines: ${quantityRankedProducts.error.message}`,
    );
  const quantityRankedRows = (quantityRankedProducts?.data ?? []) as {
    product_id: string;
    product_name: string;
    variant_name: string;
    sku: string;
    unit_name: string;
    quantity_sold: number;
    line_revenue: number;
  }[];
  const productAttention = context.permissions.includes("inventory.read")
    ? await Promise.all(
        (["NO_SALES", "SLOW_MOVING"] as const).map((ranking) =>
          supabase.rpc("reporting_product_performance", {
            from_date: from,
            to_date: to,
            target_branch: branch,
            ranking,
            category_filter: null,
            brand_filter: null,
            search_text: null,
            row_limit: 5,
            row_offset: 0,
          }),
        ),
      )
    : null;
  if (productAttention?.some((result) => result.error))
    throw new Error(
      `Unable to load stock-based product performance: ${productAttention.find((result) => result.error)?.error?.message}`,
    );
  const noSalesProducts = (productAttention?.[0]?.data ?? []) as {
    product_id: string;
    variant_id: string;
    product_name: string;
    variant_name: string;
    sku: string;
    current_quantity: number | null;
    unit_name: string;
    last_sold_date: string | null;
  }[];
  const slowMovingProducts = (productAttention?.[1]?.data ??
    []) as typeof noSalesProducts;
  const trend = (
    (periodData ?? []) as {
      bucket_start: string;
      revenue: number;
      collections: number | null;
    }[]
  ).map((point) => ({
    date: point.bucket_start,
    sales: n(point.revenue),
    collections: point.collections == null ? null : n(point.collections),
  }));
  const todayAccra = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const receiptRows = (recentReceipts?.data ?? []) as unknown as {
    id: string;
    receipt_number: string;
    purchase_id: string;
    received_at: string;
    branch_id: string;
    purchase: { purchase_number: string; supplier: { name: string } };
    items: {
      quantity_received: number;
      receipt_value: number | null;
      variant: {
        name: string;
        product: { name: string; unit: { symbol: string } };
      };
    }[];
  }[];
  const tickerItems = [
    ...(summary.kpis.active_products != null
      ? [
          {
            icon: <PackageSearch aria-hidden="true" className="size-4" />,
            label: "Active products",
            value: n(summary.kpis.active_products).toLocaleString(),
            href: "/app/products",
          },
        ]
      : []),
    ...(!inventoryRole
      ? [
          {
            icon: <CircleDollarSign aria-hidden="true" className="size-4" />,
            label: "Sales revenue",
            value: formatGhs(n(summary.kpis.sales_revenue)),
            href: reportAccess ? `/app/reports/sales?${suffix}` : "/app/sales",
          },
          {
            icon: <BadgeCheck aria-hidden="true" className="size-4" />,
            label: "Revenue entries",
            value: n(summary.kpis.sales_count).toLocaleString(),
            href: "/app/sales",
          },
        ]
      : []),
    ...(!salesRole && summary.inventory
      ? [
          {
            icon: <PackageSearch aria-hidden="true" className="size-4" />,
            label: "Low stock",
            value: n(summary.kpis.low_stock).toLocaleString(),
            href: "/app/inventory?status=LOW_STOCK",
            tone: "warning" as const,
          },
          {
            icon: <Truck aria-hidden="true" className="size-4" />,
            label: "Transfer lines in transit",
            value: n(summary.kpis.in_transit).toLocaleString(),
            href: "/app/transfers?status=DISPATCHED",
          },
        ]
      : []),
  ];
  return (
    <div className="min-w-0 space-y-5 overflow-x-clip">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted-foreground">
            {executive
              ? "Company overview"
              : context.role.code === "BRANCH_MANAGER"
                ? "Branch overview"
                : salesRole
                  ? "Sales overview"
                  : "Inventory overview"}
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.035em] text-foreground sm:text-[30px]">
            Good morning, {context.profile.fullName?.split(" ")[0] || "there"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening{" "}
            {branch ? "at your branch" : "across SAT-J Ent"} today.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {context.permissions.includes("sales.create") ? (
            <ButtonLink href="/app/sales/new" size="compact">
              <ReceiptText aria-hidden="true" className="size-4" />
              Record sale
            </ButtonLink>
          ) : null}
          {context.permissions.includes("inventory.read") ? (
            <ButtonLink
              href="/app/inventory"
              size="compact"
              variant="secondary"
            >
              <PackageSearch aria-hidden="true" className="size-4" />
              Inventory
            </ButtonLink>
          ) : null}
          {context.permissions.includes("purchases.create") ? (
            <ButtonLink
              href="/app/purchases/new"
              size="compact"
              variant="secondary"
            >
              <Truck aria-hidden="true" className="size-4" />
              Create purchase
            </ButtonLink>
          ) : null}
          {context.permissions.includes("purchases.receive") ? (
            <ButtonLink
              href="/app/purchases?status=awaiting"
              size="compact"
              variant="secondary"
            >
              <ClipboardList aria-hidden="true" className="size-4" />
              Receive stock
            </ButtonLink>
          ) : null}
          {context.permissions.includes("transfers.create") ? (
            <ButtonLink
              href="/app/transfers/new"
              size="compact"
              variant="secondary"
            >
              <ArrowRightLeft aria-hidden="true" className="size-4" />
              Transfer stock
            </ButtonLink>
          ) : null}
          {reportAccess ? (
            <ButtonLink href="/app/reports" size="compact" variant="secondary">
              <BarChart3 aria-hidden="true" className="size-4" />
              Reports
            </ButtonLink>
          ) : null}
        </div>
      </div>
      <form className="grid gap-3 rounded-[14px] border border-border bg-card p-4 sm:grid-cols-5">
        <label className="text-sm font-medium text-muted-foreground">
          From
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-input bg-secondary px-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            name="from"
            type="date"
            defaultValue={from}
          />
        </label>
        <label className="text-sm font-medium text-muted-foreground">
          To
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-input bg-secondary px-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            name="to"
            type="date"
            defaultValue={to}
          />
        </label>
        {company ? (
          <label className="text-sm font-medium text-muted-foreground">
            Branch
            <select
              className="mt-2 min-h-11 w-full rounded-lg border border-input bg-secondary px-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              name="branch"
              defaultValue={branch ?? ""}
            >
              <option value="">All branches</option>
              {context.accessibleBranches
                .filter((b) => b.isActive)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
        ) : (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Branch</span>
            <p className="mt-2 flex min-h-11 items-center rounded-lg bg-secondary px-3 text-foreground">
              {context.accessibleBranches.find((b) => b.id === branch)?.name}
            </p>
          </div>
        )}
        <label className="text-sm font-medium text-muted-foreground">
          Trend interval
          <select
            className="mt-2 min-h-11 w-full rounded-lg border border-input bg-secondary px-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            name="granularity"
            defaultValue={granularity}
          >
            <option value="day">Daily</option>
            <option value="week">Weekly (Monday start)</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </label>
        <button className="min-h-11 self-end rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover">
          Apply filters
        </button>
      </form>
      <nav className="flex flex-wrap gap-2" aria-label="Reporting date presets">
        {rangePresets.map(({ key, label }) => {
          const range = reportingRangeForPreset(key);
          const active = range.from === from && range.to === to;
          const params = new URLSearchParams({
            from: range.from,
            to: range.to,
            granularity,
            ...(branch ? { branch } : {}),
          });
          return (
            <Link
              aria-current={active ? "date" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
              href={`/app/dashboard?${params}`}
              key={key}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <DashboardTicker items={tickerItems} />
      {pendingReceipts ? (
        <DashboardSection
          title="Purchasing and receiving"
          description="Orders that still need a full or partial goods receipt."
          action={{
            href: "/app/purchases?status=awaiting",
            label: "Receive stock",
          }}
        >
          <>
            <StatusGrid
              rows={[
                {
                  label: "Awaiting receipt",
                  value: pendingReceipts.count ?? 0,
                  tone:
                    (pendingReceipts.count ?? 0) > 0 ? "warning" : undefined,
                  href: "/app/purchases?status=awaiting",
                },
              ]}
            />
            {(pendingReceipts.data ?? []).length ? (
              <ul className="mt-4 divide-y divide-border">
                {(pendingReceipts.data ?? []).map((purchase) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    key={purchase.id}
                  >
                    <div className="min-w-0">
                      <Link
                        className="font-medium text-foreground hover:text-primary"
                        href={`/app/purchases/${purchase.id}`}
                      >
                        {purchase.purchase_number}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {purchase.supplier_name} · {purchase.branch_name} ·{" "}
                        {String(purchase.status).replaceAll("_", " ")} · Ordered{" "}
                        {purchase.purchase_date}
                        {purchase.expected_delivery_date
                          ? ` · Expected ${purchase.expected_delivery_date}`
                          : ""}
                        {purchase.expected_delivery_date &&
                        purchase.expected_delivery_date < todayAccra
                          ? " · OVERDUE"
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[
                          ...(quantitiesByPurchase.get(purchase.id) ??
                            new Map()),
                        ]
                          .map(
                            ([unit, quantities]) =>
                              `${unit}: ${quantities.received.toLocaleString(undefined, { maximumFractionDigits: 3 })} received / ${quantities.ordered.toLocaleString(undefined, { maximumFractionDigits: 3 })} ordered / ${(quantities.ordered - quantities.received).toLocaleString(undefined, { maximumFractionDigits: 3 })} outstanding`,
                          )
                          .join(" · ") || "No remaining quantities"}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatGhs(n(purchase.balance_due))} due
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No outstanding purchase orders.
              </p>
            )}
          </>
        </DashboardSection>
      ) : null}
      {recentReceipts || recentTransfers ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {recentReceipts ? (
            <DashboardSection
              title="Recent goods receipts"
              action={{ href: "/app/purchases", label: "All purchases" }}
            >
              {receiptRows.length ? (
                <ul className="divide-y divide-border">
                  {receiptRows.map((receipt) => {
                    const receivedByUnit = new Map<string, number>();
                    for (const item of receipt.items ?? []) {
                      const unit = item.variant.product.unit.symbol;
                      receivedByUnit.set(
                        unit,
                        (receivedByUnit.get(unit) ?? 0) +
                          Number(item.quantity_received),
                      );
                    }
                    const quantities = [...receivedByUnit]
                      .map(
                        ([unit, quantity]) =>
                          `${quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit}`,
                      )
                      .join(" · ");
                    const actualValueComplete =
                      receipt.items.length > 0 &&
                      receipt.items.every((item) => item.receipt_value != null);
                    const actualReceivedValue = actualValueComplete
                      ? receipt.items.reduce(
                          (sum, item) => sum + Number(item.receipt_value),
                          0,
                        )
                      : null;
                    return (
                      <li
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        key={receipt.id}
                      >
                        <div className="min-w-0">
                          <Link
                            className="font-medium text-foreground hover:text-primary"
                            href={`/app/purchases/${receipt.purchase_id}`}
                          >
                            {receipt.receipt_number}
                          </Link>
                          <p className="mt-1 text-xs text-muted-foreground">
                            PO {receipt.purchase.purchase_number} ·{" "}
                            {receipt.purchase.supplier.name} ·{" "}
                            {receipt.items.length} product lines ·{" "}
                            {quantities || "No quantity details"}
                          </p>
                          <p
                            className="mt-1 truncate text-xs text-muted-foreground"
                            title={receipt.items
                              .map((item) => item.variant.product.name)
                              .join(", ")}
                          >
                            {receipt.items
                              .map((item) => item.variant.product.name)
                              .join(", ")}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("en-GH", {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: "Africa/Accra",
                            }).format(new Date(receipt.received_at))}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <span>
                            {context.accessibleBranches.find(
                              (item) => item.id === receipt.branch_id,
                            )?.name ?? "Branch"}
                          </span>
                          <p className="mt-1 tabular-nums">
                            {actualReceivedValue == null
                              ? "Actual value incomplete"
                              : formatGhs(actualReceivedValue)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No goods receipts recorded yet.
                </p>
              )}
            </DashboardSection>
          ) : null}
          {recentTransfers ? (
            <DashboardSection
              title="Recent stock transfers"
              action={{ href: "/app/transfers", label: "All transfers" }}
            >
              {(recentTransfers.data ?? []).length ? (
                <ul className="divide-y divide-border">
                  {(recentTransfers.data ?? []).map((transfer) => (
                    <li
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      key={transfer.id}
                    >
                      <div className="min-w-0">
                        <Link
                          className="font-medium text-foreground hover:text-primary"
                          href={`/app/transfers/${transfer.id}`}
                        >
                          {transfer.transfer_number}
                        </Link>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {transfer.source_branch_name} →{" "}
                          {transfer.destination_branch_name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {transfer.received_at
                            ? `Received ${new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" }).format(new Date(transfer.received_at))}`
                            : transfer.dispatched_at
                              ? `Dispatched ${new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" }).format(new Date(transfer.dispatched_at))}`
                              : `Created ${new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "Africa/Accra" }).format(new Date(transfer.created_at))}`}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {String(transfer.status).replaceAll("_", " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transfers recorded yet.
                </p>
              )}
            </DashboardSection>
          ) : null}
        </div>
      ) : null}
      {summary.kpis.daily_sales_drafts != null ? (
        <DashboardSection
          title="Unposted daily sales"
          description="Draft batches are not included in revenue until they are posted."
          action={{ href: "/app/daily-sales", label: "Review daily batches" }}
        >
          <StatusGrid
            rows={[
              {
                label: "Draft batches in this date range",
                value: n(summary.kpis.daily_sales_drafts),
                tone:
                  n(summary.kpis.daily_sales_drafts) > 0
                    ? "warning"
                    : undefined,
                href: "/app/daily-sales?status=DRAFT",
              },
            ]}
          />
          {(unpostedBatches?.data ?? []).length ? (
            <ul className="mt-4 divide-y divide-border">
              {(unpostedBatches?.data ?? []).map((batch) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  key={batch.id}
                >
                  <div className="min-w-0">
                    <Link
                      className="font-medium text-foreground hover:text-primary"
                      href={
                        context.permissions.includes("daily_sales.update_draft")
                          ? `/app/daily-sales/${batch.id}/edit`
                          : `/app/daily-sales/${batch.id}`
                      }
                    >
                      {context.permissions.includes("daily_sales.update_draft")
                        ? "Continue entry · "
                        : "Review · "}
                      {batch.batch_number}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {batch.branch_name} · Sales date {batch.sales_date} ·{" "}
                      {n(batch.line_count).toLocaleString()} lines · Last
                      updated{" "}
                      {new Intl.DateTimeFormat("en-GH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Africa/Accra",
                      }).format(new Date(batch.updated_at))}
                      {batch.sales_date < todayAccra ? (
                        <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 font-medium text-warning-foreground">
                          Late entry
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatGhs(n(batch.total_revenue))} draft
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No draft batches in this date range.
            </p>
          )}
        </DashboardSection>
      ) : null}
      {!inventoryRole ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Sales revenue"
            value={n(summary.kpis.sales_revenue)}
            prior={n(summary.prior.sales_revenue)}
            href={reportAccess ? `/app/reports/sales?${suffix}` : "/app/sales"}
          />
          <MetricCard
            label="Revenue entries"
            value={n(summary.kpis.sales_count)}
            money={false}
            context="Completed individual sales plus posted daily batches"
            href="/app/sales"
          />
          {summary.kpis.collections != null ? (
            <MetricCard
              label="Customer collections"
              value={n(summary.kpis.collections)}
              prior={n(summary.prior.collections)}
              context="Posted payments received; not revenue"
            />
          ) : null}
        </div>
      ) : null}
      {executive && profitAndLoss ? (
        <DashboardSection
          title="Profit & loss snapshot"
          description={`Cost-aware results for ${from} through ${to}${branch ? ` · ${context.accessibleBranches.find((item) => item.id === branch)?.name ?? "selected branch"}` : " · all branches"}.`}
          action={{
            href: `/app/finance?from=${from}&to=${to}${branch ? `&branch=${branch}` : ""}`,
            label: "Open finance",
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(
              [
                ["Revenue", profitAndLoss.revenue],
                ["Known COGS", profitAndLoss.known_cogs],
                ["Gross profit", profitAndLoss.gross_profit],
                ["Approved expenses", profitAndLoss.approved_expenses],
                ["Operating profit", profitAndLoss.operating_profit],
              ] as const
            ).map(([label, value]) => (
              <div
                className="rounded-lg border border-border bg-card p-4"
                key={label}
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {value === null ? "Incomplete" : formatGhs(n(value))}
                </p>
              </div>
            ))}
          </div>
          {profitAndLoss.unvalued_sale_lines > 0 ? (
            <p role="status" className="mt-3 text-sm text-warning-foreground">
              {profitAndLoss.unvalued_sale_lines} sale line(s) have unknown
              cost. Gross and operating profit are withheld, not estimated.
            </p>
          ) : null}
        </DashboardSection>
      ) : null}
      {!inventoryRole ? (
        <DashboardSection
          title="Items sold by unit"
          description="Quantities stay grouped by their configured unit; boxes, pieces and sets are not added together."
        >
          {quantityByUnit?.data?.length ? (
            <div className="flex flex-wrap gap-3">
              {(
                quantityByUnit.data as {
                  unit_name: string;
                  quantity_sold: number;
                  line_count: number;
                }[]
              ).map((item) => (
                <div
                  className="min-w-32 rounded-lg bg-secondary px-4 py-3"
                  key={item.unit_name}
                >
                  <p className="text-xl font-semibold tabular-nums text-foreground">
                    {n(item.quantity_sold).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.unit_name} sold ·{" "}
                    {n(item.line_count).toLocaleString()} sale lines
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No item quantities recorded for this period.
            </p>
          )}
        </DashboardSection>
      ) : null}
      {!inventoryRole && summary.comparison_window ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          Period comparisons use {summary.comparison_window.from} through{" "}
          {summary.comparison_window.to} (
          {summary.comparison_window.policy.toLowerCase()}).
        </p>
      ) : null}
      {!salesRole && summary.inventory ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Low-stock variants"
            value={n(summary.kpis.low_stock)}
            money={false}
            href="/app/inventory?status=LOW_STOCK"
          />
          <MetricCard
            label="Out-of-stock variants"
            value={n(summary.kpis.out_of_stock)}
            money={false}
            href="/app/inventory?status=OUT_OF_STOCK"
          />
          <MetricCard
            label="Transfer lines in transit"
            value={n(summary.kpis.in_transit)}
            money={false}
            href="/app/transfers?status=DISPATCHED"
          />
          {summary.kpis.purchase_value != null ? (
            <MetricCard
              label="Purchase value"
              value={n(summary.kpis.purchase_value)}
              prior={n(summary.prior.purchase_value)}
              context="Non-cancelled purchases; not cash paid"
            />
          ) : null}
        </div>
      ) : null}
      {!inventoryRole ? (
        <DashboardSection
          title="Sales and collections trend"
          description="Revenue and posted customer payments are separate measures."
          action={
            reportAccess
              ? {
                  href: `/app/reports/sales?${suffix}`,
                  label: "View transactions",
                }
              : undefined
          }
        >
          <TrendChart points={trend} />
        </DashboardSection>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {company && summary.branches.length ? (
          <DashboardSection
            title="Branch performance"
            description="Posted revenue is for the selected period. Stock alerts and open purchase orders are current-state measures."
          >
            <div className="space-y-4">
              {(
                (branchPerformance?.data ?? []) as {
                  branch_id: string;
                  branch_name: string;
                  revenue: number;
                  revenue_entries: number;
                  distinct_variants_sold: number;
                  quantity_by_unit: Record<string, number>;
                  low_stock_variants: number | null;
                  out_of_stock_variants: number | null;
                  pending_purchase_orders: number | null;
                }[]
              ).map((row, index) => {
                const revenue = n(row.revenue);
                const allRevenue = summary.branches.reduce(
                  (sum, item) => sum + n(item.sales_revenue),
                  0,
                );
                const share = allRevenue > 0 ? (revenue / allRevenue) * 100 : 0;
                const average =
                  n(row.revenue_entries) > 0
                    ? revenue / n(row.revenue_entries)
                    : 0;
                const quantities = Object.entries(row.quantity_by_unit ?? {})
                  .map(
                    ([unit, quantity]) =>
                      `${n(quantity).toLocaleString()} ${unit}`,
                  )
                  .join(" · ");
                return (
                  <div key={row.branch_id}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                      <Link
                        className="min-w-0 truncate font-medium text-foreground hover:text-primary"
                        href={`/app/dashboard?${queryString(from, to, row.branch_id)}`}
                      >
                        <span className="mr-2 text-muted-foreground">
                          {index + 1}.
                        </span>
                        {row.branch_name}
                      </Link>
                      <span className="text-right tabular-nums text-foreground">
                        {formatGhs(revenue)}{" "}
                        <span className="text-muted-foreground">
                          · {share.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-input">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n(row.revenue_entries).toLocaleString()} revenue entries
                      · {formatGhs(average)} average per revenue entry ·{" "}
                      {n(row.distinct_variants_sold).toLocaleString()} variants
                      sold
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {quantities || "No item quantities"}
                      {row.low_stock_variants != null
                        ? ` · ${n(row.low_stock_variants)} low stock / ${n(row.out_of_stock_variants)} out of stock`
                        : ""}
                      {row.pending_purchase_orders != null
                        ? ` · ${n(row.pending_purchase_orders)} open purchase orders`
                        : ""}
                    </p>
                  </div>
                );
              })}
              {!summary.branches.some((item) => n(item.sales_revenue) > 0) ? (
                <p className="text-sm text-muted-foreground">
                  No posted revenue for the selected period.
                </p>
              ) : null}
            </div>
          </DashboardSection>
        ) : null}
        {!inventoryRole ? (
          <DashboardSection
            title="Best-selling product lines by quantity"
            description="Ranked by posted quantity with the unit shown on each row. Revenue is actual line revenue, not profit; use Product Performance to switch to revenue ranking."
            action={
              reportAccess
                ? {
                    href: `/app/reports/products?${new URLSearchParams({ from, to, ...(branch ? { branch } : {}), ranking: "BEST_QUANTITY" })}`,
                    label: "Product performance",
                  }
                : undefined
            }
          >
            <RankedBars
              money={false}
              rows={quantityRankedRows.map((r) => ({
                label: `${r.product_name} · ${r.variant_name} · ${r.sku} · ${formatGhs(n(r.line_revenue))}`,
                value: n(r.quantity_sold),
                href: context.permissions.includes("products.read")
                  ? `/app/products/${r.product_id}`
                  : undefined,
              }))}
            />
          </DashboardSection>
        ) : null}
        {productAttention ? (
          <DashboardSection
            title="Stocked products needing attention"
            description="Branch and period filters apply. No-sales means zero posted sales in this range; slow-moving means no sale in the 90 days before the period end."
            action={
              reportAccess
                ? {
                    href: `/app/reports/products?${new URLSearchParams({ from, to, ...(branch ? { branch } : {}), ranking: "NO_SALES" })}`,
                    label: "Product performance",
                  }
                : { href: "/app/inventory", label: "Inventory" }
            }
          >
            <div className="grid gap-5 md:grid-cols-2">
              {(
                [
                  ["No sales in selected period", noSalesProducts],
                  ["No sale in 90+ days", slowMovingProducts],
                ] as const
              ).map(([heading, products]) => (
                <section key={heading}>
                  <h3 className="mb-2 text-sm font-medium text-foreground">
                    {heading}
                  </h3>
                  {products.length ? (
                    <ul className="divide-y divide-border">
                      {products.map((product) => (
                        <li
                          className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                          key={product.variant_id}
                        >
                          <div className="min-w-0">
                            {context.permissions.includes("products.read") ? (
                              <Link
                                className="block truncate text-sm font-medium text-foreground hover:text-primary"
                                href={`/app/products/${product.product_id}`}
                              >
                                {product.product_name} · {product.variant_name}
                              </Link>
                            ) : (
                              <p className="truncate text-sm font-medium text-foreground">
                                {product.product_name} · {product.variant_name}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {product.sku} · Last sold{" "}
                              {product.last_sold_date ?? "never"}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                            {n(product.current_quantity)} {product.unit_name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No stocked products match this view.
                    </p>
                  )}
                </section>
              ))}
            </div>
          </DashboardSection>
        ) : null}
        {summary.payment_methods ? (
          <DashboardSection title="Collections by payment method">
            <RankedBars
              rows={summary.payment_methods.map((r) => ({
                label: r.method.replaceAll("_", " "),
                value: n(r.amount),
              }))}
            />
          </DashboardSection>
        ) : null}
        {summary.inventory ? (
          <DashboardSection
            title="Inventory health"
            description="Current stock positions; historical sales filters do not reconstruct stock from a past date."
            action={{ href: "/app/inventory", label: "Open inventory" }}
          >
            <StatusGrid
              rows={[
                {
                  label: "In stock",
                  value: n(summary.inventory.health.IN_STOCK),
                },
                {
                  label: "Low stock",
                  value: n(summary.inventory.health.LOW_STOCK),
                  tone: "warning",
                  href: "/app/inventory?status=LOW_STOCK",
                },
                {
                  label: "Out of stock",
                  value: n(summary.inventory.health.OUT_OF_STOCK),
                  tone: "critical",
                  href: "/app/inventory?status=OUT_OF_STOCK",
                },
              ]}
            />
          </DashboardSection>
        ) : null}
        {summary.transfers ? (
          <DashboardSection
            title="Transfer operations"
            action={{ href: "/app/transfers", label: "Open transfers" }}
          >
            <StatusGrid
              rows={Object.entries(summary.transfers).map(([label, value]) => ({
                label: label.replaceAll("_", " "),
                value: n(value),
                tone: label === "in_transit" ? "warning" : undefined,
              }))}
            />
          </DashboardSection>
        ) : null}
      </div>
      {summary.inventory?.urgent.length ? (
        <DashboardSection
          title="Stock requiring attention"
          description="Current branch inventory positions, not historical balances."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-muted-foreground">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                  <th className="p-3">Product</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3 text-right">On hand</th>
                  <th className="p-3 text-right">Minimum</th>
                </tr>
              </thead>
              <tbody>
                {summary.inventory.urgent.map((r) => (
                  <tr
                    className="border-b border-border transition-colors hover:bg-secondary"
                    key={r.id}
                  >
                    <td className="p-3 font-medium text-foreground">
                      {r.product} · {r.variant}
                    </td>
                    <td className="p-3">{r.branch}</td>
                    <td className="p-3 text-right">
                      {n(r.quantity_on_hand)} {r.unit}
                    </td>
                    <td className="p-3 text-right">
                      {n(r.minimum_stock_level)} {r.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      ) : null}
      {summary.activity != null ? (
        <DashboardSection
          title="Recent activity"
          description="Latest recorded operational events in your permitted branch scope."
        >
          {summary.activity.length ? (
            <ul className="divide-y divide-border">
              {summary.activity.map((event, index) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  key={`${event.entity_type}-${event.entity_id}-${index}`}
                >
                  <div>
                    {(() => {
                      const metadata = event.metadata ?? {};
                      const target =
                        event.entity_type === "sales" &&
                        context.permissions.includes("sales.read")
                          ? `/app/sales/${event.entity_id}`
                          : event.entity_type === "daily_sales_batches" &&
                              context.permissions.includes("daily_sales.read")
                            ? `/app/daily-sales/${event.entity_id}`
                            : event.entity_type === "goods_receipts" &&
                                context.permissions.includes(
                                  "purchases.read",
                                ) &&
                                typeof metadata.purchase_id === "string"
                              ? `/app/purchases/${metadata.purchase_id}`
                              : event.entity_type === "stock_transfers" &&
                                  context.permissions.includes("transfers.read")
                                ? `/app/transfers/${event.entity_id}`
                                : event.entity_type === "stock_adjustments" &&
                                    context.permissions.includes(
                                      "inventory.read",
                                    )
                                  ? `/app/inventory/adjustments/${event.entity_id}`
                                  : event.entity_type === "customer_payments" &&
                                      typeof metadata.sale_id === "string" &&
                                      context.permissions.includes("sales.read")
                                    ? `/app/sales/${metadata.sale_id}`
                                    : event.entity_type === "purchases" &&
                                        context.permissions.includes(
                                          "purchases.read",
                                        )
                                      ? `/app/purchases/${event.entity_id}`
                                      : null;
                      const label = event.action
                        .replaceAll(".", " ")
                        .replaceAll("_", " ");
                      return target ? (
                        <Link
                          className="text-sm font-medium capitalize text-foreground hover:text-primary"
                          href={target}
                        >
                          {label}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium capitalize text-foreground">
                          {label}
                        </p>
                      );
                    })()}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.entity_type.replaceAll("_", " ")} · Reference{" "}
                      {String(
                        [
                          event.metadata?.sale_number,
                          event.metadata?.batch_number,
                          event.metadata?.purchase_number,
                          event.metadata?.transfer_number,
                          event.metadata?.adjustment_number,
                          event.metadata?.payment_number,
                        ].find((value) => typeof value === "string") ??
                          event.entity_id,
                      )}{" "}
                      ·{" "}
                      {context.accessibleBranches.find(
                        (item) => item.id === event.branch_id,
                      )?.name ?? "Branch"}
                    </p>
                  </div>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={event.created_at}
                  >
                    {new Intl.DateTimeFormat("en-GH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Africa/Accra",
                    }).format(new Date(event.created_at))}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No recent business activity.
            </p>
          )}
        </DashboardSection>
      ) : null}
    </div>
  );
}
