/**
 * Defines report labels and required permissions once so report navigation and data loading follow the same access rules.
 */

export const reportCatalog = {
  sales: {
    title: "Sales report",
    description:
      "Completed individual sales and posted daily batches; daily-batch collections are deliberately not inferred.",
  },
  products: {
    title: "Product performance",
    description:
      "Rank immutable posted line quantities or value, identify least-selling, unsold and slow-moving stocked variants, and open product records.",
  },
  inventory: {
    title: "Inventory health",
    description:
      "Current branch-level stock positions, quantities, units, and low/out-of-stock status. No inventory valuation is inferred.",
  },
  "stock-movements": {
    title: "Stock movement report",
    description:
      "Auditable stock ledger entries in the selected business-date range, with movement references and item drill-downs.",
  },
  purchases: {
    title: "Purchasing report",
    description: "Non-cancelled purchase value and purchasing workflow status.",
  },
  suppliers: {
    title: "Supplier report",
    description: "Supplier balances, payments, and purchasing activity.",
  },
  customers: {
    title: "Customer report",
    description: "Customer sales, collections, and outstanding credit.",
  },
  receivables: {
    title: "Receivable aging",
    description:
      "Current outstanding credit balances grouped by due-date age as of today; walk-ins excluded. This is a current-state report, not a historical balance snapshot.",
  },
  transfers: {
    title: "Transfer report",
    description:
      "Requested, approved, dispatched, received, and in-transit transfers.",
  },
  branches: {
    title: "Branch performance",
    description:
      "Posted revenue and transaction activity by branch, with unit-safe sales quantities, current stock alerts, and pending orders.",
  },
} as const;
export type ReportKind = keyof typeof reportCatalog;
export const isReportKind = (value: string): value is ReportKind =>
  value in reportCatalog;

export function canReadReport(
  kind: ReportKind,
  permissions: readonly string[],
) {
  const has = (permission: string) => permissions.includes(permission);
  if (kind === "branches") return has("reports.company.read");
  if (kind === "inventory" || kind === "stock-movements")
    return has("inventory.read");
  if (kind === "receivables") return has("receivables.read");
  if (kind === "purchases") return has("purchases.read");
  if (kind === "suppliers")
    return has("suppliers.read") || has("supplier_payments.read");
  if (kind === "customers")
    return has("customer_payments.read") || has("receivables.read");
  if (kind === "transfers") return has("transfers.read");
  return has("reports.branch.read") || has("reports.company.read");
}
