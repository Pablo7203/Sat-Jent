"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useBasket } from "./cart-provider";

export function BasketLink() {
  const { count, ready } = useBasket();
  return (
    <Link
      aria-label={`Basket${ready && count ? `, ${count} items` : ""}`}
      className="relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[#20221f]/15 text-[#20221f] transition hover:border-[#aa4924] hover:text-[#aa4924]"
      href="/basket"
    >
      <ShoppingBag aria-hidden="true" size={19} />
      {ready && count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#aa4924] px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export function AddToBasketButton({
  line,
}: {
  line: {
    variantId: string;
    slug: string;
    name: string;
    variant: string;
    sku: string;
    unit: string;
    price: number | null;
  };
}) {
  const { add } = useBasket();
  const [added, setAdded] = useState(false);
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#20221f] px-5 text-sm font-semibold text-white transition hover:bg-[#aa4924]"
      onClick={() => {
        add(line);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1500);
      }}
      type="button"
    >
      {added ? (
        <Check aria-hidden="true" size={16} />
      ) : (
        <ShoppingBag aria-hidden="true" size={16} />
      )}
      {added ? "Added to basket" : "Add to basket"}
    </button>
  );
}

export function BasketPageContent() {
  const { lines, ready, setQuantity, remove } = useBasket();
  const estimatedTotal = lines.every((line) => line.price != null)
    ? lines.reduce((total, line) => total + line.price! * line.quantity, 0)
    : null;

  if (!ready)
    return (
      <p className="py-16 text-center text-sm text-[#696b64]">
        Loading your basket…
      </p>
    );
  if (!lines.length)
    return (
      <section className="rounded-2xl border border-[#e7e5df] bg-white p-8 text-center sm:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f1eee8] text-[#aa4924]">
          <ShoppingBag aria-hidden="true" size={23} />
        </div>
        <h2 className="public-editorial-title mt-5 text-3xl">
          Your basket is waiting.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#696b64]">
          Browse the catalogue and add the products you want SAT-J to review for
          your project.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#20221f] px-5 text-sm font-semibold text-white hover:bg-[#aa4924]"
          href="/products"
        >
          Browse products
        </Link>
      </section>
    );

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <ul className="divide-y divide-[#e7e5df] rounded-2xl border border-[#e7e5df] bg-white px-5 sm:px-7">
        {lines.map((line) => (
          <li
            className="grid gap-4 py-5 sm:grid-cols-[1fr_120px_110px] sm:items-center"
            key={line.variantId}
          >
            <div className="min-w-0">
              <Link
                className="font-semibold text-[#20221f] hover:text-[#aa4924]"
                href={`/products/${line.slug}`}
              >
                {line.name}
              </Link>
              <p className="mt-1 text-xs leading-5 text-[#696b64]">
                {line.variant} · SKU {line.sku} · sold by {line.unit}
              </p>
              {line.price != null ? (
                <p className="mt-1 text-sm font-medium text-[#454840]">
                  GHS {line.price.toFixed(2)} / {line.unit}
                </p>
              ) : (
                <p className="mt-1 text-sm text-[#696b64]">
                  Price confirmed by branch
                </p>
              )}
            </div>
            <label className="text-xs font-semibold text-[#696b64]">
              Quantity
              <input
                className="mt-1 min-h-10 w-full rounded-lg border border-[#d5d6d0] px-3 text-sm text-[#20221f]"
                min="0.001"
                onChange={(event) =>
                  setQuantity(line.variantId, Number(event.target.value))
                }
                step="0.001"
                type="number"
                value={line.quantity}
              />
            </label>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm font-semibold text-[#20221f]">
                {line.price != null
                  ? `GHS ${(line.price * line.quantity).toFixed(2)}`
                  : "Estimate pending"}
              </span>
              <button
                className="text-xs font-semibold text-[#8a4c36] underline underline-offset-4"
                onClick={() => remove(line.variantId)}
                type="button"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <aside className="rounded-2xl border border-[#e7e5df] bg-white p-6">
        <h2 className="text-lg font-semibold text-[#20221f]">Order estimate</h2>
        <div className="mt-5 flex justify-between gap-4 border-t border-[#e7e5df] pt-4 text-sm">
          <span className="text-[#696b64]">Estimated products</span>
          <span className="font-semibold text-[#20221f]">
            {estimatedTotal == null
              ? "Confirmed by branch"
              : `GHS ${estimatedTotal.toFixed(2)}`}
          </span>
        </div>
        <p className="mt-4 text-xs leading-5 text-[#696b64]">
          This is a request for SAT-J to confirm price and availability. It does
          not reserve stock or take payment.
        </p>
        <Link
          className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-[#aa4924] px-5 text-sm font-semibold text-white hover:bg-[#8f3c1f]"
          href="/checkout"
        >
          Continue to request
        </Link>
        <Link
          className="mt-4 block text-center text-sm font-semibold text-[#454840] hover:text-[#aa4924]"
          href="/products"
        >
          Continue browsing
        </Link>
      </aside>
    </div>
  );
}
