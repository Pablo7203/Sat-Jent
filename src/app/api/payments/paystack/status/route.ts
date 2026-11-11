import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference");
  if (!reference || !/^SATJ-[a-f0-9]{32}$/i.test(reference)) {
    return NextResponse.json(
      { error: "Payment reference not found." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: attempt, error: attemptError } = await admin
    .from("store_order_payment_attempts")
    .select("order_id,status")
    .eq("reference", reference)
    .maybeSingle();

  if (attemptError || !attempt) {
    return NextResponse.json(
      { error: "Payment reference not found." },
      { status: 404 },
    );
  }

  const { data: order, error: orderError } = await admin
    .from("store_order_requests")
    .select("request_number,payment_status,fulfillment_status")
    .eq("id", attempt.order_id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      orderNumber: order.request_number,
      paid: order.payment_status === "PAID" && attempt.status === "PAID",
      fulfillmentStatus: order.fulfillment_status,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
