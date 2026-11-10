"use client";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useState } from "react";
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
  parseDecimalScaled,
  parseMoneyToCents,
} from "@/lib/money";
import {
  cancelSale,
  completeSale,
  createSale,
  recordCustomerPayment,
  saveCustomer,
  type SalesState,
} from "./actions";
const initial: SalesState = {};
const today = () => new Date().toISOString().slice(0, 10);
const Feedback = ({ state }: { state: SalesState }) =>
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
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
}) => (
  <Label>
    {label}
    <textarea
      name={name}
      required={required}
      defaultValue={defaultValue ?? ""}
      className="mt-1 w-full rounded-lg border bg-surface p-3"
    />
  </Label>
);
export function CustomerForm({
  customer,
}: {
  customer?: Record<string, string | null>;
}) {
  const [state, action, pending] = useActionState(saveCustomer, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {customer?.id ? (
        <input type="hidden" name="id" value={customer.id} />
      ) : null}
      <Label>
        Customer name
        <Input name="name" required defaultValue={customer?.name ?? ""} />
      </Label>
      <Label>
        Customer type
        <select
          name="type"
          defaultValue={customer?.customer_type ?? "INDIVIDUAL"}
          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
        >
          {[
            "INDIVIDUAL",
            "CONTRACTOR",
            "CONSTRUCTION_COMPANY",
            "RETAILER",
            "ARCHITECT_DESIGNER",
            "OTHER",
          ].map((x) => (
            <option key={x}>{x.replaceAll("_", " ")}</option>
          ))}
        </select>
      </Label>
      <Label>
        Company
        <Input name="company" defaultValue={customer?.company_name ?? ""} />
      </Label>
      <Label>
        Phone
        <Input name="phone" type="tel" defaultValue={customer?.phone ?? ""} />
      </Label>
      <Label>
        Email
        <Input name="email" type="email" defaultValue={customer?.email ?? ""} />
      </Label>
      <Label>
        Address
        <Input name="address" defaultValue={customer?.address ?? ""} />
      </Label>
      <div className="sm:col-span-2">
        <Area name="notes" label="Notes" defaultValue={customer?.notes} />
      </div>
      <Feedback state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Saving…" : "Save customer"}
        </Button>
      </div>
    </form>
  );
}
type Option = { id: string; label: string };
type CustomerOption = Option & { isWalkIn: boolean };
type SaleLine = {
  id: string;
  variantId: string;
  product: ProductLookupResult;
  quantity: string;
  unitPrice: string;
  standardPrice: string;
};
const retailPriceFor = (product: ProductLookupResult) =>
  product.standard_selling_price == null
    ? ""
    : String(product.standard_selling_price);
const lineTotalCents = (line: SaleLine) => {
  const gross = multiplyQuantityByUnitCostToCents(
    line.quantity,
    line.unitPrice,
  );
  return gross ?? BigInt(0);
};
export function SaleForm({
  customers,
  branches,
  canOverride,
  canBackdate,
}: {
  customers: CustomerOption[];
  branches: Option[];
  canOverride: boolean;
  canBackdate: boolean;
}) {
  const [state, action, pending] = useActionState(createSale, initial);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [product, setProduct] = useState<ProductLookupResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [entryError, setEntryError] = useState("");
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );
  const isWalkIn = selectedCustomer?.isWalkIn ?? false;
  const basePrice = product ? retailPriceFor(product) : "";
  const chooseProduct = (picked: ProductLookupResult) => {
    setProduct(picked);
    setUnitPrice(retailPriceFor(picked));
    setQuantity("");
    setEntryError("");
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>("[name='entryQuantity']")
        ?.focus(),
    );
  };
  const addLine = () => {
    setEntryError("");
    if (!product)
      return setEntryError("Search for and select a product first.");
    const quantityValue = product.allows_decimal
      ? parseDecimalScaled(quantity, 1000)
      : /^\d+$/.test(quantity)
        ? BigInt(quantity || "0")
        : null;
    if (quantityValue === null || quantityValue <= BigInt(0))
      return setEntryError(
        product.allows_decimal
          ? "Enter a valid quantity."
          : "Enter a whole-number quantity for this product.",
      );
    const priceCents = parseMoneyToCents(unitPrice);
    if (!basePrice || priceCents === null || priceCents < BigInt(0))
      return setEntryError(
        "A retail price must be set for this product before it can be added.",
      );
    if (!canOverride && unitPrice !== basePrice)
      return setEntryError(
        "You do not have permission to change the standard price.",
      );
    const gross = multiplyQuantityByUnitCostToCents(quantity, unitPrice);
    if (gross === null)
      return setEntryError("Enter a valid quantity and unit price.");
    const nextLine: SaleLine = {
      id: editingLineId ?? crypto.randomUUID(),
      variantId: product.variant_id,
      product,
      quantity,
      unitPrice,
      standardPrice: basePrice,
    };
    setLines((current) =>
      editingLineId
        ? current.map((line) => (line.id === editingLineId ? nextLine : line))
        : [...current, nextLine],
    );
    resetEntry();
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLInputElement>('input[role="combobox"]')
        ?.focus(),
    );
  };
  const resetEntry = () => {
    setProduct(null);
    setQuantity("");
    setUnitPrice("");
    setEditingLineId(null);
    setEntryError("");
  };
  const editLine = (line: SaleLine) => {
    setProduct(line.product);
    setQuantity(line.quantity);
    setUnitPrice(line.unitPrice);
    setEditingLineId(line.id);
    setEntryError("");
  };
  const itemsTotal = lines.reduce(
    (total, line) => total + lineTotalCents(line),
    BigInt(0),
  );
  const totalCents = itemsTotal;
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Label>
          Branch
          <select
            name="branchId"
            required
            value={branchId}
            disabled={lines.length > 0}
            onChange={(event) => {
              setBranchId(event.target.value);
              if (product) resetEntry();
            }}
            className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
          >
            {branches.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          {lines.length > 0 ? (
            <input type="hidden" name="branchId" value={branchId} />
          ) : null}
          {lines.length > 0 ? (
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Remove all items to change the branch.
            </span>
          ) : null}
        </Label>
        <Label>
          Customer
          <select
            name="customerId"
            required
            onChange={(event) => setCustomerId(event.target.value)}
            value={customerId}
            className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
          >
            {customers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          Credit due date
          <Input disabled={isWalkIn} name="dueDate" type="date" />
          {isWalkIn ? (
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Walk-in sales must be paid in full.
            </span>
          ) : null}
        </Label>
        <Label>
          Sale date
          <Input
            name="saleDate"
            type="date"
            required
            max={today()}
            defaultValue={today()}
            readOnly={!canBackdate}
          />
        </Label>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)]">
        <Card className="order-2 space-y-4 p-4 sm:p-5 lg:order-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Items in this sale</h2>
              <p className="text-sm text-muted-foreground">
                {lines.length} {lines.length === 1 ? "item" : "items"}
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              Unit prices and line totals
            </span>
          </div>
          {lines.length ? (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-[30%] py-3 pr-2">Product</th>
                    <th className="w-[10%] py-3 pr-2">Qty</th>
                    <th className="w-[20%] py-3 pr-2">Unit price</th>
                    <th className="w-[20%] py-3 pr-2 text-right">Line total</th>
                    <th className="w-[20%] py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-b last:border-0">
                      <td className="py-3 pr-2">
                        <span className="block break-words font-medium">
                          {line.product.product_name}
                        </span>
                        <span className="break-words text-xs text-muted-foreground">
                          {line.product.variant_name} · {line.product.item_code}
                        </span>
                      </td>
                      <td className="py-3 pr-2">
                        {line.quantity} {line.product.unit_symbol}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-2 text-xs">
                        {formatGhsCents(
                          parseMoneyToCents(line.unitPrice) ?? BigInt(0),
                        )}
                        <span className="block text-xs text-muted-foreground">
                          retail
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-2 text-right text-xs font-medium">
                        {formatGhsCents(lineTotalCents(line))}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            className="!size-10 !min-h-10 !px-0 !py-0 border border-success/30 bg-success/10 text-success hover:bg-success/20 focus-visible:ring-2 focus-visible:ring-success/50"
                            aria-label={`Edit ${line.product.product_name}`}
                            title="Edit item"
                            onClick={() => editLine(line)}
                          >
                            <Pencil
                              aria-hidden="true"
                              className="size-5 text-success"
                              strokeWidth={2.5}
                            />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="!size-10 !min-h-10 !px-0 !py-0 border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-destructive/50"
                            aria-label={`Remove ${line.product.product_name}`}
                            title="Delete item"
                            onClick={() => {
                              setLines((current) =>
                                current.filter((item) => item.id !== line.id),
                              );
                              if (editingLineId === line.id) resetEntry();
                            }}
                          >
                            <Trash2
                              aria-hidden="true"
                              className="size-5 text-destructive"
                              strokeWidth={2.5}
                            />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Search for a product, enter its quantity and unit price, then add
              it to the sale.
            </div>
          )}
          {lines.map((line) => (
            <input
              key={line.id}
              type="hidden"
              name="variantId"
              value={line.variantId}
            />
          ))}
          {lines.map((line) => (
            <input
              key={line.id}
              type="hidden"
              name="quantity"
              value={line.quantity}
            />
          ))}
          {lines.map((line) => (
            <input
              key={line.id}
              type="hidden"
              name="unitPrice"
              value={
                canOverride && line.unitPrice !== line.standardPrice
                  ? line.unitPrice
                  : ""
              }
            />
          ))}
          <div className="border-t pt-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Items subtotal</span>
              <span>{formatGhsCents(itemsTotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span>
                {formatGhsCents(
                  totalCents < BigInt(0) ? BigInt(0) : totalCents,
                )}
              </span>
            </div>
          </div>
          <Label>
            Sale notes
            <textarea
              name="notes"
              className="mt-1 w-full rounded-lg border bg-surface p-3"
            />
          </Label>
          <p className="text-sm text-muted-foreground">
            Saving a draft does not reserve or reduce stock. Current stock is
            advisory and is checked again under lock at completion.
          </p>
          <Feedback state={state} />
          <Button disabled={pending || !lines.length}>
            {pending ? "Saving…" : "Save draft sale"}
          </Button>
        </Card>
        <Card className="order-1 space-y-4 p-4 sm:p-5 lg:sticky lg:top-4 lg:order-1">
          <div>
            <h2 className="text-lg font-semibold">Add an item</h2>
            <p className="text-sm text-muted-foreground">
              Select a product, enter its quantity and press Enter to add it at
              the retail price. If you change the unit price, press Enter there
              to add the item.
            </p>
          </div>
          <div
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.defaultPrevented) return;
              const target = event.target as HTMLElement;
              if (target.getAttribute("role") === "combobox") {
                event.preventDefault();
                return;
              }
              if (
                !target.matches(
                  "[name='entryQuantity'], [name='entryUnitPrice']",
                )
              )
                return;
              event.preventDefault();
              addLine();
            }}
          >
            <ProductLookup
              branches={branches.map((item) => ({
                id: item.id,
                name: item.label,
              }))}
              branchId={branchId}
              showBranchSelector={false}
              clearOnSelect
              onSelect={chooseProduct}
              title="Product"
              description="Search by item code or product name."
            />
            {product ? (
              <div className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm">
                <div className="font-medium">{product.product_name}</div>
                <div className="text-muted-foreground">
                  {product.variant_name} · {product.item_code} ·{" "}
                  {product.unit_symbol}
                  {product.product_type_name
                    ? ` · ${product.product_type_name}`
                    : ""}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {product.stock_status === "NOT_INITIALIZED"
                    ? "Stock not initialized"
                    : `${Number(product.quantity_on_hand ?? 0).toLocaleString()} ${product.unit_symbol} on hand`}
                </div>
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Label className="min-w-0">
                Quantity
                <Input
                  name="entryQuantity"
                  type="number"
                  min={product?.allows_decimal ? "0.001" : "1"}
                  step={product?.allows_decimal ? "0.001" : "1"}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={!product}
                />
              </Label>
              <Label className="min-w-0">
                Price per unit
                <Input
                  name="entryUnitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  disabled={!product || !canOverride}
                  readOnly={!canOverride}
                />
              </Label>
            </div>
            {entryError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {entryError}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={addLine} disabled={!product}>
                {editingLineId ? (
                  <>
                    <Pencil aria-hidden="true" className="size-4" />
                    Update item
                  </>
                ) : (
                  <>
                    <Plus aria-hidden="true" className="size-4" />
                    Add item
                  </>
                )}
              </Button>
              {editingLineId ? (
                <Button type="button" variant="secondary" onClick={resetEntry}>
                  <X aria-hidden="true" className="size-4" />
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </form>
  );
}
const Method = () => (
  <select
    name="method"
    className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
  >
    <option value="">No payment</option>
    <option>CASH</option>
    <option>MOBILE_MONEY</option>
    <option>BANK_TRANSFER</option>
    <option>CARD_POS</option>
    <option>OTHER</option>
  </select>
);
export function CompleteSaleForm({
  saleId,
  total,
  isWalkIn,
  canBackdate,
  accounts,
}: {
  saleId: string;
  total: string;
  isWalkIn: boolean;
  canBackdate: boolean;
  accounts: Option[];
}) {
  const [state, action, pending] = useActionState(completeSale, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="saleId" value={saleId} />
      <input type="hidden" name="operationId" value={crypto.randomUUID()} />
      <p className="sm:col-span-2">
        Total: <strong>GHS {Number(total).toFixed(2)}</strong>
        {isWalkIn
          ? " · Walk-In sales must be paid fully."
          : " · Enter zero for a credit sale."}
      </p>
      <Label>
        Payment now
        <Input
          name="amount"
          type="number"
          min="0"
          max={total}
          step="0.01"
          required
          defaultValue={isWalkIn ? total : "0"}
        />
      </Label>
      <Label>
        Payment method
        <Method />
      </Label>
      <Label className="sm:col-span-2">
        Deposit to account
        <select
          name="accountId"
          required={isWalkIn}
          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
        >
          <option value="">Select an account when taking payment</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label}
            </option>
          ))}
        </select>
      </Label>
      <Label>
        Payment reference
        <Input name="reference" />
      </Label>
      <Label>
        Payment notes
        <Input name="notes" />
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
      <p className="text-sm text-muted-foreground sm:col-span-2">
        Confirming deducts inventory immediately and generates the final
        receipt.
      </p>
      <Feedback state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Completing…" : "Complete sale"}
        </Button>
      </div>
    </form>
  );
}
export function CustomerPaymentForm({
  sale,
  canBackdate,
  accounts,
}: {
  sale: {
    saleId: string;
    customerId: string;
    branchId: string;
    balance: string;
  };
  canBackdate: boolean;
  accounts: Option[];
}) {
  const [state, action, pending] = useActionState(
    recordCustomerPayment,
    initial,
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="saleId" value={sale.saleId} />
      <input type="hidden" name="customerId" value={sale.customerId} />
      <input type="hidden" name="branchId" value={sale.branchId} />
      <input type="hidden" name="operationId" value={crypto.randomUUID()} />
      <p className="sm:col-span-2">
        Outstanding: <strong>GHS {Number(sale.balance).toFixed(2)}</strong>
      </p>
      <Label>
        Amount
        <Input
          name="amount"
          required
          type="number"
          min="0.01"
          max={sale.balance}
          step="0.01"
        />
      </Label>
      <Label>
        Method
        <Method />
      </Label>
      <Label>
        Deposit to account
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
        Reference
        <Input name="reference" />
      </Label>
      <Label>
        Notes
        <Input name="notes" />
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
      <Feedback state={state} />
      <div className="sm:col-span-2">
        <Button disabled={pending}>
          {pending ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
export function CancelSaleForm({ saleId }: { saleId: string }) {
  const [state, action, pending] = useActionState(cancelSale, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="saleId" value={saleId} />
      <Area name="reason" label="Cancellation reason" required />
      <Feedback state={state} />
      <Button variant="danger" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel erroneous sale"}
      </Button>
    </form>
  );
}
