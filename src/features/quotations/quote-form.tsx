"use client";
import { useActionState, useMemo, useState } from "react";
import { submitQuote, type QuoteState } from "./actions";
export function QuoteForm({
  products,
  initialProductId,
  branches,
}: {
  products: { id: string; name: string; category: string }[];
  initialProductId?: string;
  branches: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(submitQuote, {
    success: false,
  } as QuoteState);
  const initialProduct = products.find(
    (product) => product.id === initialProductId,
  );
  const [items, setItems] = useState(() =>
    initialProduct ? [{ id: initialProduct.id, quantity: "" }] : [],
  );
  const chosenIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );
  const availableProducts = products.filter(
    (product) => !chosenIds.has(product.id),
  );
  function addProduct(productId: string) {
    if (!productId || chosenIds.has(productId)) return;
    setItems((current) => [...current, { id: productId, quantity: "" }]);
  }
  function removeProduct(productId: string) {
    setItems((current) => current.filter((item) => item.id !== productId));
  }
  function setQuantity(productId: string, quantity: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === productId ? { ...item, quantity } : item,
      ),
    );
  }
  if (state.success)
    return (
      <div className="border border-[#aebba9] bg-[#edf3eb] p-8" role="status">
        <h2 className="public-editorial-title text-3xl tracking-[-0.035em]">
          Thank you.
        </h2>
        <p className="mt-3 leading-7 text-[#40513d]">{state.message}</p>
        <p className="mt-3 font-semibold text-[#28372c]">
          Reference: {state.requestNumber}
        </p>
      </div>
    );
  const field =
    "mt-2 min-h-12 w-full rounded-md border border-[#d8d0c4] bg-[#fcfaf6] px-4 text-sm font-normal text-[#1d1e19] outline-none transition focus:border-[#28372c] focus:ring-2 focus:ring-[#28372c]/20";
  return (
    <form action={action} className="grid gap-6 sm:grid-cols-2">
      <input
        type="hidden"
        name="productItems"
        value={JSON.stringify(
          items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          })),
        )}
      />
      <label className="hidden" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="text-sm font-semibold text-[#1d1e19]">
        Name *<input className={field} name="name" required />
      </label>
      <label className="text-sm font-semibold text-[#1d1e19]">
        Phone *<input className={field} name="phone" type="tel" required />
      </label>
      <label className="text-sm font-semibold text-[#1d1e19]">
        Email
        <input className={field} name="email" type="email" />
      </label>
      <label className="text-sm font-semibold text-[#1d1e19]">
        Company
        <input className={field} name="company" />
      </label>
      <div className="border-y border-[#d8d0c4] py-6 sm:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[#1d1e19]">
              Products of interest
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#6d695f]">
              Add every product you want us to include. Quantity is optional.
            </p>
          </div>
          <label className="sr-only" htmlFor="quote-product-picker">
            Add a product
          </label>
          <select
            className="min-h-11 max-w-full rounded-md border border-[#d8d0c4] bg-[#fcfaf6] px-3 text-sm text-[#1d1e19] outline-none focus:border-[#28372c] focus:ring-2 focus:ring-[#28372c]/20"
            id="quote-product-picker"
            onChange={(event) => {
              addProduct(event.target.value);
              event.currentTarget.value = "";
            }}
            value=""
          >
            <option value="">Add a product</option>
            {availableProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} - {product.category}
              </option>
            ))}
          </select>
        </div>
        {items.length ? (
          <ul className="mt-5 grid gap-3">
            {items.map((item) => {
              const product = products.find(
                (candidate) => candidate.id === item.id,
              );
              if (!product) return null;
              return (
                <li
                  className="grid gap-3 rounded-md bg-[#e7ded0]/55 p-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
                  key={item.id}
                >
                  <p className="font-semibold text-[#1d1e19]">
                    {product.name}
                    <span className="mt-1 block text-xs font-medium text-[#6d695f]">
                      {product.category}
                    </span>
                  </p>
                  <label className="text-sm font-semibold text-[#1d1e19]">
                    Quantity
                    <input
                      className={field}
                      min="0.001"
                      onChange={(event) =>
                        setQuantity(item.id, event.target.value)
                      }
                      step="0.001"
                      type="number"
                      value={item.quantity}
                    />
                  </label>
                  <button
                    className="min-h-11 text-sm font-semibold text-[#40513d] underline decoration-[#40513d]/35 underline-offset-4 hover:text-[#1d1e19]"
                    onClick={() => removeProduct(item.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-5 text-sm leading-6 text-[#6d695f]">
            No product selected yet. Describe what you need below if you are
            still exploring.
          </p>
        )}
      </div>
      <label className="text-sm font-semibold text-[#1d1e19]">
        Preferred branch
        <select className={field} name="branchId">
          <option value="">No preference</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-[#1d1e19] sm:col-span-2">
        Project details
        <textarea
          className="mt-2 w-full rounded-md border border-[#d8d0c4] bg-[#fcfaf6] p-4 text-sm font-normal text-[#1d1e19] outline-none transition focus:border-[#28372c] focus:ring-2 focus:ring-[#28372c]/20"
          name="message"
          rows={5}
          maxLength={2000}
        />
      </label>
      {state.message ? (
        <p className="text-sm text-[#9a3f34] sm:col-span-2" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="min-h-12 rounded-full bg-[#28372c] px-6 text-sm font-semibold text-[#f8f5ef] transition-colors hover:bg-[#1d1e19] disabled:cursor-not-allowed disabled:bg-[#6d695f] sm:col-span-2"
        disabled={pending}
      >
        {pending ? "Sending..." : "Send quotation request"}
      </button>
      <p className="text-xs leading-5 text-[#6d695f] sm:col-span-2">
        By submitting, you ask SAT-J Ent to contact you about this enquiry.
      </p>
    </form>
  );
}
