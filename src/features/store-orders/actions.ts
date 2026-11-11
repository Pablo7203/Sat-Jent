"use server";
/**
 * Staff actions review enquiry requests and advance paid or cash-on-delivery
 * checkout orders through their permitted fulfilment steps.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { sendCustomerOrderEmail } from "@/lib/email/customer-order-notifications";

const idSchema = z.string().uuid();

export async function updateStoreOrderRequest(formData: FormData) {
  const id = idSchema.safeParse(formData.get("id"));
  const status = z
    .enum(["CONTACTED", "DECLINED", "CANCELLED"])
    .safeParse(formData.get("status"));
  if (!id.success || !status.success) {
    redirect("/app/store-orders?error=invalid");
  }

  await requirePermission("store_orders.update");
  const db = await createClient();
  const { error } = await db.rpc("update_store_order_request_status", {
    target_request: id.data,
    new_status: status.data,
  });

  if (error) redirect("/app/store-orders/" + id.data + "?error=update");
  revalidatePath("/app/store-orders");
  revalidatePath("/app/store-orders/" + id.data);
  redirect("/app/store-orders/" + id.data + "?updated=1");
}

export async function updateStoreOrderFulfillment(formData: FormData) {
  const id = idSchema.safeParse(formData.get("id"));
  const status = z
    .enum([
      "PREPARING",
      "READY_FOR_PICKUP",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
    ])
    .safeParse(formData.get("status"));
  const cashCollected = formData.get("cashCollected") === "true";

  if (!id.success || !status.success) {
    redirect("/app/store-orders?error=invalid");
  }

  await requirePermission("store_orders.update");
  const db = await createClient();
  const { data: order } = await db
    .from("store_order_requests")
    .select(
      "request_number,order_kind,customer_name,customer_email,estimated_total,payment_method,payment_status,fulfillment_method,fulfillment_status",
    )
    .eq("id", id.data)
    .maybeSingle();
  const { error } = await db.rpc("update_store_checkout_fulfillment", {
    target_order: id.data,
    target_status: status.data,
    cash_collected: cashCollected,
  });

  if (error) {
    redirect("/app/store-orders/" + id.data + "?error=fulfillment");
  }

  if (
    order?.order_kind === "CHECKOUT" &&
    order.customer_email &&
    order.fulfillment_status !== status.data
  ) {
    await sendCustomerOrderEmail({
      kind: "fulfillment-update",
      orderId: id.data,
      to: order.customer_email,
      customerName: order.customer_name,
      orderNumber: order.request_number,
      total: order.estimated_total,
      paymentMethod:
        order.payment_method === "PAYSTACK" ? "PAYSTACK" : "PAY_ON_DELIVERY",
      paymentStatus:
        cashCollected && status.data === "DELIVERED"
          ? "PAID"
          : order.payment_status === "PAID"
            ? "PAID"
            : "PENDING",
      fulfillmentMethod:
        order.fulfillment_method === "DELIVERY" ? "DELIVERY" : "PICKUP",
      status: status.data,
    });
  }

  revalidatePath("/app/store-orders");
  revalidatePath("/app/store-orders/" + id.data);
  redirect("/app/store-orders/" + id.data + "?updated=1");
}

export async function acceptStoreOrderRequest(formData: FormData) {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) redirect("/app/store-orders?error=invalid");

  await requirePermission("store_orders.confirm");
  const db = await createClient();
  const { data: saleId, error } = await db.rpc("accept_store_order_request", {
    target_request: id.data,
  });

  if (error || typeof saleId !== "string") {
    redirect("/app/store-orders/" + id.data + "?error=accept");
  }

  revalidatePath("/app/store-orders");
  revalidatePath("/app/store-orders/" + id.data);
  revalidatePath("/app/sales");
  redirect("/app/store-orders/" + id.data + "?sale=" + saleId);
}
