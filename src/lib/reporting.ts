/**
 * Shared report calculations use Accra business dates and common CSV escaping for consistent reports and exports.
 */

export type Comparison = { percent: number | null; label: string };
export function comparison(current: number, previous: number): Comparison {
  if (!Number.isFinite(current) || !Number.isFinite(previous))
    return { percent: null, label: "No comparable prior data" };
  if (previous === 0)
    return {
      percent: null,
      label:
        current === 0
          ? "No change from prior period"
          : "No comparable prior data",
    };
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  return {
    percent,
    label: `${percent >= 0 ? "↑" : "↓"} ${Math.abs(percent).toFixed(1)}% vs previous period`,
  };
}

const iso = (date: Date) => date.toISOString().slice(0, 10);
function accraToday(today = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(today);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
}
export type ReportingPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "last_30_days";
export function reportingRangeForPreset(
  preset: ReportingPreset,
  today = new Date(),
) {
  const to = accraToday(today);
  const from = new Date(to);
  if (preset === "yesterday") {
    from.setUTCDate(from.getUTCDate() - 1);
    to.setUTCDate(to.getUTCDate() - 1);
  } else if (preset === "this_week") {
    from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  } else if (preset === "last_week") {
    from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7) - 7);
    to.setTime(from.getTime());
    to.setUTCDate(to.getUTCDate() + 6);
  } else if (preset === "this_month") {
    from.setUTCDate(1);
  } else if (preset === "last_month") {
    from.setUTCDate(1);
    from.setUTCMonth(from.getUTCMonth() - 1);
    to.setUTCDate(0);
  } else if (preset === "this_year") {
    from.setUTCMonth(0, 1);
  } else if (preset === "last_year") {
    from.setUTCFullYear(from.getUTCFullYear() - 1, 0, 1);
    to.setUTCFullYear(to.getUTCFullYear() - 1, 11, 31);
  } else if (preset === "last_30_days") {
    from.setUTCDate(from.getUTCDate() - 29);
  }
  return { from: iso(from), to: iso(to) };
}
export function defaultReportingRange(today = new Date()) {
  return reportingRangeForPreset("this_month", today);
}
export function validDateRange(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return false;
  const start = new Date(`${from}T00:00:00Z`),
    end = new Date(`${to}T00:00:00Z`);
  return (
    Number.isFinite(start.valueOf()) &&
    Number.isFinite(end.valueOf()) &&
    iso(start) === from &&
    iso(end) === to &&
    start <= end &&
    end.valueOf() - start.valueOf() <= 731 * 86_400_000
  );
}
export const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  // Spreadsheet applications may ignore leading whitespace before formulas.
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export function toCsv(headers: string[], rows: unknown[][]) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
