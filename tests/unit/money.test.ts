import { describe, expect, it } from "vitest";
import {
  formatGhsCents,
  multiplyQuantityByUnitCostToCents,
  parseMoneyToCents,
} from "@/lib/money";

describe("decimal-safe purchasing money helpers", () => {
  it("multiplies decimal quantities and unit costs using integer precision", () => {
    expect(multiplyQuantityByUnitCostToCents("60", "185")).toBe(
      BigInt(11100_00),
    );
    expect(multiplyQuantityByUnitCostToCents("2.5", "19.99")).toBe(
      BigInt(4998),
    );
  });

  it("rounds a fractional pesewa result half-up", () => {
    expect(multiplyQuantityByUnitCostToCents("0.001", "5.00")).toBe(BigInt(1));
  });

  it("rejects excess precision and negative values", () => {
    expect(parseMoneyToCents("1.001")).toBeNull();
    expect(parseMoneyToCents("-1.00")).toBeNull();
    expect(multiplyQuantityByUnitCostToCents("1.0001", "1.00")).toBeNull();
  });

  it("formats GHS cents with a stable two-decimal amount", () => {
    expect(formatGhsCents(BigInt(18500))).toBe("GHS 185.00");
    expect(formatGhsCents(BigInt(-5))).toBe("−GHS 0.05");
  });
});
