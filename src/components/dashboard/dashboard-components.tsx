import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatGhs } from "@/lib/format";
import { comparison } from "@/lib/reporting";

export type DashboardTickerItem = {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  tone?: "default" | "warning" | "critical";
};

export function DashboardTicker({ items }: { items: DashboardTickerItem[] }) {
  if (!items.length) return null;
  return (
    <section
      aria-label="Operational pulse"
      className="min-w-0 max-w-full overflow-hidden rounded-[14px] border border-border bg-card"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Activity aria-hidden="true" className="size-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Operational pulse
        </p>
      </div>
      <div className="flex min-w-0 max-w-full snap-x snap-mandatory overflow-x-auto px-2 py-2 [scrollbar-width:thin]">
        {items.map((item) => {
          const content = (
            <div
              className={`flex min-w-44 snap-start items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                item.tone === "critical"
                  ? "text-destructive hover:bg-destructive/10"
                  : item.tone === "warning"
                    ? "text-warning hover:bg-warning/10"
                    : "text-primary hover:bg-secondary"
              }`}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-muted-foreground">
                  {item.label}
                </span>
                <span className="block truncate text-base font-semibold tabular-nums text-foreground">
                  {item.value}
                </span>
              </span>
            </div>
          );
          return item.href ? (
            <Link
              className="shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href={item.href}
              key={item.label}
            >
              {content}
            </Link>
          ) : (
            <div className="shrink-0" key={item.label}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  prior,
  href,
  money = true,
  context,
}: {
  label: string;
  value: number;
  prior?: number | null;
  href?: string;
  money?: boolean;
  context?: string;
}) {
  const delta = prior == null ? null : comparison(value, prior);
  const body = (
    <div className="h-full rounded-[14px] border border-border bg-card p-5 tabular-nums">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-[28px] font-semibold tracking-[-0.035em] text-foreground">
        {money
          ? formatGhs(value)
          : new Intl.NumberFormat("en-GH", { maximumFractionDigits: 2 }).format(
              value,
            )}
      </p>
      {context ? (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {context}
        </p>
      ) : null}
      {delta ? (
        <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
          {delta.percent == null ? (
            <Minus size={14} />
          ) : delta.percent >= 0 ? (
            <ArrowUpRight size={14} />
          ) : (
            <ArrowDownRight size={14} />
          )}
          {delta.label}
        </p>
      ) : null}
    </div>
  );
  return href ? (
    <Link className="block rounded-xl focus-visible:outline" href={href}>
      {body}
    </Link>
  ) : (
    body
  );
}
export function DashboardSection({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[14px] border border-border bg-card p-5 sm:p-6 ${className}`}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? (
          <Link
            className="text-sm font-semibold text-primary hover:text-foreground"
            href={action.href}
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
export function TrendChart({
  points,
}: {
  points: { date: string; sales: number; collections: number | null }[];
}) {
  const hasCollections = points.some((point) => point.collections != null);
  const salesTotal = points.reduce((sum, point) => sum + point.sales, 0);
  const collectionTotal = hasCollections
    ? points.reduce((sum, point) => sum + (point.collections ?? 0), 0)
    : null;
  const max = Math.max(
    1,
    ...points.flatMap((p) => [
      p.sales,
      ...(p.collections == null ? [] : [p.collections]),
    ]),
  );
  const path = (key: "sales" | "collections") =>
    points
      .map(
        (point, index) =>
          `${index ? "L" : "M"} ${(index / Math.max(1, points.length - 1)) * 100} ${38 - ((point[key] ?? 0) / max) * 34}`,
      )
      .join(" ");
  if (!points.some((point) => point.sales || point.collections))
    return (
      <p className="rounded-lg bg-secondary p-6 text-center text-sm text-muted-foreground">
        No completed sales or posted collections for this period.
      </p>
    );
  return (
    <div>
      <svg
        className="h-64 w-full"
        viewBox="0 0 100 40"
        role="img"
        aria-labelledby="trend-title trend-description"
        preserveAspectRatio="none"
      >
        <title id="trend-title">Sales and customer collections trend</title>
        <desc id="trend-description">
          Selected-period sales revenue total {formatGhs(salesTotal)}.
          {collectionTotal == null
            ? " Customer collections are not available for this role."
            : ` Customer collections total ${formatGhs(collectionTotal)} and are not revenue.`}
        </desc>
        <path
          d={path("sales")}
          fill="none"
          stroke="var(--chart-sales)"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
        {hasCollections ? (
          <path
            d={path("collections")}
            fill="none"
            stroke="var(--chart-collections)"
            strokeDasharray="3 2"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>
          <span className="mr-2 inline-block h-1 w-6 bg-[var(--chart-sales)]" />
          Sales revenue ·{" "}
          <strong className="font-semibold text-foreground">
            {formatGhs(salesTotal)}
          </strong>
        </span>
        {collectionTotal != null ? (
          <span>
            <span className="mr-2 inline-block h-1 w-6 bg-[var(--chart-collections)]" />
            Collections ·{" "}
            <strong className="font-semibold text-foreground">
              {formatGhs(collectionTotal)}
            </strong>
          </span>
        ) : null}
      </div>
    </div>
  );
}
export function RankedBars({
  rows,
  money = true,
}: {
  rows: { label: string; value: number; href?: string }[];
  money?: boolean;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length)
    return (
      <p className="text-sm text-muted-foreground">No data for this period.</p>
    );
  return (
    <ol className="space-y-4">
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`}>
          <div className="mb-2 flex justify-between gap-3 text-sm text-muted-foreground">
            <span className="truncate">
              <strong className="mr-2 text-muted-foreground">
                {index + 1}
              </strong>
              {row.href ? (
                <Link className="hover:text-primary" href={row.href}>
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
            </span>
            <strong className="tabular-nums text-foreground">
              {money ? formatGhs(row.value) : row.value.toLocaleString()}
            </strong>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-input">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
export function StatusGrid({
  rows,
}: {
  rows: {
    label: string;
    value: number;
    href?: string;
    tone?: "critical" | "warning" | "info";
  }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => {
        const content = (
          <div
            className={`rounded-lg border border-border bg-secondary p-4 ${row.tone === "critical" ? "border-l-2 border-l-destructive" : row.tone === "warning" ? "border-l-2 border-l-warning" : "border-l-2 border-l-primary"}`}
          >
            <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">
              {row.value.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{row.label}</p>
          </div>
        );
        return row.href ? (
          <Link key={row.label} href={row.href}>
            {content}
          </Link>
        ) : (
          <div key={row.label}>{content}</div>
        );
      })}
    </div>
  );
}
