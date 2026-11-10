"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Check, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ProductLookup,
  type ProductLookupResult,
} from "@/features/inventory/product-lookup";
import {
  formatGhsCents,
  multiplyQuantityByUnitCostToCents,
  parseMoneyToCents,
} from "@/lib/money";
import {
  postDailySalesBatch,
  reverseDailySalesBatch,
  saveDailySalesDraft,
  type DailySalesState,
} from "./actions";

type Branch = { id: string; name: string };
type BatchLine = {
  id?: string;
  key: string;
  variantId: string;
  itemCode: string;
  productName: string;
  variantName: string;
  unit: string;
  allowsDecimal: boolean;
  quantity: string;
  standardPrice: string;
  actualPrice: string;
  available: string | null;
};

export type DailySalesInitialLine = Omit<BatchLine, "key">;

const initial: DailySalesState = {};

function localBusinessDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Accra",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function money(value: string) {
  const cents = parseMoneyToCents(value);
  return cents === null ? "—" : formatGhsCents(cents);
}

export function DailySalesForm({
  batchId = "",
  branches,
  initialBranchId = "",
  salesDate = localBusinessDate(),
  notes = "",
  canBackdate,
  canOverride,
  initialLines = [],
  entryKind = "STANDARD",
  entryReason = "",
  correctionOfBatchId = "",
  correctionReference = "",
}: {
  batchId?: string;
  branches: Branch[];
  initialBranchId?: string;
  salesDate?: string;
  notes?: string;
  canBackdate: boolean;
  canOverride: boolean;
  initialLines?: DailySalesInitialLine[];
  entryKind?: "STANDARD" | "ADDITIONAL" | "CORRECTION";
  entryReason?: string;
  correctionOfBatchId?: string;
  correctionReference?: string;
}) {
  const [state, action, pending] = useActionState(saveDailySalesDraft, initial);
  const [branchId, setBranchId] = useState(initialBranchId);
  const [currentSalesDate, setCurrentSalesDate] = useState(salesDate);
  const [lines, setLines] = useState<BatchLine[]>(
    initialLines.map((line, index) => ({
      ...line,
      key: line.id ?? `line-${index}`,
    })),
  );
  const [kind, setKind] = useState(entryKind);
  const [searchError, setSearchError] = useState("");
  const currentDate = localBusinessDate();
  const revenueCents = lines.reduce<bigint>((total, line) => {
    const lineTotal = multiplyQuantityByUnitCostToCents(
      line.quantity,
      line.actualPrice,
    );
    return lineTotal === null ? total : total + lineTotal;
  }, BigInt(0));
  const quantityByUnit = lines.reduce<Record<string, number>>(
    (totals, line) => {
      const quantity = Number(line.quantity);
      if (Number.isFinite(quantity) && quantity > 0)
        totals[line.unit] = (totals[line.unit] ?? 0) + quantity;
      return totals;
    },
    {},
  );
  const requestedByVariant = new Map<string, number>();
  for (const line of lines) {
    requestedByVariant.set(
      line.variantId,
      (requestedByVariant.get(line.variantId) ?? 0) +
        (Number(line.quantity) || 0),
    );
  }
  const stockWarnings = new Set<string>();
  for (const line of lines) {
    const available = line.available === null ? null : Number(line.available);
    const requested = requestedByVariant.get(line.variantId) ?? 0;
    if (available !== null && requested > available)
      stockWarnings.add(line.variantId);
  }

  const chooseBranch = (nextBranch: string) => {
    if (nextBranch === branchId) return;
    if (
      lines.length > 0 &&
      !window.confirm(
        "Changing branches clears these lines so you can reselect products, stock and prices for the new branch. Continue?",
      )
    )
      return;
    setLines([]);
    setBranchId(nextBranch);
    setSearchError("");
  };

  const addProduct = (product: ProductLookupResult) => {
    if (!branchId) {
      setSearchError("Select a branch before adding products.");
      return;
    }
    if (product.standard_selling_price === null) {
      setSearchError(
        "This product has no standard retail price at this branch.",
      );
      return;
    }
    const standardPrice = String(product.standard_selling_price);
    setSearchError("");
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        variantId: product.variant_id,
        itemCode: product.item_code,
        productName: product.product_name,
        variantName: product.variant_name,
        unit: product.unit_symbol,
        allowsDecimal: product.allows_decimal,
        quantity: "",
        standardPrice,
        actualPrice: Number(standardPrice).toFixed(2),
        available:
          product.quantity_on_hand === null
            ? "0"
            : String(product.quantity_on_hand),
      },
    ]);
  };

  const updateLine = (key: string, update: Partial<BatchLine>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...update } : line)),
    );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="batchId" value={batchId} />
      <input
        type="hidden"
        name="correctionOfBatchId"
        value={correctionOfBatchId}
      />
      <input type="hidden" name="entryKind" value={kind} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Label className="space-y-1">
          Branch
          <select
            name="branchId"
            required
            value={branchId}
            onChange={(event) => chooseBranch(event.target.value)}
            className="min-h-11 w-full rounded-lg border bg-surface px-3"
          >
            <option value="">Choose a branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </Label>
        <Label className="space-y-1">
          Sales date
          <Input
            name="salesDate"
            type="date"
            required
            max={currentDate}
            readOnly={!canBackdate}
            value={currentSalesDate}
            onChange={(event) => setCurrentSalesDate(event.target.value)}
          />
        </Label>
      </div>
      {entryKind === "CORRECTION" ? (
        <Card className="border-amber-500/40 bg-amber-500/5 text-sm">
          Correcting reversed batch <strong>{correctionReference}</strong>. The
          original transaction remains in history; this batch will be linked to
          it.
        </Card>
      ) : !batchId ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className="space-y-1">
            Batch type
            <select
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as "STANDARD" | "ADDITIONAL")
              }
              className="min-h-11 w-full rounded-lg border bg-surface px-3"
            >
              <option value="STANDARD">Daily sales</option>
              <option value="ADDITIONAL">Additional batch</option>
            </select>
          </Label>
          {kind === "ADDITIONAL" ? (
            <Label className="space-y-1">
              Reason for additional batch
              <Input
                name="entryReason"
                minLength={3}
                required
                defaultValue={entryReason}
              />
            </Label>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="entryReason" value={entryReason} />
      )}
      {entryKind === "CORRECTION" ? (
        <input type="hidden" name="entryReason" value="" />
      ) : null}
      {currentSalesDate < currentDate ? (
        <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
          This is a backdated sales batch. Revenue will belong to{" "}
          {currentSalesDate}; stock will be deducted at the actual time you post
          it.
        </p>
      ) : null}

      {branchId ? (
        <ProductLookup
          key={branchId}
          branches={[]}
          branchId={branchId}
          showBranchSelector={false}
          clearOnSelect
          onSelect={addProduct}
          title="Add products sold"
          description="Search by Item Code, product name or variant. Select a result to add a separate sales line."
        />
      ) : (
        <Card className="space-y-2">
          <h2 className="font-semibold">Add products sold</h2>
          <p className="text-sm text-muted-foreground">
            Choose a branch first. Product search will then show that
            branch&apos;s stock and standard retail price.
          </p>
        </Card>
      )}
      {searchError ? (
        <p role="alert" className="text-sm text-destructive">
          {searchError}
        </p>
      ) : null}

      <section aria-labelledby="daily-sales-lines" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
          <div>
            <h2 id="daily-sales-lines" className="text-lg font-semibold">
              Items in this batch
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Duplicate products stay as separate lines, so different negotiated
              prices are preserved.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>
        {lines.length ? (
          lines.map((line, index) => {
            const lineTotal = multiplyQuantityByUnitCostToCents(
              line.quantity,
              line.actualPrice,
            );
            const projected =
              line.available === null
                ? null
                : Number(line.available) -
                  (requestedByVariant.get(line.variantId) ?? 0);
            return (
              <Card key={line.key} className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 border-b pb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {line.itemCode} · {line.unit}
                    </p>
                    <h3 className="mt-1 font-semibold leading-snug">
                      {line.productName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {line.variantName}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    className="min-h-9 px-3 py-1.5"
                    aria-label={`Remove line ${index + 1}: ${line.productName}`}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((item) => item.key !== line.key),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Remove
                  </Button>
                </div>
                <input type="hidden" name="variantId" value={line.variantId} />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Label className="space-y-1">
                    Quantity sold ({line.unit})
                    <Input
                      name="quantity"
                      type="number"
                      min={line.allowsDecimal ? "0.001" : "1"}
                      step={line.allowsDecimal ? "0.001" : "1"}
                      required
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: event.target.value })
                      }
                    />
                  </Label>
                  <Label className="space-y-1">
                    Actual selling price / {line.unit}
                    <Input
                      name="actualUnitPrice"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      readOnly={!canOverride}
                      value={line.actualPrice}
                      onChange={(event) =>
                        updateLine(line.key, {
                          actualPrice: event.target.value,
                        })
                      }
                    />
                    <span className="block text-xs font-normal text-muted-foreground">
                      Standard price: {money(line.standardPrice)}
                      {!canOverride ? " · Price changes require access" : ""}
                    </span>
                  </Label>
                  <div className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">
                      Available at{" "}
                      {branches.find((branch) => branch.id === branchId)?.name}
                    </p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {line.available === null
                        ? "Not available"
                        : `${line.available} ${line.unit}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Projected after this batch:{" "}
                      {projected === null ? "—" : `${projected} ${line.unit}`}
                    </p>
                  </div>
                  <div className="rounded-lg border px-3 py-2 sm:col-span-2 xl:col-span-1">
                    <p className="text-xs text-muted-foreground">Line total</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {lineTotal === null
                        ? "Enter quantity and price"
                        : formatGhsCents(lineTotal)}
                    </p>
                  </div>
                </div>
                {stockWarnings.has(line.variantId) ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 text-sm text-destructive"
                  >
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                    Combined quantity for this product exceeds the displayed
                    branch stock. Posting will be rejected until corrected.
                  </p>
                ) : null}
              </Card>
            );
          })
        ) : (
          <Card className="border-dashed text-center">
            <p className="font-medium">No products added yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Search by Item Code or product name and select a result to begin.
            </p>
          </Card>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
        <Label className="space-y-1">
          Batch notes
          <textarea
            name="notes"
            defaultValue={notes}
            maxLength={2000}
            className="min-h-24 w-full rounded-lg border bg-surface p-3"
          />
        </Label>
        <Card className="space-y-3 bg-secondary/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Product lines</span>
            <strong>{lines.length}</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Quantities by unit</span>
            <strong className="text-right">
              {Object.entries(quantityByUnit)
                .map(
                  ([unit, quantity]) => `${quantity.toLocaleString()} ${unit}`,
                )
                .join(" · ") || "—"}
            </strong>
          </div>
          <div className="border-t pt-3">
            <p className="text-sm text-muted-foreground">Daily sales revenue</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {formatGhsCents(revenueCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Revenue only. This does not record cash, bank, MoMo, or customer
              payments.
            </p>
          </div>
        </Card>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button disabled={pending}>
          {pending ? "Saving draft…" : "Save draft"}
        </Button>
        <ButtonLink
          href={batchId ? `/app/daily-sales/${batchId}` : "/app/daily-sales"}
          variant="secondary"
        >
          Cancel
        </ButtonLink>
        <p className="basis-full text-xs text-muted-foreground">
          Saving keeps this batch editable and does not reserve or reduce stock.
          Stock is checked and deducted only when a permitted user posts it.
        </p>
      </div>
    </form>
  );
}

export function PostDailySalesForm({
  batchId,
  batchNumber,
  salesDate,
  branchName,
  lineCount,
  totalRevenue,
}: {
  batchId: string;
  batchNumber: string;
  salesDate: string;
  branchName: string;
  lineCount: number;
  totalRevenue: string | number;
}) {
  const [state, action, pending] = useActionState(postDailySalesBatch, initial);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Post ${batchNumber} for ${branchName} on ${salesDate}? This records ${lineCount} product lines and ${formatGhsCents(parseMoneyToCents(String(totalRevenue)) ?? BigInt(0))} in sales revenue, and deducts the quantities from branch stock. Posted batches cannot be edited. No payment is recorded.`,
          )
        )
          event.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="batchId" value={batchId} />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button disabled={pending}>
        {pending ? "Posting daily sales…" : "Review and post daily sales"}
      </Button>
    </form>
  );
}

export function ReverseDailySalesForm({ batchId }: { batchId: string }) {
  const [state, action, pending] = useActionState(
    reverseDailySalesBatch,
    initial,
  );
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Reverse this posted batch? Original revenue remains in the audit history, its active revenue is removed from reports, and stock is restored through reversal movements.",
          )
        )
          event.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="batchId" value={batchId} />
      <Label className="space-y-1">
        Correction reason
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={500}
          className="min-h-20 w-full rounded-lg border bg-surface p-3"
        />
      </Label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button variant="danger" disabled={pending}>
        {pending ? "Reversing batch…" : "Reverse batch"}
      </Button>
    </form>
  );
}

export function SavedDraftNote() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Check aria-hidden="true" className="size-4 text-primary" />
      Draft saved. No stock has been deducted.
    </p>
  );
}
