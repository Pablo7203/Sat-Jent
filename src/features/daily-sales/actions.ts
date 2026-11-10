"use server";
/**
 * Daily-sales actions save, post, and reverse batches through database workflows that keep totals consistent.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export type DailySalesState = { error?: string };

const uuid = z.string().uuid();
const value = (data: FormData, key: string) => String(data.get(key) ?? "");

function friendlyError(raw: string) {
  if (raw.includes("Insufficient stock")) return raw;
  if (raw.includes("Future transaction dates"))
    return "Sales dates cannot be in the future.";
  if (raw.includes("may backdate"))
    return "Only a Super Admin or Owner may enter a previous sales date.";
  if (raw.includes("override this selling price"))
    return "You do not have permission to use a negotiated price on this line.";
  if (raw.includes("posted batch already exists")) return raw;
  if (raw.includes("permission") || raw.includes("access"))
    return "You do not have access to perform this action.";
  return raw.length < 220
    ? raw
    : "The daily sales batch could not be saved. Check the values and try again.";
}

export async function saveDailySalesDraft(
  _state: DailySalesState,
  data: FormData,
): Promise<DailySalesState> {
  const batchId = value(data, "batchId");
  await requirePermission(
    batchId ? "daily_sales.update_draft" : "daily_sales.create",
  );
  const branchId = uuid.safeParse(data.get("branchId"));
  const correctionRaw = value(data, "correctionOfBatchId");
  const correctionOf = correctionRaw ? uuid.safeParse(correctionRaw) : null;
  const batch = batchId ? uuid.safeParse(batchId) : null;
  const salesDate = value(data, "salesDate");
  const kind = value(data, "entryKind") || "STANDARD";
  const reason = value(data, "entryReason");
  const variants = data.getAll("variantId").map(String);
  const quantities = data.getAll("quantity").map(String);
  const prices = data.getAll("actualUnitPrice").map(String);
  if (
    !branchId.success ||
    !/^\d{4}-\d{2}-\d{2}$/.test(salesDate) ||
    (batch && !batch.success) ||
    (correctionOf && !correctionOf.success) ||
    variants.length !== quantities.length ||
    variants.length !== prices.length
  ) {
    return { error: "Check the branch, sales date, and product line values." };
  }
  const items: {
    variant_id: string;
    quantity: string;
    actual_unit_selling_price: string;
  }[] = [];
  for (let index = 0; index < variants.length; index += 1) {
    const variant = uuid.safeParse(variants[index]);
    if (!variant.success || !quantities[index] || !prices[index])
      return {
        error:
          "Every product line needs a valid quantity and actual selling price.",
      };
    items.push({
      variant_id: variant.data,
      quantity: quantities[index],
      actual_unit_selling_price: prices[index],
    });
  }

  const client = await createClient();
  const { data: id, error } = await client.rpc("save_daily_sales_draft", {
    target_batch: batch?.success ? batch.data : null,
    target_branch: branchId.data,
    target_sales_date: salesDate,
    target_notes: value(data, "notes"),
    target_entry_kind: kind,
    target_entry_reason: reason,
    target_correction_of: correctionOf?.success ? correctionOf.data : null,
    items,
  });
  if (error || !id)
    return {
      error: friendlyError(error?.message ?? "The draft could not be saved."),
    };
  revalidatePath("/app/daily-sales");
  revalidatePath(`/app/daily-sales/${id}`);
  redirect(`/app/daily-sales/${id}`);
}

export async function postDailySalesBatch(
  _state: DailySalesState,
  data: FormData,
): Promise<DailySalesState> {
  await requirePermission("daily_sales.post");
  const id = uuid.safeParse(data.get("batchId"));
  if (!id.success) return { error: "Invalid daily sales batch." };
  const client = await createClient();
  const { error } = await client.rpc("post_daily_sales_batch", {
    target_batch: id.data,
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/app", "layout");
  revalidatePath("/app/daily-sales");
  revalidatePath(`/app/daily-sales/${id.data}`);
  revalidatePath("/app/inventory", "layout");
  revalidatePath("/app/reports", "layout");
  redirect(`/app/daily-sales/${id.data}`);
}

export async function reverseDailySalesBatch(
  _state: DailySalesState,
  data: FormData,
): Promise<DailySalesState> {
  await requirePermission("daily_sales.reverse");
  const id = uuid.safeParse(data.get("batchId"));
  const reason = value(data, "reason").trim();
  if (!id.success || reason.length < 3)
    return { error: "Enter a correction reason of at least three characters." };
  const client = await createClient();
  const { error } = await client.rpc("reverse_daily_sales_batch", {
    target_batch: id.data,
    correction_reason: reason,
  });
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/app", "layout");
  revalidatePath("/app/daily-sales");
  revalidatePath(`/app/daily-sales/${id.data}`);
  revalidatePath("/app/inventory", "layout");
  revalidatePath("/app/reports", "layout");
  redirect(`/app/daily-sales/${id.data}`);
}
