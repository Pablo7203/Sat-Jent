"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBasket } from "@/components/public/cart-provider";

type PaymentState = {
  orderNumber: string;
  paid: boolean;
  fulfillmentStatus: string;
};

export function CheckoutComplete({ reference }: { reference: string }) {
  const { clear } = useBasket();
  const [state, setState] = useState<PaymentState | null>(null);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      if (!reference) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(
          "/api/payments/paystack/status?reference=" +
            encodeURIComponent(reference),
          { cache: "no-store" },
        );
        const result = (await response.json()) as PaymentState;
        if (!response.ok) throw new Error("Payment status unavailable");
        if (!active) return;

        setState(result);
        if (result.paid) {
          clear();
          try {
            const token = window.localStorage.getItem(
              "satj-tracking-" + reference,
            );
            if (token && /^[a-f0-9]{64}$/.test(token)) {
              setTrackingUrl("/track/" + token);
            }
            window.sessionStorage.removeItem("satj-checkout-session-v1");
          } catch {
            // Payment status remains available even when browser storage is blocked.
          }
        }
      } catch {
        if (active) setState(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, [reference, clear]);

  return (
    <section className="rounded-2xl border border-[#e7e5df] bg-white p-8 sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#aa4924]">
        Order payment
      </p>
      <h1 className="public-editorial-title mt-4 text-4xl sm:text-5xl">
        {loading
          ? "Checking your payment."
          : state?.paid
            ? "Payment received."
            : "Payment not confirmed yet."}
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-[#696b64]">
        {loading
          ? "We are checking the verified payment status with SAT-J."
          : state?.paid
            ? "Your order is confirmed. You can use its private tracking link to follow the next delivery updates."
            : "The payment has not been confirmed by SAT-J yet. Refresh this page in a moment or return to checkout to try again."}
      </p>
      {state?.orderNumber ? (
        <p className="mt-5 text-sm font-semibold text-[#20221f]">
          Order reference: {state.orderNumber}
        </p>
      ) : null}
      {state?.paid && trackingUrl ? (
        <Link
          className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[#20221f] px-5 text-sm font-semibold text-white hover:bg-[#aa4924]"
          href={trackingUrl}
        >
          Track your order
        </Link>
      ) : null}
      {state?.paid && !trackingUrl ? (
        <p className="mt-5 text-sm text-[#696b64]">
          Payment is recorded. Keep the reference above and contact your chosen
          branch if you need help following the order.
        </p>
      ) : null}
      {!state?.paid ? (
        <Link
          className="mt-7 inline-flex min-h-11 items-center rounded-full border border-[#d5d6d0] px-5 text-sm font-semibold text-[#20221f]"
          href="/checkout"
        >
          Return to checkout
        </Link>
      ) : null}
    </section>
  );
}
