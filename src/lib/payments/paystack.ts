/**
 * Server-only Paystack verification. Order totals are compared against the
 * pesewa amount saved before redirecting the customer to hosted checkout.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequiredPaystackSecretKey } from "@/lib/env/server";
import { sendCustomerOrderEmail } from "@/lib/email/customer-order-notifications";

type PaymentAttempt = {
  id: string;
  order_id: string;
  amount_pesewas: number | string;
  status: string;
};

export type PaystackVerification = {
  paid: boolean;
  orderId: string;
  orderNumber: string;
};

export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackVerification | null> {
  const admin = createAdminClient();
  const { data: attemptData, error: attemptError } = await admin
    .from("store_order_payment_attempts")
    .select("id,order_id,amount_pesewas,status")
    .eq("reference", reference)
    .maybeSingle();

  if (attemptError || !attemptData) return null;
  const attempt = attemptData as PaymentAttempt;

  const { data: orderData, error: orderError } = await admin
    .from("store_order_requests")
    .select(
      "request_number,order_kind,payment_method,payment_status,customer_name,customer_email,estimated_total,fulfillment_method",
    )
    .eq("id", attempt.order_id)
    .maybeSingle();

  if (orderError || !orderData) return null;
  const order = orderData as {
    request_number: string;
    order_kind: string;
    payment_method: string | null;
    payment_status: string;
    customer_name: string;
    customer_email: string | null;
    estimated_total: number | string | null;
    fulfillment_method: "PICKUP" | "DELIVERY" | null;
  };

  if (order.order_kind !== "CHECKOUT" || order.payment_method !== "PAYSTACK") {
    return null;
  }

  if (attempt.status === "PAID" && order.payment_status === "PAID") {
    return {
      paid: true,
      orderId: attempt.order_id,
      orderNumber: order.request_number,
    };
  }

  const secretKey = getRequiredPaystackSecretKey();
  const response = await fetch(
    "https://api.paystack.co/transaction/verify/" +
      encodeURIComponent(reference),
    {
      method: "GET",
      headers: { Authorization: "Bearer " + secretKey },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) {
    throw new Error("Paystack could not verify the transaction.");
  }

  const result = (await response.json()) as {
    status?: boolean;
    data?: {
      id?: number | string;
      reference?: string;
      status?: string;
      amount?: number;
      currency?: string;
    };
  };

  const transaction = result.data;
  if (
    result.status === true &&
    transaction?.reference === reference &&
    ["failed", "abandoned"].includes(transaction.status ?? "")
  ) {
    await admin
      .from("store_order_payment_attempts")
      .update({ status: "FAILED" })
      .eq("reference", reference)
      .neq("status", "PAID");
    return {
      paid: false,
      orderId: attempt.order_id,
      orderNumber: order.request_number,
    };
  }

  if (
    result.status !== true ||
    !transaction ||
    transaction.reference !== reference ||
    transaction.status !== "success" ||
    transaction.currency !== "GHS" ||
    Number(transaction.amount) !== Number(attempt.amount_pesewas) ||
    transaction.id == null
  ) {
    return {
      paid: false,
      orderId: attempt.order_id,
      orderNumber: order.request_number,
    };
  }

  const { error: confirmError } = await admin.rpc(
    "confirm_store_order_payment",
    {
      target_reference: reference,
      transaction_id: String(transaction.id),
    },
  );

  if (confirmError) {
    throw new Error("The verified payment could not be recorded.");
  }

  if (order.customer_email && order.fulfillment_method) {
    await sendCustomerOrderEmail({
      kind: "payment-confirmed",
      orderId: attempt.order_id,
      to: order.customer_email,
      customerName: order.customer_name,
      orderNumber: order.request_number,
      total: order.estimated_total ?? Number(attempt.amount_pesewas) / 100,
      paymentMethod: "PAYSTACK",
      paymentStatus: "PAID",
      fulfillmentMethod: order.fulfillment_method,
    });
  }

  return {
    paid: true,
    orderId: attempt.order_id,
    orderNumber: order.request_number,
  };
}
