import { NextResponse, type NextRequest } from "next/server";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { publicSiteUrlForRequest } from "@/lib/env/site-url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const reference =
    request.nextUrl.searchParams.get("reference") ??
    request.nextUrl.searchParams.get("trxref");

  if (!reference || reference.length > 100) {
    return NextResponse.redirect(
      new URL(
        "/checkout/complete?result=failed",
        publicSiteUrlForRequest("", request.nextUrl.origin),
      ),
    );
  }

  try {
    const result = await verifyPaystackTransaction(reference);
    const destination = result?.paid
      ? "/checkout/complete?result=paid&reference=" +
        encodeURIComponent(reference)
      : "/checkout/complete?result=pending&reference=" +
        encodeURIComponent(reference);

    return NextResponse.redirect(
      new URL(destination, publicSiteUrlForRequest("", request.nextUrl.origin)),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    const destination =
      "/checkout/complete?result=pending&reference=" +
      encodeURIComponent(reference);
    return NextResponse.redirect(
      new URL(destination, publicSiteUrlForRequest("", request.nextUrl.origin)),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
