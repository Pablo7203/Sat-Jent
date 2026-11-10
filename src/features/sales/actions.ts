"use server";
/**
 * Sales actions keep draft creation, completion, payments, reversals, and cancellations as separate business operations.
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export type SalesState = { error?: string; success?: string };
const uuid = z.string().uuid();
const text = (d: FormData, k: string) => String(d.get(k) ?? "");
const friendly = (raw: string) => {
  if (raw.includes("Future transaction dates"))
    return "Transaction dates cannot be in the future.";
  if (raw.includes("may backdate"))
    return "Only a Super Admin or Owner may use a previous transaction date.";
  if (raw.includes("not enough stock"))
    return "There is not enough stock at this branch to complete the sale.";
  if (raw.includes("named customer"))
    return "A named customer is required for a credit sale.";
  if (
    raw.includes("exceeds the outstanding") ||
    raw.includes("exceeds the outstanding balance") ||
    raw.includes("payment exceeds")
  )
    return "The payment exceeds the outstanding balance.";
  if (raw.includes("override this price"))
    return "You do not have permission to override this price.";
  if (raw.includes("posted payments"))
    return "Reverse the posted payments before cancelling this sale.";
  if (raw.includes("permission") || raw.includes("access"))
    return "You do not have access to perform this action.";
  return "The operation could not be completed. Check the values and try again.";
};
export async function saveCustomer(
  _s: SalesState,
  d: FormData,
): Promise<SalesState> {
  const id = text(d, "id");
  await requirePermission(id ? "customers.update" : "customers.create");
  const client = await createClient();
  const args = {
    customer_name: text(d, "name"),
    kind: text(d, "type"),
    company: text(d, "company"),
    phone_number: text(d, "phone"),
    email_address: text(d, "email"),
    postal_address: text(d, "address"),
    customer_notes: text(d, "notes"),
  };
  const result = id
    ? await client.rpc("update_customer", { target_customer: id, ...args })
    : await client.rpc("create_customer", args);
  if (result.error) return { error: friendly(result.error.message) };
  const customerId = id || result.data;
  revalidatePath("/app/customers");
  revalidatePath(`/app/customers/${customerId}`);
  redirect(`/app/customers/${customerId}`);
}
export async function toggleCustomer(d: FormData) {
  await requirePermission("customers.archive");
  const id = uuid.safeParse(d.get("id"));
  if (!id.success) return;
  const client = await createClient();
  await client.rpc("set_customer_active", {
    target_customer: id.data,
    new_active: text(d, "active") === "true",
  });
  revalidatePath(`/app/customers/${id.data}`);
}
export async function createSale(
  _s: SalesState,
  d: FormData,
): Promise<SalesState> {
  await requirePermission("sales.create");
  const branch = uuid.safeParse(d.get("branchId")),
    customer = uuid.safeParse(d.get("customerId"));
  const variants = d.getAll("variantId").map(String),
    quantities = d.getAll("quantity").map(String),
    prices = d.getAll("unitPrice").map(String);
  const items = variants
    .map((variant_id, i) => {
      const item: Record<string, string> = {
        variant_id,
        quantity: quantities[i],
        price_type: "RETAIL",
        discount_amount: "0",
      };
      if (prices[i] !== "") item.unit_price = prices[i];
      return item;
    })
    .filter(
      (x) => uuid.safeParse(x.variant_id).success && Number(x.quantity) > 0,
    );
  if (!branch.success || !customer.success || !items.length)
    return { error: "Choose a branch, customer, and at least one item." };
  const client = await createClient();
  const { data: customerRecord } = await client
    .from("customers")
    .select("is_walk_in")
    .eq("id", customer.data)
    .maybeSingle();
  const { data: id, error } = await client.rpc("create_sale", {
    target_branch: branch.data,
    target_customer: customer.data,
    sale_on: text(d, "saleDate") || null,
    due_on: customerRecord?.is_walk_in ? null : text(d, "dueDate") || null,
    sale_notes: text(d, "notes"),
    sale_discount: 0,
    discount_reason: "",
    items,
  });
  if (error || !id) return { error: friendly(error?.message ?? "") };
  redirect(`/app/sales/${id}`);
}
export async function completeSale(
  _s: SalesState,
  d: FormData,
): Promise<SalesState> {
  await requirePermission("sales.complete");
  const id = uuid.safeParse(d.get("saleId"));
  if (!id.success) return { error: "Invalid sale." };
  const client = await createClient();
  const { error } = await client.rpc("complete_sale_with_account", {
    target_sale: id.data,
    operation_id: text(d, "operationId") || randomUUID(),
    initial_payment: Number(text(d, "amount") || 0),
    method: text(d, "method") || null,
    payment_reference: text(d, "reference"),
    payment_notes: text(d, "notes"),
    payment_on: text(d, "paymentDate") || null,
    target_account: text(d, "accountId") || null,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/app", "layout");
  return { success: "Sale completed and receipt generated." };
}
export async function recordCustomerPayment(
  _s: SalesState,
  d: FormData,
): Promise<SalesState> {
  await requirePermission("customer_payments.create");
  const sale = uuid.safeParse(d.get("saleId")),
    customer = uuid.safeParse(d.get("customerId")),
    branch = uuid.safeParse(d.get("branchId"));
  if (!sale.success || !customer.success || !branch.success)
    return { error: "Invalid payment context." };
  const client = await createClient();
  const { error } = await client.rpc("record_customer_payment_with_account", {
    target_customer: customer.data,
    target_sale: sale.data,
    target_branch: branch.data,
    operation_id: text(d, "operationId") || randomUUID(),
    payment_amount: Number(text(d, "amount")),
    method: text(d, "method"),
    reference: text(d, "reference"),
    payment_on: text(d, "paymentDate") || new Date().toISOString(),
    payment_notes: text(d, "notes"),
    target_account: text(d, "accountId"),
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/app/sales/${sale.data}`);
  return { success: "Customer payment recorded." };
}
export async function reversePayment(d: FormData) {
  await requirePermission("customer_payments.reverse");
  const id = uuid.safeParse(d.get("paymentId")),
    sale = uuid.safeParse(d.get("saleId"));
  if (!id.success) return;
  const client = await createClient();
  await client.rpc("reverse_customer_payment", {
    target_payment: id.data,
    reason: text(d, "reason"),
  });
  if (sale.success) revalidatePath(`/app/sales/${sale.data}`);
}
export async function cancelSale(
  _s: SalesState,
  d: FormData,
): Promise<SalesState> {
  await requirePermission("sales.cancel");
  const id = uuid.safeParse(d.get("saleId"));
  if (!id.success) return { error: "Invalid sale." };
  const client = await createClient();
  const { error } = await client.rpc("cancel_sale", {
    target_sale: id.data,
    reason: text(d, "reason"),
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/app/sales/${id.data}`);
  return { success: "Sale cancelled and inventory restored where applicable." };
}
