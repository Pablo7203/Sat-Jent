import { describe, expect, it } from "vitest";
import {
  comparison,
  csvCell,
  defaultReportingRange,
  reportingRangeForPreset,
  toCsv,
  validDateRange,
} from "@/lib/reporting";
describe("reporting utilities", () => {
  it("calculates prior-period comparisons without infinity", () => {
    expect(comparison(150, 100).percent).toBe(50);
    expect(comparison(10, 0)).toEqual({
      percent: null,
      label: "No comparable prior data",
    });
    expect(comparison(0, 0).label).toBe("No change from prior period");
  });
  it("validates bounded ISO ranges", () => {
    expect(validDateRange("2026-08-01", "2026-08-31")).toBe(true);
    expect(validDateRange("2026-09-01", "2026-08-31")).toBe(false);
    expect(validDateRange("2020-01-01", "2026-01-01")).toBe(false);
    expect(validDateRange("bad", "2026-01-01")).toBe(false);
    expect(validDateRange("2026-02-31", "2026-03-01")).toBe(false);
  });
  it("defaults to the current Accra calendar month", () => {
    expect(defaultReportingRange(new Date("2026-08-31T23:00:00Z"))).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });
  it("builds Accra date presets with Monday-based weeks", () => {
    const today = new Date("2026-09-24T12:00:00Z");
    expect(reportingRangeForPreset("today", today)).toEqual({
      from: "2026-09-24",
      to: "2026-09-24",
    });
    expect(reportingRangeForPreset("this_week", today)).toEqual({
      from: "2026-09-21",
      to: "2026-09-24",
    });
    expect(reportingRangeForPreset("last_30_days", today)).toEqual({
      from: "2026-08-26",
      to: "2026-09-24",
    });
  });
  it("escapes spreadsheet-safe CSV cells", () => {
    expect(csvCell('A, "quoted"')).toBe('"A, ""quoted"""');
    expect(toCsv(["Name"], [["Kofi\nMensah"]])).toContain('"Kofi\nMensah"');
    expect(csvCell("  =1+1")).toBe('"\'  =1+1"');
  });
});
