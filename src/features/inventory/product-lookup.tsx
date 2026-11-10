"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { formatGhs } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type ProductLookupResult = {
  product_id: string;
  variant_id: string;
  item_code: string;
  product_name: string;
  variant_name: string;
  category_name: string;
  product_type_name?: string | null;
  brand_name: string | null;
  unit_name: string;
  unit_code: string;
  unit_symbol: string;
  allows_decimal: boolean;
  image_path: string | null;
  inventory_id: string | null;
  quantity_on_hand: number | string | null;
  minimum_stock_level: number | string | null;
  stock_status: string;
  standard_selling_price: number | string | null;
  wholesale_selling_price?: number | string | null;
  branch_breakdown: {
    branchId: string;
    branchName: string;
    quantity: number | string;
    minimum: number | string;
    status: string;
  }[];
};

type Branch = { id: string; name: string };

export function ProductLookup({
  branches,
  initialBranchId = "",
  onSelect,
  branchId: controlledBranchId,
  onBranchChange,
  showBranchSelector = true,
  clearOnSelect = false,
  title = "Quick product lookup",
  description = "Search by Item Code or product name to see the right variant, branch balance and current standard selling price.",
}: {
  branches: Branch[];
  initialBranchId?: string;
  onSelect?: (result: ProductLookupResult) => void;
  branchId?: string;
  onBranchChange?: (branchId: string) => void;
  showBranchSelector?: boolean;
  clearOnSelect?: boolean;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState("");
  const [internalBranchId, setInternalBranchId] = useState(initialBranchId);
  const [results, setResults] = useState<ProductLookupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const branchId = controlledBranchId ?? internalBranchId;

  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage("Searching products…");
      try {
        const params = new URLSearchParams({ q: term });
        if (branchId) params.set("branchId", branchId);
        const response = await fetch(`/api/app/product-lookup?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          results?: ProductLookupResult[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Search failed.");
        setResults(payload.results ?? []);
        setActiveIndex(-1);
        setOpen(true);
        setMessage(
          payload.results?.length
            ? `${payload.results.length} matching ${payload.results.length === 1 ? "item" : "items"}. Use the arrow keys to choose.`
            : "No active items match this search.",
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setMessage(
            error instanceof Error
              ? error.message
              : "Product search is temporarily unavailable.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [branchId, query]);

  const choose = (result: ProductLookupResult) => {
    setOpen(false);
    if (onSelect) {
      onSelect(result);
      if (clearOnSelect) {
        setQuery("");
        setResults([]);
        setMessage("");
      }
      return;
    }
    router.push(
      result.inventory_id
        ? `/app/inventory/${result.inventory_id}`
        : `/app/products/${result.product_id}`,
    );
  };

  const keyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? results.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div
        className={
          showBranchSelector
            ? "grid gap-3 md:grid-cols-[minmax(12rem,0.8fr)_minmax(16rem,1.2fr)]"
            : "grid gap-3"
        }
      >
        {showBranchSelector ? (
          <label className="text-sm font-medium">
            Branch
            <select
              className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
              value={branchId}
              onChange={(event) => {
                const value = event.target.value;
                if (onBranchChange) onBranchChange(value);
                else setInternalBranchId(value);
              }}
            >
              <option value="">All authorized active branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="relative text-sm font-medium">
          Search products
          <span className="pointer-events-none absolute bottom-3 left-3 text-muted-foreground">
            <Search aria-hidden="true" className="size-4" />
          </span>
          <Input
            aria-autocomplete="list"
            aria-controls={`${id}-results`}
            aria-expanded={open && results.length > 0}
            aria-activedescendant={
              activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
            }
            autoComplete="off"
            className="mt-1 pl-9"
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setOpen(true);
              if (!value.trim()) {
                setResults([]);
                setMessage("");
                setActiveIndex(-1);
              }
            }}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={keyDown}
            placeholder="Item Code or product name"
            role="combobox"
            value={query}
          />
        </label>
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {loading ? "Searching…" : message || "Type to search active products."}
      </p>
      {open && results.length ? (
        <ul
          className="max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto"
          id={`${id}-results`}
          role="listbox"
          aria-label="Product search results"
        >
          {results.map((result, index) => (
            <li key={result.variant_id} role="presentation">
              <button
                aria-selected={activeIndex === index}
                className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${activeIndex === index ? "border-primary bg-secondary" : "border-border hover:bg-secondary"}`}
                id={`${id}-option-${index}`}
                onClick={() => choose(result)}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                type="button"
              >
                <span className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-primary">
                      Item Code {result.item_code}
                    </span>
                    <span className="mt-1 block font-semibold text-foreground">
                      {result.product_name}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {result.variant_name} · {result.category_name}
                      {result.product_type_name
                        ? ` · ${result.product_type_name}`
                        : ""}
                      {result.brand_name ? ` · ${result.brand_name}` : ""}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {result.standard_selling_price == null
                      ? "Price not set"
                      : `${formatGhs(result.standard_selling_price)} / ${result.unit_symbol}`}
                  </span>
                </span>
                <span className="mt-2 block text-sm text-muted-foreground">
                  {result.stock_status === "NOT_INITIALIZED"
                    ? "Stock not initialized"
                    : `${Number(result.quantity_on_hand).toLocaleString()} ${result.unit_symbol} · ${result.stock_status.replaceAll("_", " ")}`}
                  {branchId
                    ? " at selected branch"
                    : " across authorized branches"}
                </span>
                {!branchId && result.branch_breakdown.length ? (
                  <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {result.branch_breakdown.map((branch) => (
                      <span key={branch.branchId}>
                        {branch.branchName}:{" "}
                        {Number(branch.quantity).toLocaleString()}{" "}
                        {result.unit_symbol}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
