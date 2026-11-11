/**
 * Paystack webhooks are treated as a notification only: the referenced payment
 * is verified again through Paystack before SAT-J marks an order as paid.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  getRequiredPaystackSecretKey,
  getRequiredPaystackWebhookSecret,
} from "@/lib/env/server";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";

export const runtime = "nodejs";

function equalHex(expected: string, supplied: string): boolean {
  if (!/^[a-f0-9]{128}$/i.test(supplied)) return false;
  const expectedBytes = Buffer.from(expected, "hex");
  const suppliedBytes = Buffer.from(supplied, "hex");
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

function isValidSignature(rawBody: string, request: NextRequest): boolean {
  const currentHeader = request.headers.get("paystack-signature");

  if (currentHeader) {
    const parts = currentHeader.split(",").map((part) => part.trim());
    const timestampPart = parts.find((part) => part.startsWith("t="));
    const timestamp = timestampPart?.slice(2);
    if (!timestamp || !/^\d{10,13}$/.test(timestamp)) return false;

    const seconds = Number(
      timestamp.length > 10 ? timestamp.slice(0, 10) : timestamp,
    );
    if (
      !Number.isSafeInteger(seconds) ||
      Math.abs(Date.now() / 1000 - seconds) > 300
    ) {
      return false;
    }

    const signatures = parts
      .filter((part) => part.startsWith("v1="))
      .map((part) => part.slice(3).split(":").pop() ?? "")
      .filter(Boolean);
    if (!signatures.length) return false;

    const secret = getRequiredPaystackWebhookSecret();
    const expected = createHmac("sha512", secret)
      .update(timestamp + "." + rawBody)
      .digest("hex");
    return signatures.some((signature) => equalHex(expected, signature));
  }

  // Paystack's older signature header signs only the raw body. Keep this
  // fallback for projects that have not yet switched webhook signing secrets.
  const legacy = request.headers.get("x-paystack-signature");
  if (!legacy) return false;
  const expected = createHmac("sha512", getRequiredPaystackSecretKey())
    .update(rawBody)
    .digest("hex");
  return equalHex(expected, legacy);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > 128000) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  try {
    if (!isValidSignature(rawBody, request)) {
      return NextResponse.json(
        { error: "Invalid signature." },
        { status: 401 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Webhook verification is not configured." },
      { status: 503 },
    );
  }

  let payload: {
    event?: string;
    data?: { reference?: string };
  };

  try {
    payload = JSON.parse(rawBody) as {
      event?: string;
      data?: { reference?: string };
    };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (payload.event !== "charge.success" || !payload.data?.reference) {
    return NextResponse.json({ received: true });
  }

  try {
    const result = await verifyPaystackTransaction(payload.data.reference);
    if (!result?.paid) {
      return NextResponse.json(
        { error: "Payment is not yet verified." },
        { status: 503 },
      );
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Payment verification could not complete." },
      { status: 503 },
    );
  }
}
