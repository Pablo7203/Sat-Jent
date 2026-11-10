"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { useBasket } from "./cart-provider";

type CheckoutBranch = { id: string; name: string; address: string };

export function CheckoutForm({ branches }: { branches: CheckoutBranch[] }) {
  const { lines, ready, clear } = useBasket();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);
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
    const branchId = String(formData.get("branchId") ?? "");
    if (!branchId) {
      setError(
        "Choose the SAT-J branch you want to contact about this request.",
      );
      return;
    }
    setPending(true);
    idempotencyKey.current ??= window.crypto.randomUUID();
    try {
      const response = await fetch("/api/store-order-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          name: formData.get("name"),
          phone: formData.get("phone"),
          email: formData.get("email"),
          company: formData.get("company"),
          branchId,
          message: formData.get("message"),
          website: formData.get("website"),
          items: lines.map((line) => ({
            variantId: line.variantId,
            quantity: line.quantity,
          })),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        requestNumber?: string;
      };
      if (!response.ok) {
        setError(
          result.error ?? "We could not submit your request. Please try again.",
        );
        return;
      }
      setRequestNumber(result.requestNumber ?? "Received");
      clear();
    } catch {
      setError(
        "We could not reach SAT-J just now. Your basket is saved, please try again shortly.",
      );
    } finally {
      setPending(false);
    }
  }

  if (requestNumber)
    return (
      <section
        className="rounded-2xl border border-[#d9e3d7] bg-white p-8 sm:p-10"
        role="status"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#edf3eb] text-[#446b49]">
          <Check aria-hidden="true" size={22} />
        </div>
        <h2 className="public-editorial-title mt-5 text-4xl">
          Your request is with SAT-J.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#62665e]">
          The selected branch will review your items and confirm current prices
          and availability. This request does not reserve stock or take payment.
        </p>
        <p className="mt-5 text-sm font-semibold text-[#20221f]">
          Reference: {requestNumber}
        </p>
        <Link
          className="mt-7 inline-flex min-h-11 items-center rounded-full bg-[#20221f] px-5 text-sm font-semibold text-white hover:bg-[#aa4924]"
          href="/products"
        >
          Continue browsing
        </Link>
      </section>
    );

  if (!ready)
    return (
      <p className="py-12 text-center text-sm text-[#696b64]">
        Loading your saved basket…
      </p>
    );
  if (!lines.length)
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
              Email
              <input
                className={field}
                autoComplete="email"
                maxLength={254}
                name="email"
                type="email"
              />
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
          <label className="mt-5 block text-sm font-semibold">
            Project notes (optional)
            <textarea
              className={`${field} py-3`}
              maxLength={2000}
              name="message"
              rows={4}
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
          <h2 className="text-lg font-semibold">
            Items for the branch to review
          </h2>
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
                    : `GHS ${(line.price * line.quantity).toFixed(2)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <aside className="rounded-2xl border border-[#e7e5df] bg-white p-6">
        <h2 className="text-lg font-semibold">Before you send</h2>
        <p className="mt-4 text-sm leading-6 text-[#696b64]">
          This sends a request to SAT-J. A staff member checks your branch,
          product availability and final price before making a sale draft.
        </p>
        <p className="mt-4 text-sm leading-6 text-[#696b64]">
          No stock is reserved and no payment is taken online at this stage.
        </p>
        <div className="mt-5 flex justify-between border-t border-[#e7e5df] pt-4 text-sm">
          <span>Estimated total</span>
          <strong>
            {estimatedTotal == null
              ? "To be confirmed"
              : `GHS ${estimatedTotal.toFixed(2)}`}
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
              />{" "}
              Sending request…
            </>
          ) : (
            "Send order request"
          )}
        </button>
        <p className="mt-4 text-xs leading-5 text-[#696b64]">
          By submitting, you ask SAT-J to contact you about these products. See
          our{" "}
          <Link className="underline underline-offset-2" href="/privacy">
            privacy notice
          </Link>
          .
        </p>
      </aside>
    </form>
  );
}
