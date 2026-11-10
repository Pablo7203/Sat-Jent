/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  changePrice,
  deleteProduct,
  deleteProductImage,
  setProductStatus,
} from "@/features/catalog/actions";
import { ItemCodeForm, ProductImageForm } from "@/features/catalog/forms";
import { formatGhs } from "@/lib/format";
import { formatQuantity, movementLabel } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

function related<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("products.read");
  const { id } = await params;
  const s = await createClient();
  const { data: p } = await s
    .from("products")
    .select(
      "id,name,description,size,colour,status,is_public,category:categories(name),product_type:product_types(name),brand:brands(name),unit:units_of_measure(name,code),product_images(id,storage_path,alt_text,is_primary,sort_order),product_variants(id,name,sku,barcode,is_default,is_active,product_prices(id,price_type,amount,currency,effective_from,effective_to,branch:branches(name)))",
    )
    .eq("id", id)
    .single();
  if (!p) notFound();
  const variants = p.product_variants ?? [];
  const variantIds = variants.map((variant) => variant.id);
  const [{ data: branchStock }, { data: recentMovements }] =
    context.permissions.includes("inventory.read") && variantIds.length
      ? await Promise.all([
          s
            .from("inventory_catalog")
            .select(
              "id,branch_id,branch_name,variant_id,sku,variant_name,quantity_on_hand,minimum_stock_level,stock_status,unit_symbol,last_movement_at",
            )
            .eq("product_id", id)
            .order("branch_name")
            .order("sku"),
          s
            .from("stock_movements")
            .select(
              "id,occurred_at,movement_type,quantity_delta,balance_after,branch:branches(name),variant:product_variants(sku,name)",
            )
            .in("variant_id", variantIds)
            .order("occurred_at", { ascending: false })
            .limit(10),
        ])
      : [{ data: [] }, { data: [] }];
  const canRemoveImage = !p.is_public || (p.product_images?.length ?? 0) > 1;
  const imagePreviews = await Promise.all(
    (p.product_images ?? [])
      .sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) ||
          a.sort_order - b.sort_order,
      )
      .map(async (image) => ({
        ...image,
        url: (
          await s.storage
            .from("product-images")
            .createSignedUrl(image.storage_path, 60 * 60)
        ).data?.signedUrl,
      })),
  );
  const category = related(p.category);
  const productType = related(p.product_type);
  const brand = related(p.brand);
  const unit = related(p.unit);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          backHref="/app/products"
          title={p.name}
          description={`${category?.name ?? "Uncategorised"}${productType?.name ? ` · ${productType.name}` : ""} · ${brand?.name ?? "Unbranded"} · ${unit?.code ?? ""}`}
        />
        <div className="flex gap-2">
          {context.permissions.includes("products.update") ? (
            <ButtonLink href={`/app/products/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
          ) : null}
          {context.permissions.includes("products.archive") &&
          p.status !== "ARCHIVED" ? (
            <form action={setProductStatus}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="ARCHIVED" />
              <Button variant="danger">Archive</Button>
            </form>
          ) : null}
          {context.permissions.includes("products.delete") &&
          p.status === "DRAFT" &&
          !p.is_public ? (
            <form action={deleteProduct} className="flex items-center gap-2">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="confirmDelete" value="yes" />
              <Button variant="danger">Delete draft</Button>
            </form>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="mt-1 font-bold">{p.status}</p>
          <p className="mt-4 text-sm text-muted-foreground">Visibility</p>
          <p className="mt-1 font-bold">
            {p.is_public ? "Public" : "Internal"}
          </p>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="font-bold">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {p.description || "No description."}
          </p>
        </Card>
      </div>
      <Card>
        <h2 className="font-bold">Product details</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Product type</dt>
            <dd className="mt-1 font-semibold">
              {productType?.name || "Not specified"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Size</dt>
            <dd className="mt-1 font-semibold">{p.size || "Not specified"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Colour</dt>
            <dd className="mt-1 font-semibold">
              {p.colour || "Not specified"}
            </dd>
          </div>
        </dl>
      </Card>
      <section>
        <h2 className="mb-3 text-xl font-bold">Product images</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {imagePreviews.map((image) => {
            const url = image.url;
            return (
              <Card key={image.id}>
                {url ? (
                  <img
                    src={url}
                    alt={image.alt_text ?? p.name}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <p className="grid aspect-square place-items-center rounded-lg bg-secondary p-4 text-center text-sm text-muted-foreground">
                    Image preview is unavailable. Try uploading the image again.
                  </p>
                )}
                {image.is_primary ? (
                  <p className="mt-2 text-xs font-semibold text-primary">
                    Primary image
                  </p>
                ) : null}
                {context.permissions.includes("product_images.manage") &&
                canRemoveImage ? (
                  <form action={deleteProductImage} className="mt-2">
                    <input type="hidden" name="productId" value={id} />
                    <input type="hidden" name="imageId" value={image.id} />
                    <Button variant="danger">Remove</Button>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </div>
        {p.is_public && (p.product_images?.length ?? 0) === 1 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            This is the last image on a public product. Make the product
            internal before removing it.
          </p>
        ) : null}
        {context.permissions.includes("product_images.manage") ? (
          <Card className="mt-4">
            <ProductImageForm productId={id} />
          </Card>
        ) : null}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Sellable variants</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {variants.map((v) => (
            <Card key={v.id}>
              <div className="flex justify-between">
                <div>
                  <h3 className="font-bold">{v.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Item Code {v.sku}
                    {v.barcode ? ` · Barcode ${v.barcode}` : ""}
                  </p>
                </div>
                {v.is_default ? (
                  <span className="text-xs font-semibold text-primary">
                    Default
                  </span>
                ) : null}
              </div>
              {context.permissions.includes("products.update") ? (
                <ItemCodeForm
                  productId={id}
                  variantId={v.id}
                  itemCode={v.sku}
                />
              ) : null}
              <div className="mt-4 space-y-2">
                {v.product_prices
                  ?.filter((x) => {
                    const now = Date.now();
                    return (
                      new Date(x.effective_from).getTime() <= now &&
                      (!x.effective_to ||
                        new Date(x.effective_to).getTime() > now)
                    );
                  })
                  .map((price) => {
                    const branch = related(price.branch);
                    return (
                      <p
                        key={price.id}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {price.price_type}
                          {branch ? ` · ${branch.name}` : " · Company"}
                        </span>
                        <strong>{formatGhs(price.amount)}</strong>
                      </p>
                    );
                  })}
                {context.permissions.includes("product_prices.manage") ? (
                  <form
                    action={changePrice}
                    className="mt-4 flex flex-wrap gap-2"
                  >
                    <input type="hidden" name="variantId" value={v.id} />
                    <label className="grid gap-1 text-xs text-muted-foreground">
                      Branch scope
                      <select
                        name="branchId"
                        className="min-h-11 rounded-lg border bg-surface px-2 text-sm text-foreground"
                      >
                        <option value="">Company standard</option>
                        {context.accessibleBranches
                          .filter((branch) => branch.isActive)
                          .map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <select
                      name="priceType"
                      className="min-h-11 rounded-lg border bg-surface px-2"
                    >
                      <option>RETAIL</option>
                      <option>WHOLESALE</option>
                    </select>
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="GHS"
                      className="min-h-11 w-28 rounded-lg border bg-surface px-3"
                    />
                    <Button>Set price</Button>
                  </form>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </section>
      {context.permissions.includes("inventory.read") ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Stock by branch</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Quantities are ledger-backed and limited to your authorized
                branches.
              </p>
            </div>
            <ButtonLink
              href={`/app/inventory?q=${encodeURIComponent(variants[0]?.sku ?? p.name)}`}
              variant="secondary"
            >
              Open inventory
            </ButtonLink>
          </div>
          {branchStock?.length ? (
            <div className="space-y-2">
              {branchStock.map((row) => (
                <Card key={row.id}>
                  <Link
                    className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                    href={`/app/inventory/${row.id}`}
                  >
                    <span>
                      <strong>{row.branch_name}</strong>
                      <span className="block text-sm text-muted-foreground">
                        Item Code {row.sku} · {row.variant_name}
                      </span>
                    </span>
                    <span className="font-semibold">
                      {formatQuantity(row.quantity_on_hand, row.unit_symbol)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        Minimum{" "}
                        {formatQuantity(
                          row.minimum_stock_level,
                          row.unit_symbol,
                        )}
                      </span>
                    </span>
                    <span className="text-sm font-medium">
                      {row.stock_status.replaceAll("_", " ")}
                    </span>
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-sm text-muted-foreground">
              No stock position has been initialized for this product in your
              authorized branches.
            </Card>
          )}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Recent stock movements</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Posted movement records are immutable.
                </p>
              </div>
              <ButtonLink href="/app/inventory/movements" variant="secondary">
                Full movement history
              </ButtonLink>
            </div>
            {recentMovements?.length ? (
              <ul className="mt-4 divide-y divide-border">
                {recentMovements.map((movement) => {
                  const variant = related(movement.variant);
                  const branch = related(movement.branch);
                  return (
                    <li
                      className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                      key={movement.id}
                    >
                      <span>
                        {movementLabel(movement.movement_type)} · Item Code{" "}
                        {variant?.sku}
                        <span className="block text-muted-foreground">
                          {branch?.name} ·{" "}
                          {new Date(movement.occurred_at).toLocaleString()}
                        </span>
                      </span>
                      <strong>
                        {movement.quantity_delta > 0 ? "+" : ""}
                        {formatQuantity(movement.quantity_delta)} · balance{" "}
                        {formatQuantity(movement.balance_after)}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No movements recorded for this product yet.
              </p>
            )}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
