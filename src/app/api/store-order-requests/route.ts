/**
 * Validates public checkout input, recalculates the order in Supabase, and
 * initializes Paystack only from this server route.
 */

import { createHash, createHmac, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRequiredPaystackSecretKey,
  getRequiredServiceRoleKey,
} from "@/lib/env/server";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";
import { publicSiteUrlForRequest } from "@/lib/env/site-url";

const checkoutSchema = z.object({
  idempotencyKey: z.string().uuid(),
  trackingToken: z.string().regex(/^[a-f0-9]{64}$/),
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(5).max(40),
  email: z.string().trim().email().max(254).or(z.literal("")),
  company: z.string().trim().max(160),
  branchId: z.string().uuid(),
  message: z.string().trim().max(2000),
  fulfillmentMethod: z.enum(["PICKUP", "DELIVERY"]),
  paymentMethod: z.enum(["PAY_ON_DELIVERY", "PAYSTACK"]),
  deliveryAddress: z.string().trim().max(1000),
  deliveryInstructions: z.string().trim().max(1000),
  website: z.string().max(0),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z
          .number()
          .positive()
          .max(100000)
          .refine(
            (quantity) => Number(quantity.toFixed(3)) === quantity,
            "Quantities can use up to three decimal places.",
          ),
      }),
    )
    .min(1)
    .max(20)
    .refine(
      (items) =>
        new Set(items.map((item) => item.variantId)).size === items.length,
      "Remove duplicate products.",
    ),
});

export const runtime = "nodejs";

function toPesewas(value: number | string): number | null {
  const amount = String(value).trim();
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(amount)) return null;
  const [whole, fraction = ""] = amount.split(".");
  const minor = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (minor <= BigInt(0) || minor > BigInt(Number.MAX_SAFE_INTEGER))
    return null;
  return Number(minor);
}

function isPaystackCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname === "checkout.paystack.com"
    );
  } catch {
    return false;
  }
}

function userFacingOrderError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("whole-number")) {
    return "This product is sold in whole units. Update the quantity and try again.";
  }
  if (
    lower.includes("not enough stock") ||
    lower.includes("no longer available")
  ) {
    return "One or more items are no longer available in the selected branch.";
  }
  if (lower.includes("price")) {
    return "A current online price is not available for every item.";
  }
  if (lower.includes("delivery")) {
    return "Check the delivery option and enter a complete delivery address.";
  }
  if (lower.includes("email")) {
    return "Enter an email address to pay online with Paystack.";
  }
  if (
    ["check", "choose", "remove", "invalid", "available"].some((part) =>
      lower.includes(part),
    )
  ) {
    return "Check your contact details, branch and product quantities.";
  }
  return "We could not place this order. Please check the details and try again.";
}

export async function POST(request: NextRequest) {
  if (!isPublicWebsiteEnabled()) {
    return NextResponse.json(
      { error: "The online store is unavailable." },
      { status: 503 },
    );
  }

  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: "This request could not be verified." },
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32000) {
    return NextResponse.json(
      { error: "The request is too large." },
      { status: 413 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Check the details and try again." },
      { status: 400 },
    );
  }

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Check the checkout details.",
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (input.website) {
    return NextResponse.json(
      { error: "Check the details and try again." },
      { status: 400 },
    );
  }
  if (
    input.paymentMethod === "PAY_ON_DELIVERY" &&
    input.fulfillmentMethod !== "DELIVERY"
  ) {
    return NextResponse.json(
      { error: "Pay on delivery is available for delivery orders only." },
      { status: 400 },
    );
  }
  if (input.paymentMethod === "PAYSTACK" && !input.email) {
    return NextResponse.json(
      { error: "Enter an email address to pay online with Paystack." },
      { status: 400 },
    );
  }
  if (
    input.fulfillmentMethod === "DELIVERY" &&
    input.deliveryAddress.trim().length < 8
  ) {
    return NextResponse.json(
      { error: "Enter a complete delivery address." },
      { status: 400 },
    );
  }

  try {
    // Validate Paystack configuration before creating an unpaid checkout record.
    const paystackSecret =
      input.paymentMethod === "PAYSTACK"
        ? getRequiredPaystackSecretKey()
        : null;

    const forwardedFor = request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim();
    const clientAddress =
      request.headers.get("x-real-ip")?.trim() || forwardedFor || "unknown";
    const serviceKey = getRequiredServiceRoleKey();
    const visitorKey = createHmac("sha256", serviceKey)
      .update(clientAddress)
      .digest("hex");
    const admin = createAdminClient();

    const { data: rateData, error: rateError } = await admin.rpc(
      "consume_store_order_request_limit",
      {
        visitor_key: visitorKey,
        request_key: input.idempotencyKey,
        visitor_phone: input.phone,
      },
    );

    if (rateError) {
      return NextResponse.json(
        {
          error: "Checkout is temporarily unavailable. Please try again later.",
        },
        { status: 503 },
      );
    }

    const rate = rateData as { limited?: boolean } | null;
    if (rate?.limited) {
      return NextResponse.json(
        { error: "Please wait a few minutes before placing another order." },
        { status: 429 },
      );
    }

    const trackingHash = createHash("sha256")
      .update(input.trackingToken)
      .digest("hex");

    const { data: orderData, error: orderError } = await admin.rpc(
      "submit_store_checkout_order",
      {
        request_key: input.idempotencyKey,
        visitor_name: input.name,
        visitor_phone: input.phone,
        visitor_email: input.email || null,
        visitor_company: input.company || null,
        target_branch: input.branchId,
        visitor_message: input.message || null,
        items: input.items.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
        chosen_fulfillment: input.fulfillmentMethod,
        chosen_payment: input.paymentMethod,
        requested_delivery_address:
          input.fulfillmentMethod === "DELIVERY" ? input.deliveryAddress : null,
        requested_delivery_instructions:
          input.fulfillmentMethod === "DELIVERY"
            ? input.deliveryInstructions || null
            : null,
        tracking_hash: trackingHash,
      },
    );

    if (orderError) {
      return NextResponse.json(
        { error: userFacingOrderError(orderError.message) },
        { status: 400 },
      );
    }

    const order = orderData as {
      order_id?: string;
      order_number?: string;
      total?: number | string;
      payment_method?: string;
      payment_status?: string;
    } | null;

    if (!order?.order_id || !order.order_number || order.total == null) {
      return NextResponse.json(
        { error: "We could not confirm this order. Please try again." },
        { status: 500 },
      );
    }

    const trackingUrl = "/track/" + input.trackingToken;
    if (input.paymentMethod === "PAYSTACK" && order.payment_status === "PAID") {
      return NextResponse.json(
        { orderNumber: order.order_number, trackingUrl, alreadyPaid: true },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (input.paymentMethod === "PAY_ON_DELIVERY") {
      return NextResponse.json(
        { orderNumber: order.order_number, trackingUrl },
        {
          status: 201,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const amountPesewas = toPesewas(order.total);
    if (!amountPesewas || !paystackSecret) {
      return NextResponse.json(
        { error: "The order amount is not available for online payment." },
        { status: 503 },
      );
    }

    const { data: activeAttemptData, error: activeAttemptError } = await admin
      .from("store_order_payment_attempts")
      .select("reference,status,authorization_url,created_at")
      .eq("order_id", order.order_id)
      .in("status", ["INITIALIZING", "PENDING"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeAttemptError) {
      return NextResponse.json(
        { error: "We could not check the current payment attempt." },
        { status: 503 },
      );
    }

    if (activeAttemptData) {
      const activeAttempt = activeAttemptData as {
        reference: string;
        status: string;
        authorization_url: string | null;
        created_at: string;
      };

      if (
        activeAttempt.authorization_url &&
        isPaystackCheckoutUrl(activeAttempt.authorization_url)
      ) {
        return NextResponse.json(
          {
            orderNumber: order.order_number,
            authorizationUrl: activeAttempt.authorization_url,
            reference: activeAttempt.reference,
          },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      }

      const attemptAge =
        Date.now() - new Date(activeAttempt.created_at).getTime();
      if (attemptAge < 120000) {
        return NextResponse.json(
          { error: "Payment is starting. Wait a moment, then try again." },
          { status: 409 },
        );
      }

      await admin
        .from("store_order_payment_attempts")
        .update({ status: "FAILED" })
        .eq("reference", activeAttempt.reference)
        .neq("status", "PAID");
    }

    const reference = "SATJ-" + randomUUID().replaceAll("-", "");
    const { error: attemptError } = await admin
      .from("store_order_payment_attempts")
      .insert({
        order_id: order.order_id,
        reference,
        amount_pesewas: amountPesewas,
        status: "INITIALIZING",
      });

    if (attemptError) {
      return NextResponse.json(
        { error: "We could not start the payment. Please try again." },
        { status: 503 },
      );
    }

    try {
      const response = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + paystackSecret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: input.email,
            amount: String(amountPesewas),
            currency: "GHS",
            reference,
            callback_url: publicSiteUrlForRequest(
              "/api/payments/paystack/callback",
              request.nextUrl.origin,
            ),
            metadata: {
              order_number: order.order_number,
              fulfillment_method: input.fulfillmentMethod,
            },
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        },
      );

      const paystackResult = (await response.json()) as {
        status?: boolean;
        data?: {
          authorization_url?: string;
          reference?: string;
        };
      };

      if (
        !response.ok ||
        paystackResult.status !== true ||
        !paystackResult.data?.authorization_url ||
        paystackResult.data.reference !== reference
      ) {
        await admin
          .from("store_order_payment_attempts")
          .update({ status: "FAILED" })
          .eq("reference", reference)
          .neq("status", "PAID");
        return NextResponse.json(
          { error: "Paystack could not start this payment. Please try again." },
          { status: 502 },
        );
      }

      const { error: saveAttemptError } = await admin
        .from("store_order_payment_attempts")
        .update({
          status: "PENDING",
          authorization_url: paystackResult.data.authorization_url,
        })
        .eq("reference", reference)
        .neq("status", "PAID");

      if (saveAttemptError) {
        return NextResponse.json(
          { error: "We could not save the Paystack session. Please retry." },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          orderNumber: order.order_number,
          authorizationUrl: paystackResult.data.authorization_url,
          reference,
        },
        {
          status: 201,
          headers: { "Cache-Control": "no-store" },
        },
      );
    } catch {
      await admin
        .from("store_order_payment_attempts")
        .update({ status: "FAILED" })
        .eq("reference", reference);
      return NextResponse.json(
        { error: "Paystack could not start this payment. Please try again." },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Checkout is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
