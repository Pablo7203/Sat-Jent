"use server";
/**
 * Staff actions review online store requests; accepting one creates a draft sale for the existing sales workflow.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function updateStoreOrderRequest(formData: FormData) {
  const id = idSchema.safeParse(formData.get("id"));
  const status = z
    .enum(["CONTACTED", "DECLINED", "CANCELLED"])
    .safeParse(formData.get("status"));
  if (!id.success || !status.success)
    redirect("/app/store-orders?error=invalid");
  await requirePermission("store_orders.update");
  const db = await createClient();
  const { error } = await db.rpc("update_store_order_request_status", {
    target_request: id.data,
    new_status: status.data,
  });
  if (error) redirect(`/app/store-orders/${id.data}?error=update`);
  revalidatePath("/app/store-orders");
  revalidatePath(`/app/store-orders/${id.data}`);
  redirect(`/app/store-orders/${id.data}?updated=1`);
}

export async function acceptStoreOrderRequest(formData: FormData) {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/app/store-orders?error=invalid");
  await requirePermission("store_orders.confirm");
  const db = await createClient();
  const { data: saleId, error } = await db.rpc("accept_store_order_request", {
    target_request: id.data,
  });
  if (error || typeof saleId !== "string")
    redirect(`/app/store-orders/${id.data}?error=accept`);
  revalidatePath("/app/store-orders");
  revalidatePath(`/app/store-orders/${id.data}`);
  revalidatePath("/app/sales");
  redirect(`/app/store-orders/${id.data}?sale=${saleId}`);
}
