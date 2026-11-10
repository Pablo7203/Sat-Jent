"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAdjustment,
  createCount,
  postOpeningStock,
  type InventoryActionState,
} from "./actions";
const initial: InventoryActionState = { success: false };
const Select = ({
  name,
  label,
  children,
}: {
  name: string;
  label: string;
  children: React.ReactNode;
}) => (
  <Label>
    {label}
    <select
      name={name}
      required
      className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
    >
      {children}
    </select>
  </Label>
);
export function OpeningStockForm({
  branches,
  variants,
}: {
  branches: { id: string; name: string }[];
  variants: { id: string; label: string; allowsDecimal: boolean }[];
}) {
  const [state, action, pending] = useActionState(postOpeningStock, initial);
  return (
    <form action={action} className="space-y-4">
      <Select name="branchId" label="Branch">
        {branches.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="grid gap-2 sm:grid-cols-3" key={i}>
            <select
              aria-label={`Variant ${i + 1}`}
              name="variantId"
              className="min-h-11 rounded-lg border bg-surface px-3"
            >
              <option value="">Choose product variant</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Quantity ${i + 1}`}
              name="quantity"
              type="number"
              min="0"
              step="0.001"
              placeholder="Quantity"
            />
            <Input
              aria-label={`Minimum ${i + 1}`}
              name="minimum"
              type="number"
              min="0"
              step="0.001"
              placeholder="Minimum stock"
            />
          </div>
        ))}
      </div>
      <Label>
        Confirmation note
        <textarea
          name="notes"
          required
          className="mt-1 w-full rounded-lg border bg-surface p-3"
          placeholder="I confirm these are the physical opening balances."
        />
      </Label>
      {state.message ? (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      ) : null}
      <Button disabled={pending}>
        {pending ? "Posting…" : "Confirm and post opening stock"}
      </Button>
    </form>
  );
}
export function AdjustmentForm({
  branches,
  reasons,
  variants,
}: {
  branches: { id: string; name: string }[];
  reasons: { id: string; name: string; direction: string }[];
  variants: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(createAdjustment, initial);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Select name="branchId" label="Branch">
        {branches.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Select name="reasonId" label="Reason">
        {reasons.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name} ({x.direction})
          </option>
        ))}
      </Select>
      <div className="space-y-2 sm:col-span-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-3">
            <select
              aria-label={`Adjustment variant ${i + 1}`}
              name="variantId"
              className="min-h-11 rounded-lg border bg-surface px-3"
            >
              <option value="">Choose variant</option>
              {variants.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
            <select
              aria-label={`Adjustment direction ${i + 1}`}
              name="direction"
              className="min-h-11 rounded-lg border bg-surface px-3"
            >
              <option>DECREASE</option>
              <option>INCREASE</option>
            </select>
            <Input
              aria-label={`Adjustment quantity ${i + 1}`}
              name="quantity"
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Quantity"
            />
          </div>
        ))}
      </div>
      <Label>
        Notes
        <textarea
          name="notes"
          className="mt-1 w-full rounded-lg border bg-surface p-3"
        />
      </Label>
      <div className="sm:col-span-2">
        {state.message ? (
          <p role="status" className="mb-2 text-sm">
            {state.message}
          </p>
        ) : null}
        <Button disabled={pending}>Create draft adjustment</Button>
      </div>
    </form>
  );
}
export function CountForm({
  branches,
  variants,
}: {
  branches: { id: string; name: string }[];
  variants: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(createCount, initial);
  return (
    <form action={action} className="space-y-4">
      <Select name="branchId" label="Branch">
        {branches.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <fieldset>
        <legend className="font-semibold">Variants to count</legend>
        <div className="mt-2 max-h-80 space-y-2 overflow-auto">
          {variants.map((v) => (
            <label
              className="flex items-center gap-2 rounded-lg border p-3"
              key={v.id}
            >
              <input type="checkbox" name="variantIds" value={v.id} />
              {v.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Label>
        Notes
        <textarea
          name="notes"
          className="mt-1 w-full rounded-lg border bg-surface p-3"
        />
      </Label>
      {state.message ? (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      ) : null}
      <Button disabled={pending}>Create draft count</Button>
    </form>
  );
}
