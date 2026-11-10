/**
 * Server-only report entry point; it checks user access and applies branch and date filters before querying report data.
 */

import "server-only";
import { requireActiveProfile } from "@/lib/auth/authorization";
import { canReadReport, type ReportKind } from "@/lib/report-catalog";
import { createClient } from "@/lib/supabase/server";

export type ReportResult = {
  headers: string[];
  rows: unknown[][];
  scopeName: string;
  rowLinks?: (string | null)[];
  rowLinkColumn?: number;
  totalCount?: number;
};
type DashboardReportPayload = {
  top_products?: Record<string, unknown>[];
  inventory?: { health?: Record<string, unknown> } | null;
  aging?: Record<string, unknown> | null;
  branches?: Record<string, unknown>[];
  transfers?: Record<string, unknown> | null;
  purchasing?: Record<string, unknown> | null;
  kpis?: Record<string, unknown>;
};
const human = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
export async function loadReport(
  kind: ReportKind,
  from: string,
  to: string,
  branch: string | null,
  page = 1,
  limit = 50,
  ranking = "BEST_QUANTITY",
  searchText: string | null = null,
  categoryId: string | null = null,
  brandId: string | null = null,
  sourceFilter = "ALL",
  salesView = "detail",
): Promise<ReportResult> {
  const context = await requireActiveProfile();
  if (!canReadReport(kind, context.permissions))
    throw new Error("REPORT_PERMISSION_DENIED");
  const company = context.permissions.includes("reports.company.read");
  if (!company && !context.permissions.includes("reports.branch.read"))
    throw new Error("REPORT_PERMISSION_DENIED");
  if (branch && !context.accessibleBranches.some((b) => b.id === branch))
    throw new Error("BRANCH_SCOPE_DENIED");
  if (!company) {
    branch = branch || context.accessibleBranches[0]?.id || null;
    if (!branch) throw new Error("BRANCH_SCOPE_DENIED");
  }
  if (kind === "branches" && !company)
    throw new Error("COMPANY_SCOPE_REQUIRED");
  const db = await createClient(),
    scopeName = branch
      ? (context.accessibleBranches.find((b) => b.id === branch)?.name ??
        "Branch")
      : "All branches";
  if (kind === "sales" && salesView !== "detail") {
    const granularityByView: Record<string, string> = {
      daily: "day",
      weekly: "week",
      monthly: "month",
      annual: "month",
    };
    const granularity = granularityByView[salesView];
    if (!granularity) throw new Error("Invalid sales report view");
    const { data, error } = await db.rpc("reporting_sales_periods", {
      from_date: from,
      to_date: to,
      target_branch: branch,
      granularity,
      source_filter: sourceFilter,
    });
    if (error) throw error;
    const periods = (data ?? []) as Record<string, unknown>[];
    const dateMs = (value: string) => new Date(`${value}T00:00:00Z`).valueOf();
    const iso = (value: number) => new Date(value).toISOString().slice(0, 10);
    const periodDays = (start: string) => {
      const d = new Date(`${start}T00:00:00Z`);
      if (granularity === "day") return start;
      if (granularity === "week") {
        d.setUTCDate(d.getUTCDate() + 6);
        return iso(d.valueOf());
      }
      if (granularity === "month")
        return iso(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      return iso(Date.UTC(d.getUTCFullYear(), 11, 31));
    };
    const rows = periods.map((period) => {
      const start = String(period.bucket_start);
      const drillFrom = iso(Math.max(dateMs(start), dateMs(from)));
      const drillTo = iso(Math.min(dateMs(periodDays(start)), dateMs(to)));
      return [
        drillFrom,
        drillTo,
        period.revenue,
        period.transaction_count,
        period.individual_sale_count,
        period.posted_batch_count,
        period.collections,
      ];
    });
    const links = periods.map((period) => {
      const start = String(period.bucket_start);
      const drillFrom = iso(Math.max(dateMs(start), dateMs(from)));
      const drillTo = iso(Math.min(dateMs(periodDays(start)), dateMs(to)));
      const params = new URLSearchParams({
        from: drillFrom,
        to: drillTo,
        ...(branch ? { branch } : {}),
        ...(sourceFilter !== "ALL" ? { source: sourceFilter } : {}),
        view: "detail",
      });
      return `/app/reports/sales?${params}`;
    });
    if (salesView === "annual") {
      const revenueTotal = periods.reduce(
        (sum, period) => sum + Number(period.revenue ?? 0),
        0,
      );
      const countTotal = periods.reduce(
        (sum, period) => sum + Number(period.transaction_count ?? 0),
        0,
      );
      const individualTotal = periods.reduce(
        (sum, period) => sum + Number(period.individual_sale_count ?? 0),
        0,
      );
      const batchTotal = periods.reduce(
        (sum, period) => sum + Number(period.posted_batch_count ?? 0),
        0,
      );
      const collectionTotal = periods.every(
        (period) => period.collections != null,
      )
        ? periods.reduce(
            (sum, period) => sum + Number(period.collections ?? 0),
            0,
          )
        : null;
      rows.push([
        "Selected-range total",
        "",
        revenueTotal,
        countTotal,
        individualTotal,
        batchTotal,
        collectionTotal,
      ]);
      const params = new URLSearchParams({
        from,
        to,
        ...(branch ? { branch } : {}),
        ...(sourceFilter !== "ALL" ? { source: sourceFilter } : {}),
        view: "detail",
      });
      links.push(`/app/reports/sales?${params}`);
    }
    return {
      scopeName,
      headers: [
        salesView === "annual" ? "Month" : "Period start",
        "Period end",
        "Revenue (GHS)",
        "Revenue entries",
        "Individual sales",
        "Posted daily batches",
        "Collections (GHS; separate from revenue)",
      ],
      rows,
      rowLinks: links,
    };
  }
  if (kind === "sales") {
    const { data, error } = await db.rpc("reporting_sales", {
      from_date: from,
      to_date: to,
      target_branch: branch,
      row_limit: limit,
      row_offset: (page - 1) * limit,
      source_filter: sourceFilter,
    });
    if (error) throw error;
    const sales = (data ?? []) as Record<string, unknown>[];
    return {
      scopeName,
      headers: [
        "Business date",
        "Posted at",
        "Reference",
        "Transaction type",
        "Status",
        "Receipt",
        "Branch",
        "Customer",
        "Posted by",
        "Revenue (GHS)",
        "Collected (GHS)",
        "Balance (GHS)",
        "Payment status",
      ],
      rows: sales.map((r) => [
        r.sale_date,
        r.posted_at,
        r.sale_number,
        human(String(r.source_type ?? "")),
        human(String(r.transaction_status ?? "")),
        r.receipt_number,
        r.branch_name,
        r.customer_name,
        r.posted_by,
        r.total_amount,
        r.amount_paid,
        r.balance_due,
        human(String(r.payment_status ?? "")),
      ]),
      rowLinks: sales.map((r) =>
        r.source_type === "DAILY_BATCH"
          ? context.permissions.includes("daily_sales.read")
            ? `/app/daily-sales/${r.sale_id}`
            : null
          : context.permissions.includes("sales.read")
            ? `/app/sales/${r.sale_id}`
            : null,
      ),
      rowLinkColumn: 2,
    };
  }
  if (kind === "products") {
    const { data, error } = await db.rpc("reporting_product_performance", {
      from_date: from,
      to_date: to,
      target_branch: branch,
      ranking,
      category_filter: categoryId,
      brand_filter: brandId,
      search_text: searchText,
      row_limit: limit,
      row_offset: (page - 1) * limit,
    });
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    return {
      scopeName,
      headers: [
        "Product",
        "Category",
        "Brand",
        "Variant",
        "SKU",
        "Quantity sold",
        "Unit",
        "Product line value (GHS)",
        "Current stock",
        "Minimum stock",
        "Last sold (at or before period end)",
      ],
      rows: rows.map((r) => [
        r.product_name,
        r.category_name,
        r.brand_name,
        r.variant_name,
        r.sku,
        r.quantity_sold,
        r.unit_name,
        r.line_revenue,
        r.current_quantity,
        r.minimum_stock_level,
        r.last_sold_date,
      ]),
      rowLinks: rows.map((r) =>
        context.permissions.includes("products.read")
          ? `/app/products/${r.product_id}`
          : null,
      ),
      totalCount: Number(rows[0]?.total_count ?? 0),
    };
  }
  if (kind === "receivables") {
    const { data, error } = await db.rpc("reporting_receivable_aging_current", {
      target_branch: branch,
    });
    if (error) throw error;
    return {
      scopeName,
      headers: [
        "Current aging bucket (as of today)",
        "Outstanding (GHS)",
        "Open sales",
      ],
      rows: ((data ?? []) as Record<string, unknown>[]).map((row) => [
        human(String(row.bucket ?? "")),
        row.amount,
        row.sale_count,
      ]),
    };
  }
  if (kind === "stock-movements") {
    const { data, error } = await db.rpc("reporting_stock_movements", {
      from_date: from,
      to_date: to,
      target_branch: branch,
      row_limit: limit,
      row_offset: (page - 1) * limit,
    });
    if (error) throw error;
    const movements = (data ?? []) as Record<string, unknown>[];
    return {
      scopeName,
      headers: [
        "Date and time",
        "Branch",
        "Product",
        "Variant",
        "SKU",
        "Movement",
        "Quantity change",
        "Unit",
        "Reference type",
        "Reason",
        "Reference ID",
      ],
      rows: movements.map((row) => [
        row.occurred_at,
        row.branch_name,
        row.product_name,
        row.variant_name,
        row.sku,
        human(String(row.movement_type ?? "")),
        row.quantity_delta,
        row.unit_name,
        human(String(row.reference_type ?? "")),
        row.reason_code,
        row.reference_id,
      ]),
      rowLinks: movements.map((row) =>
        context.permissions.includes("products.read")
          ? `/app/products/${row.product_id}`
          : null,
      ),
      rowLinkColumn: 2,
      totalCount: Number(movements[0]?.total_count ?? 0),
    };
  }
  if (kind === "inventory") {
    const { data, error } = await db.rpc("reporting_inventory_current", {
      target_branch: branch,
      row_limit: limit,
      row_offset: (page - 1) * limit,
    });
    if (error) throw error;
    const inventory = (data ?? []) as Record<string, unknown>[];
    return {
      scopeName,
      headers: [
        "Branch",
        "Product",
        "Category",
        "Brand",
        "Variant",
        "SKU",
        "On hand",
        "Minimum stock",
        "Unit",
        "Status",
      ],
      rows: inventory.map((row) => [
        row.branch_name,
        row.product_name,
        row.category_name,
        row.brand_name,
        row.variant_name,
        row.sku,
        row.quantity_on_hand,
        row.minimum_stock_level,
        row.unit_name,
        human(String(row.stock_status ?? "")),
      ]),
      rowLinks: inventory.map((row) =>
        context.permissions.includes("products.read")
          ? `/app/products/${row.product_id}`
          : null,
      ),
      rowLinkColumn: 1,
      totalCount: Number(inventory[0]?.total_count ?? 0),
    };
  }
  if (kind === "branches") {
    const { data, error } = await db.rpc("reporting_branch_performance", {
      from_date: from,
      to_date: to,
      target_branch: branch,
    });
    if (error) throw error;
    const branches = (data ?? []) as Record<string, unknown>[];
    const totalRevenue = branches.reduce(
      (sum, row) => sum + Number(row.revenue ?? 0),
      0,
    );
    return {
      scopeName,
      headers: [
        "Branch",
        "Revenue (GHS)",
        "Revenue share",
        "Revenue entries",
        "Average per entry (GHS)",
        "Distinct variants sold",
        "Quantity by unit",
        "Low-stock variants",
        "Out-of-stock variants",
        "Pending purchase orders",
      ],
      rows: branches.map((row) => {
        const revenue = Number(row.revenue ?? 0);
        const entries = Number(row.revenue_entries ?? 0);
        const byUnit = (row.quantity_by_unit ?? {}) as Record<string, unknown>;
        return [
          row.branch_name,
          revenue,
          totalRevenue > 0
            ? `${((revenue / totalRevenue) * 100).toFixed(1)}%`
            : "0.0%",
          entries,
          entries ? revenue / entries : 0,
          row.distinct_variants_sold,
          Object.entries(byUnit)
            .map(
              ([unit, quantity]) =>
                `${Number(quantity).toLocaleString()} ${unit}`,
            )
            .join(", "),
          row.low_stock_variants,
          row.out_of_stock_variants,
          row.pending_purchase_orders,
        ];
      }),
      rowLinks: branches.map(
        (row) =>
          `/app/dashboard?${new URLSearchParams({ from, to, branch: String(row.branch_id) })}`,
      ),
    };
  }
  const { data, error } = await db.rpc("dashboard_summary", {
    from_date: from,
    to_date: to,
    target_branch: branch,
  });
  if (error) throw error;
  const s = data as unknown as DashboardReportPayload;
  if (kind === "transfers")
    return {
      scopeName,
      headers: ["Transfer status", "Count"],
      rows: Object.entries(s.transfers ?? {}).map(([k, v]) => [human(k), v]),
    };
  if (kind === "purchases")
    return {
      scopeName,
      headers: ["Purchase measure", "Value"],
      rows: [
        ["Purchase value (GHS)", s.kpis?.purchase_value ?? 0],
        ["Supplier payments (GHS)", s.kpis?.supplier_payments ?? 0],
        ["Supplier balance (GHS)", s.kpis?.supplier_balance ?? 0],
        ...Object.entries(s.purchasing ?? {}).map(([k, v]) => [human(k), v]),
      ],
    };
  if (kind === "suppliers")
    return {
      scopeName,
      headers: ["Supplier measure", "Amount (GHS)"],
      rows: [
        ["Payments in period", s.kpis?.supplier_payments ?? 0],
        ["Outstanding supplier balance", s.kpis?.supplier_balance ?? 0],
      ],
    };
  if (kind === "customers")
    return {
      scopeName,
      headers: ["Customer measure", "Amount (GHS)"],
      rows: [
        ["Collections in period", s.kpis?.collections ?? 0],
        ["Outstanding receivables", s.kpis?.receivables ?? 0],
      ],
    };
  return { scopeName, headers: [], rows: [] };
}
