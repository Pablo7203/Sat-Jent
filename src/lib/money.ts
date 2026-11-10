/**
 * Currency parsing and multiplication use scaled BigInt values so stock and sales calculations avoid floating-point rounding.
 */

const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d*)?$/;

export function parseDecimalScaled(
  value: string,
  scale: number,
): bigint | null {
  const normalized = value.trim();
  if (!decimalPattern.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const digits = String(scale - 1).length;
  if (fraction.length > digits) return null;
  return (
    BigInt(whole) * BigInt(scale) + BigInt(fraction.padEnd(digits, "0") || "0")
  );
}

export function multiplyQuantityByUnitCostToCents(
  quantity: string,
  unitCost: string,
): bigint | null {
  const quantityMilli = parseDecimalScaled(quantity, 1000);
  const unitCostCents = parseDecimalScaled(unitCost, 100);
  if (quantityMilli === null || unitCostCents === null) return null;
  return (quantityMilli * unitCostCents + BigInt(500)) / BigInt(1000);
}

export function parseMoneyToCents(value: string): bigint | null {
  return parseDecimalScaled(value, 100);
}

export function formatGhsCents(cents: bigint): string {
  const negative = cents < BigInt(0);
  const absolute = negative ? -cents : cents;
  const whole = absolute / BigInt(100);
  const fraction = String(absolute % BigInt(100)).padStart(2, "0");
  const grouped = new Intl.NumberFormat("en-GH", {
    maximumFractionDigits: 0,
  }).format(Number(whole));
  return `${negative ? "−" : ""}GHS ${grouped}.${fraction}`;
}
