export const formatQuantity = (value: number | string, symbol?: string) =>
  `${new Intl.NumberFormat("en-GH", { maximumFractionDigits: 3 }).format(Number(value))}${symbol ? ` ${symbol}` : ""}`;
export const movementLabel = (type: string) => type.replaceAll("_", " ");
export const related = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;
