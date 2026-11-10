"use client";
import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatGhs } from "@/lib/format";
import {
  createPurchase,
  receivePurchase,
  recordPayment,
  saveSupplier,
  type PurchasingState,
} from "./actions";
const initial: PurchasingState = {};
const today = () => new Date().toISOString().slice(0, 10);
const summaryQuantity = (totals: Record<string, number>) =>
  Object.entries(totals)
    .filter(([, quantity]) => quantity > 0)
    .map(
      ([unit, quantity]) =>
        `${new Intl.NumberFormat("en-GH", { maximumFractionDigits: 3 }).format(quantity)} ${unit}`,
    )
    .join(" · ") || "—";
const Feedback = ({ state }: { state: PurchasingState }) =>
  state.error || state.success ? (
    <p
      role="status"
      className={state.error ? "text-sm text-destructive" : "text-sm"}
    >
      {state.error || state.success}
    </p>
  ) : null;
const Area = ({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
}) => (
  <Label>
    {label}
    <textarea
      name={name}
      defaultValue={defaultValue ?? ""}
      className="mt-1 w-full rounded-lg border bg-surface p-3"
    />
  </Label>
);
export function SupplierForm({
  supplier,
}: {
  supplier?: Record<string, string | null>;
}) {
  const [state, action, pending] = useActionState(saveSupplier, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {supplier?.id ? (
        <input type="hidden" name="id" value={supplier.id} />
      ) : null}
      <Label>
        Supplier name
        <Input name="name" required defaultValue={supplier?.name ?? ""} />
      </Label>
      <Label>
        Company name
        <Input name="company" defaultValue={supplier?.company_name ?? ""} />
      </Label>
      <Label>
        Contact person
        <Input name="contact" defaultValue={supplier?.contact_person ?? ""} />
      </Label>
      <Label>
        Phone
        <Input name="phone" type="tel" defaultValue={supplier?.phone ?? ""} />
      </Label>
      <Label>
        Email
        <Input name="email" type="email" defaultValue={supplier?.email ?? ""} />
      </Label>
      <Label>
        Address
        <Input name="address" defaultValue={supplier?.address ?? ""} />
      </Label>
      <div className="sm:col-span-2">
        <Area name="notes" label="Notes" defaultValue={supplier?.notes} />
      </div>
      <Feedback state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Saving…" : "Save supplier"}
        </Button>
      </div>
    </form>
  );
}
type Option = { id: string; label: string };
type PurchaseLineDraft = {
  variantId: string;
  itemCode: string;
  productName: string;
  variantName: string;
  unitSymbol: string;
  allowsDecimal: boolean;
  quantity: string;
  unitCost: string;
  discount: string;
};
type PurchaseDraft = {
  id: string;
  supplierId: string;
  branchId: string;
  purchaseDate: string;
  expectedDate: string;
  invoice: string;
  notes: string;
  discount: string;
  otherCosts: string;
};
const purchaseLineFromLookup = (
  item: ProductLookupResult,
): PurchaseLineDraft => ({
  variantId: item.variant_id,
  itemCode: item.item_code,
  productName: item.product_name,
  variantName: item.variant_name,
  unitSymbol: item.unit_symbol,
  allowsDecimal: item.allows_decimal,
  quantity: "",
  unitCost: "",
  discount: "0",
});
export function PurchaseForm({
  suppliers,
  branches,
  canBackdate,
  purchase,
  initialItems = [],
}: {
  suppliers: Option[];
  branches: Option[];
  canBackdate: boolean;
  purchase?: PurchaseDraft;
  initialItems?: PurchaseLineDraft[];
}) {
  const [state, action, pending] = useActionState(createPurchase, initial);
  const [branchId, setBranchId] = useState(
    purchase?.branchId ?? branches[0]?.id ?? "",
  );
  const [lines, setLines] = useState(initialItems);
  const [notice, setNotice] = useState("");
  const [purchaseDiscount, setPurchaseDiscount] = useState(
    purchase?.discount ?? "0",
  );
  const [otherCosts, setOtherCosts] = useState(purchase?.otherCosts ?? "0");
  const addProduct = (result: ProductLookupResult) => {
    if (lines.some((line) => line.variantId === result.variant_id)) {
      setNotice(`${result.item_code} is already on this order.`);
      return;
    }
    setLines((current) => [...current, purchaseLineFromLookup(result)]);
    setNotice(`${result.item_code} added to the purchase order.`);
  };
  const lineCents = lines.map((line) => {
    const value = multiplyQuantityByUnitCostToCents(
      line.quantity,
      line.unitCost,
    );
    const discount = parseMoneyToCents(line.discount || "0");
    return value === null || discount === null ? null : value - discount;
  });
  const subtotal = lineCents.some((value) => value === null)
    ? null
    : (lineCents as bigint[]).reduce((sum, value) => sum + value, BigInt(0));
  const orderDiscount = parseMoneyToCents(purchaseDiscount || "0");
  const extraCosts = parseMoneyToCents(otherCosts || "0");
  const total =
    subtotal === null || orderDiscount === null || extraCosts === null
      ? null
      : subtotal - orderDiscount + extraCosts;
  const readyToConfirm =
    lines.length > 0 &&
    lines.every(
      (line) =>
        Number(line.quantity) > 0 &&
        parseMoneyToCents(line.unitCost) !== null &&
        parseMoneyToCents(line.discount || "0") !== null,
    );
  const orderedQuantityByUnit = lines.reduce<Record<string, number>>(
    (total, line) => {
      total[line.unitSymbol] =
        (total[line.unitSymbol] ?? 0) + (Number(line.quantity) || 0);
      return total;
    },
    {},
  );
  const updateLine = (index: number, update: Partial<PurchaseLineDraft>) =>
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...update } : line,
      ),
    );
  return (
    <form action={action} className="space-y-5">
      {purchase ? (
        <input type="hidden" name="purchaseId" value={purchase.id} />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Label>
          Supplier
          <select
            name="supplierId"
            required
            defaultValue={purchase?.supplierId}
            className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
          >
            {suppliers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          Receiving branch
          <select
            name="branchId"
            required
            className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
          >
            {branches.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          Purchase date
          <Input
            type="date"
            name="purchaseDate"
            required
            max={today()}
            defaultValue={purchase?.purchaseDate ?? today()}
            readOnly={!canBackdate}
          />
        </Label>
        <Label>
          Expected delivery
          <Input
            type="date"
            name="expectedDate"
            min={purchase?.purchaseDate ?? today()}
            defaultValue={purchase?.expectedDate ?? ""}
          />
        </Label>
        <Label>
          Supplier invoice/reference
          <Input name="invoice" defaultValue={purchase?.invoice ?? ""} />
        </Label>
        <Label>
          Purchase-order discount
          <Input
            type="number"
            min="0"
            step="0.01"
            name="discount"
            value={purchaseDiscount}
            onChange={(event) => setPurchaseDiscount(event.target.value)}
          />
        </Label>
        <Label>
          Other costs
          <Input
            type="number"
            min="0"
            step="0.01"
            name="otherCosts"
            value={otherCosts}
            onChange={(event) => setOtherCosts(event.target.value)}
          />
        </Label>
      </div>
      <ProductLookup
        branches={branches.map(({ id, label }) => ({ id, name: label }))}
        branchId={branchId}
        onBranchChange={setBranchId}
        showBranchSelector={false}
        onSelect={addProduct}
        title="Add products by Item Code or name"
        description="Choose the exact sellable variant. The lookup is authorized for your active branch scope."
      />
      <fieldset className="space-y-3">
        <legend className="font-semibold">Purchase order lines</legend>
        {lines.map((line, index) => {
          const amount = lineCents[index];
          return (
            <div
              key={line.variantId}
              className="grid gap-3 rounded-xl border bg-surface p-3 sm:grid-cols-[minmax(12rem,1.5fr)_minmax(7rem,.65fr)_minmax(8rem,.8fr)_minmax(7rem,.65fr)_minmax(8rem,.85fr)_auto] sm:items-end"
            >
              <input type="hidden" name="variantId" value={line.variantId} />
              <div>
                <strong className="block text-sm">
                  Item Code {line.itemCode}
                </strong>
                <span className="text-sm">{line.productName}</span>
                <span className="block text-xs text-muted-foreground">
                  {line.variantName} · {line.unitSymbol}
                </span>
              </div>
              <Label>
                Quantity ({line.unitSymbol})
                <Input
                  aria-label={`Quantity for Item Code ${line.itemCode}`}
                  name="quantity"
                  type="number"
                  min={line.allowsDecimal ? "0.001" : "1"}
                  step={line.allowsDecimal ? "0.001" : "1"}
                  value={line.quantity}
                  onChange={(event) =>
                    updateLine(index, { quantity: event.target.value })
                  }
                />
              </Label>
              <Label>
                Buying price / {line.unitSymbol}
                <Input
                  aria-label={`Buying price for Item Code ${line.itemCode}`}
                  name="unitCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitCost}
                  onChange={(event) =>
                    updateLine(index, { unitCost: event.target.value })
                  }
                />
              </Label>
              <Label>
                Line discount
                <Input
                  aria-label={`Discount for Item Code ${line.itemCode}`}
                  name="lineDiscount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.discount}
                  onChange={(event) =>
                    updateLine(index, { discount: event.target.value })
                  }
                />
              </Label>
              <div className="text-sm sm:pb-2">
                <span className="block text-muted-foreground">Line total</span>
                <strong>
                  {amount === null
                    ? "Complete valid values"
                    : formatGhsCents(amount)}
                </strong>
              </div>
              <Button
                aria-label={`Remove Item Code ${line.itemCode}`}
                type="button"
                variant="secondary"
                onClick={() =>
                  setLines((current) => current.filter((_, i) => i !== index))
                }
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Remove
              </Button>
            </div>
          );
        })}
        {!lines.length ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No items yet. Search above and select a product variant to add it.
          </p>
        ) : null}
        {notice ? (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </fieldset>
      <div className="grid gap-2 rounded-xl bg-secondary/50 p-4 text-sm sm:ml-auto sm:max-w-sm">
        <p className="flex justify-between gap-4">
          <span>Ordered quantity</span>
          <strong>{summaryQuantity(orderedQuantityByUnit)}</strong>
        </p>
        <p className="flex justify-between gap-4">
          <span>Line subtotal</span>
          <strong>
            {subtotal === null
              ? "Complete valid lines"
              : formatGhsCents(subtotal)}
          </strong>
        </p>
        <p className="flex justify-between gap-4">
          <span>Order discount</span>
          <strong>
            {orderDiscount === null ? "Invalid" : formatGhsCents(orderDiscount)}
          </strong>
        </p>
        <p className="flex justify-between gap-4">
          <span>Other order costs</span>
          <strong>
            {extraCosts === null ? "Invalid" : formatGhsCents(extraCosts)}
          </strong>
        </p>
        <p className="flex justify-between gap-4 border-t pt-2 text-base">
          <span>Purchase order total</span>
          <strong>
            {total === null || total < BigInt(0)
              ? "Complete valid values"
              : formatGhsCents(total)}
          </strong>
        </p>
      </div>
      <Area name="notes" label="Notes" defaultValue={purchase?.notes} />
      <Feedback state={state} />
      <div className="flex flex-wrap gap-3">
        <Button
          name="intent"
          value="DRAFT"
          variant="secondary"
          disabled={pending}
        >
          <Plus aria-hidden="true" className="size-4" />
          {pending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          name="intent"
          value="ORDERED"
          disabled={pending || !readyToConfirm}
        >
          {pending ? "Saving…" : "Save and confirm order"}
        </Button>
      </div>
    </form>
  );
}
export function ReceiptForm({
  purchaseId,
  operationId,
  receiptDate,
  deliveryReference = "",
  notes = "",
  branchId,
  canBackdate,
  items,
  branches,
  canManagePrices,
}: {
  purchaseId: string;
  operationId: string;
  receiptDate: string;
  deliveryReference?: string;
  notes?: string;
  branchId: string;
  canBackdate: boolean;
  branches: { id: string; name: string }[];
  canManagePrices: boolean;
  items: {
    id: string;
    variantId: string;
    itemCode: string;
    label: string;
    unitSymbol: string;
    allowsDecimal: boolean;
    ordered: string;
    received: string;
    agreedCost: string;
    currentSellingPrice: string | null;
  }[];
}) {
  const [state, action, pending] = useActionState(receivePurchase, initial);
  const [lines, setLines] = useState(
    items.map((item) => ({
      quantity: "0",
      actualCost: Number(item.agreedCost).toFixed(2),
      zeroCostReason: "",
      updatePrice: false,
      newPrice: "",
      priceScope: "COMPANY",
    })),
  );
  const receivedValues = lines.map((line) =>
    multiplyQuantityByUnitCostToCents(line.quantity, line.actualCost),
  );
  const receiptTotal = receivedValues.some((value) => value === null)
    ? null
    : (receivedValues as bigint[]).reduce(
        (sum, value) => sum + value,
        BigInt(0),
      );
  const receivedQuantityByUnit = lines.reduce<Record<string, number>>(
    (total, line, index) => {
      total[items[index].unitSymbol] =
        (total[items[index].unitSymbol] ?? 0) + (Number(line.quantity) || 0);
      return total;
    },
    {},
  );
  const updateLine = (index: number, update: Partial<(typeof lines)[number]>) =>
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...update } : line,
      ),
    );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <input type="hidden" name="operationId" value={operationId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Label>
          Receipt date
          <Input
            name="receiptDate"
            type="date"
            max={today()}
            defaultValue={receiptDate}
            readOnly={!canBackdate}
            required
          />
        </Label>
        <Label>
          Delivery note number
          <Input name="deliveryReference" defaultValue={deliveryReference} />
        </Label>
      </div>
      <input type="hidden" name="branchId" value={branchId} />
      <p className="text-sm text-muted-foreground">
        Receiving branch:{" "}
        {branches.find((branch) => branch.id === branchId)?.name ??
          "Authorized branch"}
      </p>
      <section aria-labelledby="receipt-items-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
          <h2 id="receipt-items-heading" className="text-base font-semibold">
            Items to receive
          </h2>
          <p className="text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"} outstanding
          </p>
        </div>
        {items.map((x, index) => {
          const line = lines[index];
          const outstanding = Number(x.ordered) - Number(x.received);
          const varianceCents =
            parseMoneyToCents(line.actualCost) === null
              ? null
              : parseMoneyToCents(line.actualCost)! -
                parseMoneyToCents(x.agreedCost)!;
          return (
            <Card key={x.id} className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {x.itemCode} · {x.unitSymbol}
                  </p>
                  <h3 className="mt-1 text-base font-semibold leading-snug">
                    {x.label.replace(`Item Code ${x.itemCode} — `, "")}
                  </h3>
                </div>
                <div className="rounded-md bg-muted/50 px-3 py-2 text-right">
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="font-semibold tabular-nums">
                    {outstanding} {x.unitSymbol}
                  </p>
                </div>
              </div>
              <input type="hidden" name="itemId" value={x.id} />
              <input type="hidden" name="variantId" value={x.variantId} />
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p className="text-muted-foreground">
                  Ordered{" "}
                  <span className="ml-1 font-medium text-foreground">
                    {x.ordered} {x.unitSymbol}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Previously received{" "}
                  <span className="ml-1 font-medium text-foreground">
                    {x.received} {x.unitSymbol}
                  </span>
                </p>
              </div>
              <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4">
                <Label className="space-y-1">
                  Receive now ({x.unitSymbol})
                  <Input
                    aria-label={`Receive ${x.label}`}
                    name="quantity"
                    type="number"
                    min="0"
                    max={outstanding}
                    step={x.allowsDecimal ? "0.001" : "1"}
                    value={line.quantity}
                    onChange={(event) => {
                      const quantity = event.target.value;
                      updateLine(index, {
                        quantity,
                        ...(Number(quantity) > 0 ? {} : { updatePrice: false }),
                      });
                    }}
                  />
                </Label>
                <div className="space-y-1">
                  <Label className="space-y-1">
                    Actual buying price / {x.unitSymbol}
                    <Input
                      aria-label={`Actual buying price for ${x.label}`}
                      name="actualUnitCost"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={line.actualCost}
                      onChange={(event) =>
                        updateLine(index, { actualCost: event.target.value })
                      }
                    />
                  </Label>
                  <input
                    type="hidden"
                    name="agreedUnitCost"
                    value={x.agreedCost}
                  />
                  <p className="text-xs text-muted-foreground">
                    Agreed {formatGhs(x.agreedCost)} / {x.unitSymbol}
                    {varianceCents !== null && varianceCents !== BigInt(0)
                      ? ` · Difference ${formatGhsCents(varianceCents)}`
                      : ""}
                  </p>
                  {parseMoneyToCents(line.actualCost) === BigInt(0) ? (
                    <Label className="block space-y-1">
                      Reason for zero cost
                      <Input
                        name="zeroCostReason"
                        value={line.zeroCostReason}
                        onChange={(event) =>
                          updateLine(index, {
                            zeroCostReason: event.target.value,
                          })
                        }
                      />
                    </Label>
                  ) : (
                    <input type="hidden" name="zeroCostReason" value="" />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Current selling price
                    <span className="mt-1 block font-medium text-foreground">
                      {x.currentSellingPrice === null
                        ? "Not set"
                        : `${formatGhs(x.currentSellingPrice)} / ${x.unitSymbol}`}
                    </span>
                  </p>
                  {canManagePrices ? (
                    <>
                      <Label
                        className={`flex items-center gap-2 ${Number(line.quantity) <= 0 ? "text-muted-foreground" : "cursor-pointer"}`}
                      >
                        <input
                          type="checkbox"
                          name="priceUpdateSelected"
                          checked={line.updatePrice}
                          disabled={Number(line.quantity) <= 0}
                          className="size-4 accent-primary disabled:cursor-not-allowed"
                          onChange={(event) =>
                            updateLine(index, {
                              updatePrice: event.target.checked,
                            })
                          }
                        />
                        Update selling price
                      </Label>
                      {Number(line.quantity) <= 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Enter a receive quantity to enable this option.
                        </p>
                      ) : null}
                      {line.updatePrice ? (
                        <>
                          <input
                            type="hidden"
                            name="priceUpdateVariantId"
                            value={x.variantId}
                          />
                          <Label className="block space-y-1">
                            New standard price
                            <Input
                              name="priceUpdateAmount"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={line.newPrice}
                              onChange={(event) =>
                                updateLine(index, {
                                  newPrice: event.target.value,
                                })
                              }
                            />
                          </Label>
                          <Label className="block space-y-1">
                            Price scope
                            <select
                              name="priceUpdateScope"
                              value={line.priceScope}
                              onChange={(event) =>
                                updateLine(index, {
                                  priceScope: event.target.value,
                                })
                              }
                              className="min-h-10 w-full rounded-lg border bg-surface px-3"
                            >
                              <option value="COMPANY">Company standard</option>
                              <option value="BRANCH">
                                Receiving branch only
                              </option>
                            </select>
                          </Label>
                          {line.newPrice &&
                          line.actualCost &&
                          Number(line.newPrice) < Number(line.actualCost) ? (
                            <p
                              role="status"
                              className="text-xs text-muted-foreground"
                            >
                              Proposed selling price is below this
                              receipt&apos;s buying cost.
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Price updates require price-management access.
                    </p>
                  )}
                </div>
                <div className="rounded-md bg-muted/50 px-3 py-2 xl:text-right">
                  <p className="text-xs text-muted-foreground">Receipt value</p>
                  <p className="font-semibold tabular-nums">
                    {receivedValues[index] === null
                      ? "Enter valid values"
                      : formatGhsCents(receivedValues[index]!)}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <Area name="notes" label="Receipt notes" defaultValue={notes} />
        <Card className="space-y-1">
          <p className="text-sm">
            Lines receiving:{" "}
            <strong>
              {
                receivedValues.filter(
                  (value, index) =>
                    Number(lines[index].quantity) > 0 && value !== null,
                ).length
              }
            </strong>
          </p>
          <p className="text-sm">
            Quantity received:{" "}
            <strong>{summaryQuantity(receivedQuantityByUnit)}</strong>
          </p>
          <p className="text-sm">
            Selling-price updates:{" "}
            <strong>{lines.filter((line) => line.updatePrice).length}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Total actual receipt value
          </p>
          <strong className="text-lg">
            {receiptTotal === null
              ? "Enter valid quantities and costs"
              : formatGhsCents(receiptTotal)}
          </strong>
        </Card>
      </div>
      <Card className="text-sm">
        Posting this receipt increases stock at{" "}
        {branches.find((branch) => branch.id === branchId)?.name ??
          "the purchase branch"}
        . It records the actual buying cost; changing the selling price is
        optional and explicit.
      </Card>
      <p className="text-sm text-muted-foreground">
        The purchase order&apos;s agreed unit cost is preserved for comparison.
        This posted receipt cannot be edited or deleted; corrections must use
        the authorized stock adjustment and supplier/payment correction
        workflow.
      </p>
      <Feedback state={state} />
      <Button disabled={pending}>
        {pending ? "Posting receipt…" : "Review and post goods receipt"}
      </Button>
    </form>
  );
}
export function PaymentForm({
  purchase,
  canBackdate,
  accounts,
}: {
  purchase: {
    purchaseId: string;
    supplierId: string;
    branchId: string;
    balance: string;
  };
  canBackdate: boolean;
  accounts: Option[];
}) {
  const [state, action, pending] = useActionState(recordPayment, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="purchaseId" value={purchase.purchaseId} />
      <input type="hidden" name="supplierId" value={purchase.supplierId} />
      <input type="hidden" name="branchId" value={purchase.branchId} />
      <input type="hidden" name="operationId" value={crypto.randomUUID()} />
      <p className="sm:col-span-2">
        Outstanding balance:{" "}
        <strong>GHS {Number(purchase.balance).toFixed(2)}</strong>
      </p>
      <Label>
        Amount
        <Input
          name="amount"
          type="number"
          required
          min="0.01"
          max={purchase.balance}
          step="0.01"
        />
      </Label>
      <Label>
        Method
        <select
          name="method"
          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
        >
          <option>CASH</option>
          <option>MOBILE_MONEY</option>
          <option>BANK_TRANSFER</option>
          <option>CARD_POS</option>
          <option>OTHER</option>
        </select>
      </Label>
      <Label>
        Pay from account
        <select
          name="accountId"
          required
          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
        >
          <option value="">Choose account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </select>
      </Label>
      <Label>
        Payment date
        <Input
          name="paymentDate"
          type="date"
          required
          max={today()}
          defaultValue={today()}
          readOnly={!canBackdate}
        />
      </Label>
      <Label>
        Reference
        <Input name="reference" />
      </Label>
      <div className="sm:col-span-2">
        <Area name="notes" label="Notes" />
      </div>
      <Feedback state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Recording…" : "Confirm payment"}
        </Button>
      </div>
    </form>
  );
}
