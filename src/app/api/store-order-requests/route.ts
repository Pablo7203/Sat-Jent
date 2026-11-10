/**
 * Public order-request endpoint validates customer input, rate-limits visitors, and writes using server-side credentials.
 */

import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequiredServiceRoleKey } from "@/lib/env/server";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

const requestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(5).max(40),
  email: z.string().trim().email().max(254).or(z.literal("")),
  company: z.string().trim().max(160),
  branchId: z.string().uuid(),
  message: z.string().trim().max(2000),
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
  if (contentLength > 32_000) {
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
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the order details." },
      { status: 400 },
    );
  }
  if (parsed.data.website) {
    return NextResponse.json(
      { error: "Check the details and try again." },
      { status: 400 },
    );
  }

  try {
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
        request_key: parsed.data.idempotencyKey,
        visitor_phone: parsed.data.phone,
      },
    );
    if (rateError) {
      return NextResponse.json(
        {
          error:
            "The online store is temporarily unavailable. Please try again later.",
        },
        { status: 503 },
      );
    }
    const rate = rateData as {
      limited?: boolean;
      request_number?: string;
    } | null;
    if (rate?.limited) {
      return NextResponse.json(
        { error: "Please wait a few minutes before sending another request." },
        { status: 429 },
      );
    }
    if (rate?.request_number) {
      return NextResponse.json(
        { requestNumber: rate.request_number },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const { data, error } = await admin.rpc("submit_store_order_request", {
      request_key: parsed.data.idempotencyKey,
      visitor_name: parsed.data.name,
      visitor_phone: parsed.data.phone,
      visitor_email: parsed.data.email || null,
      visitor_company: parsed.data.company || null,
      target_branch: parsed.data.branchId,
      visitor_message: parsed.data.message || null,
      items: parsed.data.items.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
    });
    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("whole-number")) {
        return NextResponse.json(
          {
            error:
              "This product is sold in whole units. Update the quantity and try again.",
          },
          { status: 400 },
        );
      }
      if (
        [
          "check",
          "choose",
          "remove",
          "invalid",
          "no longer available",
          "not enough stock",
        ].some((part) => message.includes(part))
      ) {
        return NextResponse.json(
          {
            error:
              "We could not submit this request. Check the branch and product quantities, then try again.",
          },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          error:
            "The online store is temporarily unavailable. Please try again later.",
        },
        { status: 503 },
      );
    }
    const result = data as {
      limited?: boolean;
      request_number?: string;
    } | null;
    if (result?.limited) {
      return NextResponse.json(
        { error: "Please wait a few minutes before sending another request." },
        { status: 429 },
      );
    }
    if (!result?.request_number) {
      return NextResponse.json(
        { error: "We could not confirm your request. Please try again." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { requestNumber: result.request_number },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "The online store is temporarily unavailable. Please try again later.",
      },
      { status: 503 },
    );
  }
}
