"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, LoaderCircle, LockKeyhole } from "lucide-react";
import { useBasket } from "./cart-provider";

type CheckoutBranch = { id: string; name: string; address: string };
type FulfillmentMethod = "PICKUP" | "DELIVERY";
type PaymentMethod = "PAY_ON_DELIVERY" | "PAYSTACK";
type CheckoutSession = { idempotencyKey: string; trackingToken: string };

function createTrackingToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function getCheckoutSession(): CheckoutSession {
  const key = "satj-checkout-session-v1";
  try {
    const stored = window.sessionStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<CheckoutSession>;
      if (
        typeof parsed.idempotencyKey === "string" &&
        typeof parsed.trackingToken === "string" &&
        /^[a-f0-9]{64}$/.test(parsed.trackingToken)
      ) {
        return {
          idempotencyKey: parsed.idempotencyKey,
          trackingToken: parsed.trackingToken,
        };
      }
    }
  } catch {
    // A fresh session can still be created when browser storage is restricted.
  }

  const session = {
    idempotencyKey: window.crypto.randomUUID(),
    trackingToken: createTrackingToken(),
  };
  try {
    window.sessionStorage.setItem(key, JSON.stringify(session));
  } catch {
    // Keep this order usable for the current visit.
  }
  return session;
}

export function CheckoutForm({ branches }: { branches: CheckoutBranch[] }) {
  const { lines, ready, clear } = useBasket();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{
    orderNumber: string;
    trackingUrl: string;
  } | null>(null);
  const [fulfillmentMethod, setFulfillmentMethod] =
    useState<FulfillmentMethod>("PICKUP");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PAYSTACK");
  const sessionRef = useRef<CheckoutSession | null>(null);

  const field =
    "mt-2 min-h-12 w-full rounded-lg border border-[#d5d6d0] bg-white px-4 text-sm font-normal text-[#20221f] outline-none focus:border-[#aa4924] focus:ring-2 focus:ring-[#aa4924]/15";
  const estimatedTotal = lines.every((line) => line.price != null)
    ? lines.reduce((total, line) => total + line.price! * line.quantity, 0)
    : null;

  async function submit(formData: FormData) {
    setError(null);
    if (!ready || lines.length === 0) {
      setError("Your basket is empty. Add products before continuing.");
      return;
    }

    const selectedFulfillment = String(
      formData.get("fulfillmentMethod") ?? "PICKUP",
    ) as FulfillmentMethod;
    const selectedPayment = String(
      formData.get("paymentMethod") ?? "PAYSTACK",
    ) as PaymentMethod;
    const branchId = String(formData.get("branchId") ?? "");
    const email = String(formData.get("email") ?? "").trim();
    const address = String(formData.get("deliveryAddress") ?? "").trim();

    if (!branchId) {
      setError("Choose the SAT-J branch that should prepare your order.");
      return;
    }
    if (selectedFulfillment === "DELIVERY" && address.length < 8) {
      setError("Enter a complete delivery address.");
      return;
    }
    if (
      selectedPayment === "PAY_ON_DELIVERY" &&
      selectedFulfillment !== "DELIVERY"
    ) {
      setError("Pay on delivery is available for delivery orders only.");
      return;
    }
    if (selectedPayment === "PAYSTACK" && !email) {
      setError("Enter an email address to pay online with Paystack.");
      return;
    }

    setPending(true);
    sessionRef.current ??= getCheckoutSession();
    try {
      const response = await fetch("/api/store-order-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: sessionRef.current.idempotencyKey,
          trackingToken: sessionRef.current.trackingToken,
          name: formData.get("name"),
          phone: formData.get("phone"),
          email,
          company: formData.get("company"),
          branchId,
          message: formData.get("message"),
          fulfillmentMethod: selectedFulfillment,
          paymentMethod: selectedPayment,
          deliveryAddress: address,
          deliveryInstructions: formData.get("deliveryInstructions"),
          website: formData.get("website"),
          items: lines.map((line) => ({
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        orderNumber?: string;
        trackingUrl?: string;
        authorizationUrl?: string;
        reference?: string;
      };

      if (!response.ok) {
        setError(
          result.error ?? "We could not place this order. Please try again.",
        );
        return;
      }

      if (selectedPayment === "PAYSTACK") {
        if (!result.authorizationUrl || !result.reference) {
          setError(
            "Paystack did not return a secure checkout link. Please retry.",
          );
          return;
        }
        const authorizationUrl = new URL(result.authorizationUrl);
        if (
          authorizationUrl.protocol !== "https:" ||
          authorizationUrl.hostname !== "checkout.paystack.com"
        ) {
          setError("The Paystack checkout link could not be verified.");
          return;
        }
        try {
          window.localStorage.setItem(
            "satj-tracking-" + result.reference,
            sessionRef.current.trackingToken,
          );
        } catch {
          // Payment still works if the browser blocks local storage.
        }
        window.location.assign(authorizationUrl.toString());
        return;
      }

      if (!result.orderNumber || !result.trackingUrl) {
        setError("We could not confirm this order. Please contact SAT-J.");
        return;
      }

      setOrder({
        orderNumber: result.orderNumber,
        trackingUrl: result.trackingUrl,
      });
      clear();
      try {
        window.sessionStorage.removeItem("satj-checkout-session-v1");
      } catch {
        // The order has already been saved.
      }
    } catch {
      setError(
        "We could not reach SAT-J just now. Your basket is saved, please try again shortly.",
      );
    } finally {
      setPending(false);
    }
  }

  if (order) {
    return (
      <section
        className="rounded-2xl border border-[#d9e3d7] bg-white p-8 sm:p-10"
        role="status"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#edf3eb] text-[#446b49]">
          <Check aria-hidden="true" size={22} />
        </div>
        <h2 className="public-editorial-title mt-5 text-4xl">
          Your order is in.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#62665e]">
          We have received your order for pay on delivery. Keep the reference
          below so you can check delivery updates from SAT-J.
        </p>
        <p className="mt-5 text-sm font-semibold text-[#20221f]">
          Order reference: {order.orderNumber}
        </p>
        <Link
          className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[#20221f] px-5 text-sm font-semibold text-white hover:bg-[#aa4924]"
          href={order.trackingUrl}
        >
          Track your order
        </Link>
        <Link
          className="ml-3 inline-flex min-h-11 items-center rounded-full border border-[#d5d6d0] px-5 text-sm font-semibold text-[#20221f]"
          href="/products"
        >
          Continue browsing
        </Link>
      </section>
    );
  }

  if (!ready) {
    return (
      <p className="py-12 text-center text-sm text-[#696b64]">
        Loading your saved basket…
      </p>
    );
  }

  if (!lines.length) {
    return (
      <section className="rounded-2xl border border-[#e7e5df] bg-white p-8 text-center">
        <h2 className="public-editorial-title text-3xl">
          Your basket is empty.
        </h2>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#20221f] px-5 text-sm font-semibold text-white"
          href="/products"
        >
          Browse products
        </Link>
      </section>
    );
  }

  return (
    <form
      action={submit}
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div className="grid gap-6">
        <section className="rounded-2xl border border-[#e7e5df] bg-white p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Your contact details</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Name *
              <input
                className={field}
                autoComplete="name"
                maxLength={160}
                name="name"
                required
              />
            </label>
            <label className="text-sm font-semibold">
              Phone *
              <input
                className={field}
                autoComplete="tel"
                maxLength={40}
                name="phone"
                required
                type="tel"
              />
            </label>
            <label className="text-sm font-semibold">
              Email {paymentMethod === "PAYSTACK" ? "*" : "(optional)"}
              <input
                className={field}
                autoComplete="email"
                maxLength={254}
                name="email"
                required={paymentMethod === "PAYSTACK"}
                type="email"
              />
              <span className="mt-2 block text-xs font-normal leading-5 text-[#696b64]">
                Add an email to receive your order confirmation and delivery
                updates. It’s required for online payment.
              </span>
            </label>
            <label className="text-sm font-semibold">
              Company (optional)
              <input
                className={field}
                autoComplete="organization"
                maxLength={160}
                name="company"
              />
            </label>
          </div>
          <label className="mt-5 block text-sm font-semibold">
            SAT-J branch *
            <select className={field} defaultValue="" name="branchId" required>
              <option disabled value="">
                Choose a branch
              </option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} — {branch.address}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="rounded-2xl border border-[#e7e5df] bg-white p-5 sm:p-7">
          <h2 className="text-lg font-semibold">
            How would you like your order?
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["PICKUP", "Collect from a branch"],
                ["DELIVERY", "Deliver to an address"],
              ] as const
            ).map(([value, label]) => (
              <label
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[#d5d6d0] px-4 text-sm font-semibold"
                key={value}
              >
                <input
                  checked={fulfillmentMethod === value}
                  className="accent-[#aa4924]"
                  name="fulfillmentMethod"
                  onChange={() => {
                    setFulfillmentMethod(value);
                    if (
                      value === "PICKUP" &&
                      paymentMethod === "PAY_ON_DELIVERY"
                    ) {
                      setPaymentMethod("PAYSTACK");
                    }
                  }}
                  type="radio"
                  value={value}
                />
                {label}
              </label>
            ))}
          </div>
          {fulfillmentMethod === "DELIVERY" ? (
            <div className="mt-5 grid gap-5">
              <label className="text-sm font-semibold">
                Delivery address *
                <textarea
                  className={field + " py-3"}
                  autoComplete="street-address"
                  maxLength={1000}
                  name="deliveryAddress"
                  required
                  rows={3}
                />
              </label>
              <label className="text-sm font-semibold">
                Delivery instructions (optional)
                <textarea
                  className={field + " py-3"}
                  maxLength={1000}
                  name="deliveryInstructions"
                  rows={2}
                />
              </label>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#696b64]">
              Your chosen branch will prepare the order for collection.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[#e7e5df] bg-white p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Payment method</h2>
          <div className="mt-5 grid gap-3">
            <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[#d5d6d0] px-4 text-sm font-semibold">
              <input
                checked={paymentMethod === "PAYSTACK"}
                className="accent-[#aa4924]"
                name="paymentMethod"
                onChange={() => setPaymentMethod("PAYSTACK")}
                type="radio"
                value="PAYSTACK"
              />
              <span>
                Pay online with Paystack
                <span className="mt-1 block text-xs font-normal text-[#696b64]">
                  Secure checkout by card and supported local payment methods.
                </span>
              </span>
              <LockKeyhole
                aria-hidden="true"
                className="ml-auto text-[#446b49]"
                size={18}
              />
            </label>
            {fulfillmentMethod === "DELIVERY" ? (
              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[#d5d6d0] px-4 text-sm font-semibold">
                <input
                  checked={paymentMethod === "PAY_ON_DELIVERY"}
                  className="accent-[#aa4924]"
                  name="paymentMethod"
                  onChange={() => setPaymentMethod("PAY_ON_DELIVERY")}
                  type="radio"
                  value="PAY_ON_DELIVERY"
                />
                <span>
                  Pay on delivery
                  <span className="mt-1 block text-xs font-normal text-[#696b64]">
                    Pay the delivery team when your order arrives.
                  </span>
                </span>
              </label>
            ) : null}
          </div>
          <label className="mt-5 block text-sm font-semibold">
            Project notes (optional)
            <textarea
              className={field + " py-3"}
              maxLength={2000}
              name="message"
              rows={3}
            />
          </label>
          <label
            aria-hidden="true"
            className="absolute -left-[10000px] h-px w-px overflow-hidden"
            tabIndex={-1}
          >
            Website
            <input autoComplete="off" name="website" tabIndex={-1} />
          </label>
        </section>

        <section className="rounded-2xl border border-[#e7e5df] bg-white p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Your items</h2>
          <ul className="mt-4 divide-y divide-[#e7e5df]">
            {lines.map((line) => (
              <li
                className="flex justify-between gap-4 py-3 text-sm"
                key={line.variantId}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{line.name}</span>
                  <span className="mt-1 block text-xs text-[#696b64]">
                    {line.variant} · {line.quantity} {line.unit}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[#4a4d46]">
                  {line.price == null
                    ? "Price to confirm"
                    : "GHS " + (line.price * line.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="rounded-2xl border border-[#e7e5df] bg-white p-6">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <p className="mt-4 text-sm leading-6 text-[#696b64]">
          SAT-J checks current branch prices and stock before accepting the
          order. The final total comes from the store, not your browser.
        </p>
        <div className="mt-5 flex justify-between border-t border-[#e7e5df] pt-4 text-sm">
          <span>Estimated total</span>
          <strong>
            {estimatedTotal == null
              ? "Price to confirm"
              : "GHS " + estimatedTotal.toFixed(2)}
          </strong>
        </div>
        {error ? (
          <p className="mt-4 text-sm text-[#a23f31]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#aa4924] px-5 text-sm font-semibold text-white hover:bg-[#8f3c1f] disabled:cursor-wait disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? (
            <>
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin"
                size={17}
              />
              Placing order…
            </>
          ) : paymentMethod === "PAYSTACK" ? (
            "Continue to secure payment"
          ) : (
            "Place order"
          )}
        </button>
        <p className="mt-4 text-xs leading-5 text-[#696b64]">
          By placing this order, you agree that SAT-J may use your details to
          prepare and deliver it. Read our{" "}
          <Link className="underline underline-offset-2" href="/privacy">
            privacy notice
          </Link>
          .
        </p>
      </aside>
    </form>
  );
}
