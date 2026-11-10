import { NextResponse } from "next/server";
import { isReportKind } from "@/lib/report-catalog";
import { loadReport } from "@/lib/report-loader";
import { defaultReportingRange, toCsv, validDateRange } from "@/lib/reporting";
import {
  requireActiveProfile,
  requirePermission,
} from "@/lib/auth/authorization";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  await requirePermission("reports.export");
  const { kind } = await params;
  if (!isReportKind(kind))
    return new NextResponse("Unknown report", { status: 404 });
  const url = new URL(request.url),
    d = defaultReportingRange(),
    from = url.searchParams.get("from") ?? d.from,
    to = url.searchParams.get("to") ?? d.to;
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const key of ["category", "brand"]) {
    const value = url.searchParams.get(key);
    if (value && !uuidPattern.test(value))
      return new NextResponse(`Invalid ${key} filter`, { status: 400 });
  }
  if (!validDateRange(from, to))
    return new NextResponse("Invalid date range", { status: 400 });
  const requestedSource = url.searchParams.get("source") ?? "ALL",
    source = ["ALL", "SALE", "DAILY_BATCH"].includes(requestedSource)
      ? requestedSource
      : null;
  if (source == null)
    return new NextResponse("Invalid transaction source", { status: 400 });
  const requestedRanking = url.searchParams.get("ranking") ?? "BEST_QUANTITY",
    rankingOptions = [
      "BEST_QUANTITY",
      "BEST_REVENUE",
      "LEAST_QUANTITY",
      "LEAST_REVENUE",
      "NO_SALES",
      "SLOW_MOVING",
    ];
  if (kind === "products" && !rankingOptions.includes(requestedRanking))
    return new NextResponse("Invalid product ranking", { status: 400 });
  if (
    kind === "products" &&
    ["LEAST_QUANTITY", "LEAST_REVENUE", "NO_SALES", "SLOW_MOVING"].includes(
      requestedRanking,
    ) &&
    !(await requireActiveProfile()).permissions.includes("inventory.read")
  )
    return new NextResponse("Inventory permission required for this ranking", {
      status: 403,
    });
  const requestedView = url.searchParams.get("view") ?? "detail",
    allowedViews = ["detail", "daily", "weekly", "monthly", "annual"];
  if (kind === "sales" && !allowedViews.includes(requestedView))
    return new NextResponse("Invalid sales view", { status: 400 });
  let report;
  try {
    report = await loadReport(
      kind,
      from,
      to,
      url.searchParams.get("branch"),
      1,
      1000,
      requestedRanking,
      url.searchParams.get("q")?.slice(0, 100) ?? null,
      url.searchParams.get("category"),
      url.searchParams.get("brand"),
      source,
      requestedView,
    );
    const paginated =
      (kind === "sales" && requestedView === "detail") ||
      kind === "products" ||
      kind === "inventory" ||
      kind === "stock-movements";
    if (paginated) {
      const maximumPages = 101;
      for (let page = 2; page <= maximumPages; page += 1) {
        if (
          report.totalCount != null &&
          report.rows.length >= report.totalCount
        )
          break;
        const next = await loadReport(
          kind,
          from,
          to,
          url.searchParams.get("branch"),
          page,
          1000,
          requestedRanking,
          url.searchParams.get("q")?.slice(0, 100) ?? null,
          url.searchParams.get("category"),
          url.searchParams.get("brand"),
          source,
          requestedView,
        );
        if (page > 100 && next.rows.length > 0)
          return new NextResponse(
            "Export exceeds the 100,000-row safety limit. Narrow the filters and try again.",
            { status: 413 },
          );
        report.rows.push(...next.rows);
        if (next.rows.length < 1000) break;
      }
    }
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "BRANCH_SCOPE_DENIED",
        "COMPANY_SCOPE_REQUIRED",
        "REPORT_PERMISSION_DENIED",
      ].includes(error.message)
    )
      return new NextResponse("Report scope denied", { status: 403 });
    throw error;
  }
  return new NextResponse(toCsv(report.headers, report.rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sat-j-${kind}-${from}-${to}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
