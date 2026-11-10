"use server";
/**
 * Purchasing actions manage suppliers, purchase orders, receipts, and supplier payments through database workflows.
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export type PurchasingState = { error?: string; success?: string };
const uuid = z.string().uuid();
const message = (raw: string) => {
  if (raw.includes("Future transaction dates"))
    return "Transaction dates cannot be in the future.";
  if (raw.includes("may backdate"))
    return "Only a Super Admin or Owner may use a previous transaction date.";
  if (raw.includes("remaining ordered"))
    return "You cannot receive more than the remaining ordered quantity.";
  if (raw.includes("Actual buying cost"))
    return "Enter the actual buying cost for every quantity received.";
  if (raw.includes("zero cost"))
    return "Add a short reason when goods are received at zero cost.";
  if (raw.includes("draft purchases"))
    return "Only a draft purchase order can be edited.";
  if (raw.includes("active product variant"))
    return "One of the selected product variants is no longer active.";
  if (raw.includes("Future transaction dates"))
    return "Transaction dates cannot be in the future.";
  if (raw.includes("may backdate"))
    return "Only a Super Admin or Owner may use a previous transaction date.";
  if (raw.includes("outstanding balance"))
    return "The payment amount exceeds the outstanding balance.";
  if (raw.includes("permission") || raw.includes("branch"))
    return "You do not have access to perform this action.";
  return raw.includes("duplicate key")
    ? "This operation was already recorded."
    : "The operation could not be completed. Check the values and try again.";
};
const text = (data: FormData, key: string) => String(data.get(key) ?? "");

export async function saveSupplier(
  _state: PurchasingState,
  data: FormData,
): Promise<PurchasingState> {
  const id = text(data, "id");
  await requirePermission(id ? "suppliers.update" : "suppliers.create");
  const s = await createClient();
  const args = {
    supplier_name: text(data, "name"),
    company: text(data, "company"),
    contact: text(data, "contact"),
    phone_number: text(data, "phone"),
    email_address: text(data, "email"),
    postal_address: text(data, "address"),
    supplier_notes: text(data, "notes"),
  };
  const result = id
    ? await s.rpc("update_supplier", { target_supplier: id, ...args })
    : await s.rpc("create_supplier", args);
  if (result.error) return { error: message(result.error.message) };
  const supplierId = id || result.data;
  revalidatePath("/app/suppliers");
  revalidatePath(`/app/suppliers/${supplierId}`);
  redirect(`/app/suppliers/${supplierId}`);
}
export async function toggleSupplier(data: FormData) {
  await requirePermission("suppliers.archive");
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const s = await createClient();
  await s.rpc("set_supplier_active", {
    target_supplier: id.data,
    new_active: text(data, "active") === "true",
  });
  revalidatePath(`/app/suppliers/${id.data}`);
}
export async function createPurchase(
  _state: PurchasingState,
  data: FormData,
): Promise<PurchasingState> {
  const purchaseId = text(data, "purchaseId");
  await requirePermission(purchaseId ? "purchases.update" : "purchases.create");
  const supplier = uuid.safeParse(data.get("supplierId")),
    branch = uuid.safeParse(data.get("branchId")),
    existingPurchase = purchaseId ? uuid.safeParse(purchaseId) : null;
  const intent = text(data, "intent"),
    isConfirming = intent === "ORDERED",
    variants = data.getAll("variantId").map(String),
    quantities = data.getAll("quantity").map(String),
    costs = data.getAll("unitCost").map(String),
    discounts = data.getAll("lineDiscount").map(String);
  if (
    variants.length !== quantities.length ||
    variants.length !== costs.length ||
    variants.length !== discounts.length
  )
    return { error: "Each purchase item needs a quantity and buying price." };
  if (!supplier.success || !branch.success)
    return { error: "Choose a supplier and receiving branch." };
  if (isConfirming && !variants.length)
    return {
      error:
        "Add at least one complete product line before confirming the purchase order.",
    };
  if (variants.some((variant) => !uuid.safeParse(variant).success))
    return { error: "Choose a valid product variant for every line." };
  const items = variants
    .map((variant_id, i) => ({
      variant_id,
      quantity: quantities[i],
      unit_cost: costs[i],
      discount_amount: discounts[i] || "0",
      notes: "",
    }))
    .filter(
      (item) => item.quantity.trim() !== "" && item.unit_cost.trim() !== "",
    );
  if (isConfirming && items.length !== variants.length)
    return {
      error:
        "Complete the quantity and buying price for every product before confirming.",
    };
  if (purchaseId && !existingPurchase?.success)
    return { error: "Invalid draft purchase order." };
  const s = await createClient();
  const { data: id, error } = await s.rpc("save_purchase_order", {
    target_purchase: existingPurchase?.success ? existingPurchase.data : null,
    target_supplier: supplier.data,
    target_branch: branch.data,
    purchase_on: text(data, "purchaseDate") || null,
    expected_on: text(data, "expectedDate") || null,
    supplier_invoice: text(data, "invoice"),
    purchase_notes: text(data, "notes"),
    purchase_discount: Number(text(data, "discount") || 0),
    purchase_other_costs: Number(text(data, "otherCosts") || 0),
    items,
    place_order: isConfirming,
  });
  if (error || !id) return { error: message(error?.message ?? "") };
  revalidatePath("/app/purchases");
  revalidatePath(`/app/purchases/${id}`);
  redirect(`/app/purchases/${id}`);
}
export async function orderPurchase(data: FormData) {
  await requirePermission("purchases.update");
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const s = await createClient();
  await s.rpc("order_purchase", { target_purchase: id.data });
  revalidatePath(`/app/purchases/${id.data}`);
}
export async function cancelPurchase(data: FormData) {
  await requirePermission("purchases.cancel");
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const s = await createClient();
  await s.rpc("cancel_purchase", { target_purchase: id.data });
  revalidatePath(`/app/purchases/${id.data}`);
}
export async function receivePurchase(
  _state: PurchasingState,
  data: FormData,
): Promise<PurchasingState> {
  await requirePermission("purchases.receive");
  const purchase = uuid.safeParse(data.get("purchaseId"));
  if (!purchase.success) return { error: "Invalid purchase." };
  const ids = data.getAll("itemId").map(String),
    quantities = data.getAll("quantity").map(String),
    costs = data.getAll("actualUnitCost").map(String),
    zeroCostReasons = data.getAll("zeroCostReason").map(String);
  if (ids.length !== quantities.length || ids.length !== costs.length)
    return {
      error: "Receipt line values do not match. Refresh and try again.",
    };
  const items = ids.map((purchase_item_id, i) => ({
    purchase_item_id,
    quantity: quantities[i],
    actual_unit_cost: costs[i],
    zero_cost_reason: zeroCostReasons[i] || "",
  }));
  const priceVariants = data.getAll("priceUpdateVariantId").map(String),
    priceAmounts = data.getAll("priceUpdateAmount").map(String),
    priceScopes = data.getAll("priceUpdateScope").map(String);
  if (
    priceVariants.length !== priceAmounts.length ||
    priceVariants.length !== priceScopes.length
  )
    return { error: "Selling price changes are incomplete." };
  const priceChanges = priceVariants.map((variant_id, i) => ({
    variant_id,
    amount: priceAmounts[i],
    scope: priceScopes[i],
  }));
  if (priceChanges.length) await requirePermission("product_prices.manage");
  const s = await createClient();
  const { error } = await s.rpc("post_goods_receipt", {
    target_purchase: purchase.data,
    operation_id: text(data, "operationId") || randomUUID(),
    delivery_reference: text(data, "deliveryReference"),
    receipt_notes: text(data, "notes"),
    receipt_on: text(data, "receiptDate") || null,
    items,
    price_changes: priceChanges,
  });
  if (error) return { error: message(error.message) };
  revalidatePath("/app/purchases");
  revalidatePath(`/app/purchases/${purchase.data}`);
  revalidatePath(`/app/purchases/${purchase.data}/receive`);
  revalidatePath("/app/suppliers");
  revalidatePath("/app/inventory", "layout");
  redirect(`/app/purchases/${purchase.data}`);
}
export async function recordPayment(
  _state: PurchasingState,
  data: FormData,
): Promise<PurchasingState> {
  await requirePermission("supplier_payments.create");
  const supplier = uuid.safeParse(data.get("supplierId")),
    purchase = uuid.safeParse(data.get("purchaseId")),
    branch = uuid.safeParse(data.get("branchId"));
  if (!supplier.success || !purchase.success || !branch.success)
    return { error: "Invalid payment context." };
  const s = await createClient();
  const { error } = await s.rpc("record_supplier_payment_with_account", {
    target_supplier: supplier.data,
    target_purchase: purchase.data,
    target_branch: branch.data,
    operation_id: text(data, "operationId") || randomUUID(),
    payment_amount: Number(text(data, "amount")),
    method: text(data, "method"),
    reference: text(data, "reference"),
    payment_on: text(data, "paymentDate") || null,
    payment_notes: text(data, "notes"),
    target_account: text(data, "accountId"),
  });
  if (error) return { error: message(error.message) };
  revalidatePath(`/app/purchases/${purchase.data}`);
  return { success: "Supplier payment recorded." };
}
