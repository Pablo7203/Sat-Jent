"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTransfer, type TransferState } from "./actions";

type Option = { id: string; label: string };
type DraftItem = {
  variant_id: string;
  requested_quantity: number;
  notes: string | null;
};
export function TransferForm({
  branches,
  variants,
  transfer,
  items = [],
}: {
  branches: Option[];
  variants: Option[];
  transfer?: {
    id: string;
    source_branch_id: string;
    destination_branch_id: string;
    notes: string | null;
  };
  items?: DraftItem[];
}) {
  const [state, action, pending] = useActionState<TransferState, FormData>(
    saveTransfer,
    {},
  );
  return (
    <form action={action} className="space-y-5">
      {transfer ? <input type="hidden" name="id" value={transfer.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Label>
          Source branch
          <select
            name="sourceBranchId"
            required
            defaultValue={transfer?.source_branch_id}
            className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
          >
            <option value="">Choose source</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.label}
              </option>
            ))}
          </select>
        </Label>
        <Label>
          Destination branch
          <select
            name="destinationBranchId"
            required
            defaultValue={transfer?.destination_branch_id}
            className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
          >
            <option value="">Choose destination</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.label}
              </option>
            ))}
          </select>
        </Label>
      </div>
      <fieldset className="space-y-2">
        <legend className="font-semibold">Transfer items</legend>
        {[0, 1, 2, 3, 4].map((index) => (
          <div className="grid gap-2 sm:grid-cols-3" key={index}>
            <select
              aria-label={`Product variant ${index + 1}`}
              name="variantId"
              defaultValue={items[index]?.variant_id ?? ""}
              className="min-h-11 rounded-lg border bg-surface px-3"
            >
              <option value="">Choose variant</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Quantity ${index + 1}`}
              name="quantity"
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Quantity"
              defaultValue={items[index]?.requested_quantity}
            />
            <Input
              aria-label={`Item notes ${index + 1}`}
              name="itemNotes"
              placeholder="Item note (optional)"
              defaultValue={items[index]?.notes ?? ""}
            />
          </div>
        ))}
      </fieldset>
      <Label>
        Notes
        <textarea
          name="notes"
          defaultValue={transfer?.notes ?? ""}
          className="mt-1 w-full rounded-lg border bg-surface p-3"
        />
      </Label>
      <p className="text-sm text-muted-foreground">
        Drafts and requests have no inventory effect. Source stock changes only
        at dispatch; destination stock changes only at receipt.
      </p>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button name="intent" value="draft" disabled={pending}>
          {pending ? "Saving…" : "Save draft"}
        </Button>
        {!transfer ? (
          <Button
            name="intent"
            value="submit"
            variant="secondary"
            disabled={pending}
          >
            Save and submit request
          </Button>
        ) : null}
      </div>
    </form>
  );
}
