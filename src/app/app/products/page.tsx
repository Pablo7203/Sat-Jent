import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatGhs } from "@/lib/format";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

function related<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? ((value[0] as T | undefined) ?? null) : value;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await requirePermission("products.read");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const size = 25;
  const term = (query.q ?? "").replace(/[,%()]/g, " ").trim();
  const supabase = await createClient();
  let request = supabase
    .from("sellable_product_catalog")
    .select("*", { count: "exact" });
  if (term) request = request.ilike("search_terms", `%${term}%`);
  if (query.status) request = request.eq("status", query.status);
  if (query.category) request = request.eq("category_id", query.category);
  if (query.brand) request = request.eq("brand_id", query.brand);
  const [{ data: products, count }, { data: categories }, { data: brands }] =
    await Promise.all([
      request
        .order("product_name")
        .order("item_code")
        .range((page - 1) * size, page * size - 1),
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("brands").select("id,name").order("name"),
    ]);
  const productIds = [
    ...new Set((products ?? []).map((product) => product.product_id)),
  ];
  const { data: classifications } = productIds.length
    ? await supabase
        .from("products")
        .select("id,product_type:product_types(name)")
        .in("id", productIds)
    : { data: [] };
  const typeByProduct = new Map(
    (classifications ?? []).map((item) => [
      item.id,
      related(item.product_type)?.name ?? null,
    ]),
  );

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.status) params.set("status", query.status);
    if (query.category) params.set("category", query.category);
    if (query.brand) params.set("brand", query.brand);
    params.set("page", String(nextPage));
    return `?${params}`;
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Products"
          description="Find each sellable item by its Item Code, then manage product details and pricing."
        />
        {context.permissions.includes("products.create") ? (
          <ButtonLink href="/app/products/new">New product</ButtonLink>
        ) : null}
      </div>
      <Card>
        <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Input
            name="q"
            aria-label="Search products"
            defaultValue={query.q}
            placeholder="Item Code, product name or barcode"
            className="xl:col-span-2"
          />
          <select
            name="status"
            defaultValue={query.status}
            aria-label="Product status"
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <select
            name="category"
            defaultValue={query.category}
            aria-label="Category"
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All categories</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              name="brand"
              defaultValue={query.brand}
              aria-label="Brand"
              className="min-h-11 min-w-0 flex-1 rounded-lg border bg-surface px-3"
            >
              <option value="">All brands</option>
              {brands?.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            <button className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
              Search
            </button>
          </div>
        </form>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category / Brand</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3 text-right">Standard selling price</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {products?.map((product) => (
                <tr
                  className="border-t border-border align-top hover:bg-secondary/60"
                  key={product.variant_id}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-primary">
                    {product.item_code}
                    {!product.variant_is_active ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Variant inactive
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-semibold hover:text-primary focus-visible:outline"
                      href={`/app/products/${product.product_id}`}
                    >
                      {product.product_name}
                    </Link>
                    <p className="mt-1 text-muted-foreground">
                      {product.variant_name}
                      {product.size ? ` · ${product.size}` : ""}
                      {product.colour ? ` · ${product.colour}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {product.category_name}
                    {typeByProduct.get(product.product_id)
                      ? ` · ${typeByProduct.get(product.product_id)}`
                      : ""}
                    <span className="block">{product.brand_name ?? "—"}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {product.unit_name} ({product.unit_code})
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                    {context.permissions.includes("product_prices.read")
                      ? product.standard_retail_price == null
                        ? "Price not set"
                        : formatGhs(product.standard_retail_price)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{product.status}</td>
                </tr>
              ))}
              {!products?.length ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    No products match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          Showing {products?.length ?? 0} of {count ?? 0} sellable items.
        </p>
        <div className="flex gap-4">
          {page > 1 ? (
            <Link
              className="font-medium text-primary"
              href={pageHref(page - 1)}
            >
              Previous
            </Link>
          ) : null}
          {(count ?? 0) > page * size ? (
            <Link
              className="font-medium text-primary"
              href={pageHref(page + 1)}
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
