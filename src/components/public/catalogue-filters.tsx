"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { PublicAttributeFilter, PublicCategory } from "@/lib/public-data";

type Props = {
  q: Record<string, string | undefined>;
  categories: PublicCategory[];
  brands: { name: string; slug: string }[];
  attributes: PublicAttributeFilter[];
  total: number;
  children: ReactNode;
};

type FilterFieldsProps = Omit<Props, "total" | "children"> & {
  compact?: boolean;
};

function queryValue(q: Props["q"], key: string) {
  return q[key] ?? "";
}

function FilterFields({
  q,
  categories,
  brands,
  attributes,
  compact,
}: FilterFieldsProps) {
  return (
    <div className={compact ? "grid gap-6" : "grid gap-7"}>
      <label className="grid gap-2 text-sm font-semibold text-[#1d1e19]">
        Category
        <select
          className="min-h-11 rounded-md border border-[#d8d0c4] bg-[#fcfaf6] px-3 text-sm font-normal text-[#1d1e19] outline-none transition focus:border-[#28372c] focus:ring-2 focus:ring-[#28372c]/20"
          defaultValue={queryValue(q, "category")}
          name="category"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-[#1d1e19]">
        Brand
        <select
          className="min-h-11 rounded-md border border-[#d8d0c4] bg-[#fcfaf6] px-3 text-sm font-normal text-[#1d1e19] outline-none transition focus:border-[#28372c] focus:ring-2 focus:ring-[#28372c]/20"
          defaultValue={queryValue(q, "brand")}
          name="brand"
        >
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.slug} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
      {attributes.map((attribute, index) => (
        <details
          className="border-t border-[#d8d0c4] pt-5"
          key={attribute.key}
          open={index < 2}
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-[#1d1e19] [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-4">
              {attribute.name}
              <span
                aria-hidden="true"
                className="text-lg font-normal text-[#6d695f]"
              >
                +
              </span>
            </span>
          </summary>
          <div className="mt-4 grid gap-3">
            {attribute.values.map((value) => {
              const id = `${compact ? "mobile" : "desktop"}-${attribute.key}-${value.key}`;
              return (
                <label
                  className="flex cursor-pointer items-center gap-3 text-sm text-[#5e5a52]"
                  htmlFor={id}
                  key={value.key}
                >
                  <input
                    className="h-4 w-4 rounded-[2px] border-[#bdb4a6] accent-[#28372c]"
                    defaultChecked={q[attribute.key] === value.key}
                    id={id}
                    name={attribute.key}
                    type="radio"
                    value={value.key}
                  />
                  {value.label}
                </label>
              );
            })}
          </div>
        </details>
      ))}
      <label className="grid gap-2 border-t border-[#d8d0c4] pt-5 text-sm font-semibold text-[#1d1e19]">
        Availability
        <span className="text-sm font-normal leading-6 text-[#6d695f]">
          Availability is shown on each product card. Exact stock quantities
          remain private.
        </span>
      </label>
    </div>
  );
}

export function CatalogueFilters({
  q,
  categories,
  brands,
  attributes,
  total,
  children,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = [
    q.category,
    q.brand,
    ...attributes.map((attribute) => q[attribute.key]),
  ].filter(Boolean) as string[];
  const activeLabels = [
    q.category
      ? categories.find((category) => category.slug === q.category)?.name
      : null,
    q.brand ? brands.find((brand) => brand.slug === q.brand)?.name : null,
    ...attributes.flatMap((attribute) =>
      attribute.values
        .filter((value) => q[attribute.key] === value.key)
        .map((value) => value.label),
    ),
  ].filter(Boolean) as string[];
  const clearPath = "/products";

  return (
    <>
      <form
        action="/products"
        className="mt-9 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]"
      >
        <label className="relative block">
          <span className="sr-only">Search products</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6d695f]"
            size={18}
            strokeWidth={1.7}
          />
          <input
            className="min-h-[52px] w-full rounded-md border border-[#d8d0c4] bg-[#fcfaf6] pl-11 pr-4 text-sm text-[#1d1e19] outline-none placeholder:text-[#8a8478] focus:border-[#28372c] focus:ring-2 focus:ring-[#28372c]/20"
            defaultValue={q.q}
            name="q"
            placeholder="Search products, brands or SKU"
          />
          {q.category ? (
            <input name="category" type="hidden" value={q.category} />
          ) : null}
          {q.brand ? (
            <input name="brand" type="hidden" value={q.brand} />
          ) : null}
          {attributes.map((attribute) =>
            q[attribute.key] ? (
              <input
                key={attribute.key}
                name={attribute.key}
                type="hidden"
                value={q[attribute.key]}
              />
            ) : null,
          )}
        </label>
        <label className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-md border border-[#d8d0c4] bg-[#fcfaf6] px-4 text-sm font-semibold text-[#1d1e19]">
          Sort
          <select
            className="min-h-[50px] min-w-0 bg-transparent text-right font-normal outline-none"
            defaultValue={q.sort ?? "recommended"}
            name="sort"
          >
            <option value="recommended">Recommended</option>
            <option value="newest">Newest</option>
            <option value="name">Name A-Z</option>
          </select>
        </label>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#d8d0c4] pb-5">
        <p className="text-sm text-[#6d695f]">
          <span className="font-semibold text-[#1d1e19]">{total}</span>{" "}
          {total === 1 ? "product" : "products"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {activeLabels.map((label) => (
            <span
              className="rounded-full bg-[#e7ded0] px-3 py-1.5 text-xs font-medium text-[#28372c]"
              key={label}
            >
              {label}
            </span>
          ))}
          {active.length ? (
            <a
              className="px-2 py-1.5 text-xs font-semibold text-[#28372c] underline-offset-4 hover:underline"
              href={clearPath}
            >
              Clear all
            </a>
          ) : null}
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#28372c] px-4 text-sm font-semibold text-[#28372c] lg:hidden"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.7} />{" "}
            Filters{active.length ? ` (${active.length})` : ""}
          </button>
        </div>
      </div>

      <div className="mt-9 grid gap-8 lg:grid-cols-[252px_minmax(0,1fr)] lg:gap-10">
        <aside className="sticky top-24 hidden self-start border-t border-[#d8d0c4] pt-5 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6d695f]">
            Filters
          </p>
          <form action="/products" className="mt-6">
            {q.q ? <input name="q" type="hidden" value={q.q} /> : null}
            {q.sort ? <input name="sort" type="hidden" value={q.sort} /> : null}
            <FilterFields
              attributes={attributes}
              brands={brands}
              categories={categories}
              q={q}
            />
            <div className="mt-8 grid gap-3">
              <button className="min-h-11 rounded-full bg-[#28372c] px-4 text-sm font-semibold text-[#f8f5ef] transition-colors hover:bg-[#1d1e19] active:translate-y-px">
                Apply filters
              </button>
              {active.length ? (
                <a
                  className="min-h-11 px-4 py-3 text-center text-sm font-semibold text-[#28372c] hover:underline"
                  href={clearPath}
                >
                  Clear filters
                </a>
              ) : null}
            </div>
          </form>
        </aside>
        <div>{children}</div>
      </div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[#1d1e19]/35 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Product filters"
        >
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-xl bg-[#fcfaf6] px-5 pb-7 pt-5 shadow-[0_-18px_40px_rgb(29_30_25_/_0.18)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-[-0.025em] text-[#1d1e19]">
                Filters
              </h2>
              <button
                aria-label="Close filters"
                className="flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[#d8d0c4] text-[#28372c]"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                <X size={18} strokeWidth={1.7} />
              </button>
            </div>
            <form action="/products" className="mt-7">
              {q.q ? <input name="q" type="hidden" value={q.q} /> : null}
              {q.sort ? (
                <input name="sort" type="hidden" value={q.sort} />
              ) : null}
              <FilterFields
                attributes={attributes}
                brands={brands}
                categories={categories}
                compact
                q={q}
              />
              <div className="mt-8 grid grid-cols-2 gap-3">
                <a
                  className="min-h-11 rounded-full border border-[#28372c] px-4 py-3 text-center text-sm font-semibold text-[#28372c]"
                  href={clearPath}
                >
                  Clear
                </a>
                <button className="min-h-11 rounded-full bg-[#28372c] px-4 text-sm font-semibold text-[#f8f5ef]">
                  Show {total} {total === 1 ? "product" : "products"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
