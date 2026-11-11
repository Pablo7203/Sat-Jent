import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { siteConfig } from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";
import { createAdminClient } from "@/lib/supabase/admin";

type TrackingItem = {
  product: string;
  variant: string;
  quantity: number | string;
  unit: string;
};

type TrackingEvent = {
  fulfillment_status: string;
  payment_status: string;
  created_at: string;
};

type TrackingOrder = {
  order_number: string;
  fulfillment_method: string;
  fulfillment_status: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  items: TrackingItem[];
  events: TrackingEvent[];
};

const statusLabels: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Order confirmed",
  PREPARING: "Being prepared",
  READY_FOR_PICKUP: "Ready for collection",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Track your order",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (!isPublicWebsiteEnabled()) notFound();
  const [{ token }, config] = await Promise.all([params, siteConfig()]);
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_store_order_tracking", {
    target_tracking_hash: tokenHash,
  });
  if (error || !data) notFound();

  const order = data as unknown as TrackingOrder;
  return (
    <>
      <PublicHeader />
      <main className="min-h-[70vh] bg-[#fbfaf7] px-4 py-12 text-[#20221f] sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#aa4924]">
            SAT-J order tracking
          </p>
          <h1 className="public-editorial-title mt-3 text-5xl tracking-[-.04em]">
            {order.order_number}
          </h1>
          <section className="mt-7 rounded-2xl border border-[#e7e5df] bg-white p-6 sm:p-8">
            <p className="text-sm text-[#696b64]">Current order status</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {statusLabels[order.fulfillment_status] ??
                order.fulfillment_status.replaceAll("_", " ")}
            </h2>
            <div className="mt-5 grid gap-3 border-t border-[#e7e5df] pt-5 text-sm sm:grid-cols-2">
              <p>
                <span className="text-[#696b64]">Fulfilment: </span>
                {order.fulfillment_method === "DELIVERY"
                  ? "Delivery"
                  : "Branch collection"}
              </p>
              <p>
                <span className="text-[#696b64]">Payment: </span>
                {order.payment_status === "PAID"
                  ? "Paid"
                  : order.payment_method === "PAY_ON_DELIVERY"
                    ? "Due on delivery"
                    : "Awaiting Paystack confirmation"}
              </p>
            </div>
          </section>
          <section className="mt-6 rounded-2xl border border-[#e7e5df] bg-white p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Items in this order</h2>
            <ul className="mt-3 divide-y divide-[#e7e5df]">
              {(order.items ?? []).map((item, index) => (
                <li
                  className="flex justify-between gap-4 py-3 text-sm"
                  key={index}
                >
                  <span>
                    <span className="block font-semibold">{item.product}</span>
                    <span className="mt-1 block text-xs text-[#696b64]">
                      {item.variant}
                    </span>
                  </span>
                  <span className="shrink-0">
                    {item.quantity} {item.unit}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-6 rounded-2xl border border-[#e7e5df] bg-white p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Order updates</h2>
            <ol className="mt-4 space-y-4">
              {(order.events ?? []).map((event, index) => (
                <li className="flex gap-3 text-sm" key={index}>
                  <span
                    aria-hidden="true"
                    className="mt-1 size-2 shrink-0 rounded-full bg-[#aa4924]"
                  />
                  <div>
                    <p className="font-medium">
                      {statusLabels[event.fulfillment_status] ??
                        event.fulfillment_status.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-[#696b64]">
                      {new Date(event.created_at).toLocaleString("en-GH")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-[#e7e5df] pt-4 text-xs leading-5 text-[#696b64]">
              Refresh this page to see the latest update from the SAT-J team.
              This private link only shows information for this order.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
