"use server";
/**
 * Inventory actions handle opening stock, adjustments, counts, and minimum levels through transactional database functions.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
export type InventoryActionState = { success: boolean; message?: string };
const initialError = (message: string): InventoryActionState => ({
  success: false,
  message,
});
const uuid = z.string().uuid();
const friendly = (message: string) =>
  message.includes("enough stock")
    ? "There is not enough stock to complete this operation."
    : message.includes("already been posted")
      ? "Opening stock has already been posted for this item at this branch."
      : message.includes("permission")
        ? "You do not have permission to manage inventory for this branch."
        : message;

export async function postOpeningStock(
  _state: InventoryActionState,
  data: FormData,
): Promise<InventoryActionState> {
  await requirePermission("inventory.opening_stock");
  const branch = uuid.safeParse(data.get("branchId"));
  if (!branch.success) return initialError("Choose a branch.");
  const variants = data.getAll("variantId").map(String),
    quantities = data.getAll("quantity").map(String),
    minimums = data.getAll("minimum").map(String);
  const items = variants
    .map((variant_id, index) => ({
      variant_id,
      quantity: quantities[index],
      minimum_stock_level: minimums[index] || "0",
    }))
    .filter((x) => x.variant_id && x.quantity !== "");
  if (!items.length) return initialError("Enter at least one quantity.");
  const s = await createClient();
  const { error } = await s.rpc("post_opening_stock_batch", {
    target_branch: branch.data,
    items,
    operation_notes: String(data.get("notes") ?? ""),
  });
  if (error) return initialError(friendly(error.message));
  revalidatePath("/app/inventory", "layout");
  return {
    success: true,
    message: `Posted opening stock for ${items.length} item(s).`,
  };
}
export async function createAdjustment(
  _state: InventoryActionState,
  data: FormData,
): Promise<InventoryActionState> {
  await requirePermission("inventory.adjust");
  const branch = uuid.safeParse(data.get("branchId")),
    reason = uuid.safeParse(data.get("reasonId"));
  const variants = data.getAll("variantId").map(String),
    quantities = data.getAll("quantity").map(Number),
    directions = data.getAll("direction").map(String);
  const items = variants
    .map((variant_id, index) => ({
      variant_id,
      quantity: quantities[index],
      direction: directions[index],
      notes: "",
    }))
    .filter((x) => uuid.safeParse(x.variant_id).success && x.quantity > 0);
  if (!branch.success || !reason.success || !items.length)
    return initialError("Complete all adjustment fields.");
  const s = await createClient();
  const { data: id, error } = await s.rpc("create_stock_adjustment", {
    target_branch: branch.data,
    target_reason: reason.data,
    target_notes: String(data.get("notes") ?? ""),
    items,
  });
  if (error || !id)
    return initialError(
      friendly(error?.message ?? "Adjustment could not be created."),
    );
  redirect(`/app/inventory/adjustments/${id}`);
}
export async function completeAdjustment(data: FormData) {
  await requirePermission("inventory.adjust");
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const s = await createClient();
  await s.rpc("complete_stock_adjustment", { target_adjustment: id.data });
  revalidatePath("/app/inventory", "layout");
}
export async function cancelAdjustment(data: FormData) {
  await requirePermission("inventory.adjust");
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const s = await createClient();
  await s.rpc("cancel_stock_adjustment", { target_adjustment: id.data });
  revalidatePath("/app/inventory/adjustments", "layout");
}
export async function createCount(
  _state: InventoryActionState,
  data: FormData,
): Promise<InventoryActionState> {
  await requirePermission("inventory.count");
  const branch = uuid.safeParse(data.get("branchId"));
  const variants = data
    .getAll("variantIds")
    .map(String)
    .filter((x) => uuid.safeParse(x).success);
  if (!branch.success || !variants.length)
    return initialError("Choose a branch and at least one variant.");
  const s = await createClient();
  const { data: id, error } = await s.rpc("create_stock_count", {
    target_branch: branch.data,
    target_notes: String(data.get("notes") ?? ""),
    variant_ids: variants,
  });
  if (error || !id)
    return initialError(
      friendly(error?.message ?? "Count could not be created."),
    );
  redirect(`/app/inventory/counts/${id}`);
}
export async function startCount(data: FormData) {
  await requirePermission("inventory.count");
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const s = await createClient();
  await s.rpc("start_stock_count", { target_count: id.data });
  revalidatePath(`/app/inventory/counts/${id.data}`);
}
export async function saveCountQuantity(data: FormData) {
  await requirePermission("inventory.count");
  const item = uuid.safeParse(data.get("itemId"));
  const quantity = Number(data.get("quantity"));
  if (!item.success || quantity < 0) return;
  const s = await createClient();
  await s.rpc("set_stock_count_quantity", {
    target_item: item.data,
    physical_quantity: quantity,
    item_notes: String(data.get("notes") ?? ""),
  });
  revalidatePath("/app/inventory/counts", "layout");
}
export async function completeCount(data: FormData) {
  await requirePermission("inventory.count");
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const s = await createClient();
  await s.rpc("complete_stock_count", { target_count: id.data });
  revalidatePath("/app/inventory", "layout");
}
export async function cancelCount(data: FormData) {
  await requirePermission("inventory.count");
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const s = await createClient();
  await s.rpc("cancel_stock_count", { target_count: id.data });
  revalidatePath("/app/inventory/counts", "layout");
}
export async function setMinimum(data: FormData) {
  await requirePermission("inventory.settings.manage");
  const branch = uuid.safeParse(data.get("branchId")),
    variant = uuid.safeParse(data.get("variantId"));
  const level = Number(data.get("level"));
  if (!branch.success || !variant.success || level < 0) return;
  const s = await createClient();
  await s.rpc("set_minimum_stock_level", {
    target_branch: branch.data,
    target_variant: variant.data,
    new_level: level,
  });
  revalidatePath("/app/inventory", "layout");
}
