import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setProductStatus,
  setVariantAttribute,
  updateProduct,
} from "@/features/catalog/actions";
import {
  ProductClassificationFields,
  VariantForm,
} from "@/features/catalog/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
function related<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const context = await requirePermission("products.update");
  const { id } = await params;
  const s = await createClient();
  const [
    { data: p },
    { data: categories },
    { data: productTypes },
    { data: brands },
    { data: units },
  ] = await Promise.all([
    s
      .from("products")
      .select(
        "*,product_images(id),product_variants(id,name,sku,barcode,is_active,is_default,variant_attribute_values(attribute_id,attribute_value_id,text_value,number_value,boolean_value))",
      )
      .eq("id", id)
      .single(),
    s.from("categories").select("id,name,is_active").order("name"),
    s
      .from("product_types")
      .select("id,category_id,name,is_active")
      .order("name"),
    s.from("brands").select("id,name,is_active").order("name"),
    s.from("units_of_measure").select("id,name,code,is_active").order("name"),
  ]);
  if (!p) notFound();
  const query = await searchParams;
  const hasProductImage = (p.product_images?.length ?? 0) > 0;
  const { data: mappings } = await s
    .from("category_attributes")
    .select(
      "is_required,attribute:attributes(id,name,data_type,attribute_values(id,value,is_active))",
    )
    .eq("category_id", p.category_id)
    .order("sort_order");
  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/app/products/${id}`}
        title={`Edit ${p.name}`}
        description="Reference records in use remain visible even when inactive."
      />
      {query.error === "classification" ? (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        >
          The product could not be saved. Check that the selected product type
          belongs to its category and that your changes meet the category
          requirements.
        </p>
      ) : null}
      <Card>
        <form action={updateProduct} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={id} />
          <Label>
            Name
            <Input
              className="mt-1"
              name="name"
              defaultValue={p.name}
              required
            />
          </Label>
          <ProductClassificationFields
            categories={(categories ?? []).map((category) => ({
              id: category.id,
              name: `${category.name}${category.is_active ? "" : " (inactive)"}`,
            }))}
            productTypes={productTypes ?? []}
            defaultCategoryId={p.category_id}
            defaultProductTypeId={p.product_type_id ?? ""}
          />
          <Label>
            Brand
            <select
              name="brandId"
              defaultValue={p.brand_id ?? ""}
              className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
            >
              <option value="">No brand</option>
              {brands?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {!x.is_active ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </Label>
          <Label>
            Unit
            <select
              name="unitId"
              defaultValue={p.unit_of_measure_id}
              className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
            >
              {units?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.code}){!x.is_active ? " · inactive" : ""}
                </option>
              ))}
            </select>
          </Label>
          <Label className="sm:col-span-2">
            Description
            <textarea
              name="description"
              defaultValue={p.description ?? ""}
              rows={5}
              className="mt-1 w-full rounded-lg border bg-surface p-3"
            />
          </Label>
          <Label>
            Size
            <Input
              className="mt-1"
              name="size"
              defaultValue={p.size ?? ""}
              placeholder="e.g. 60 × 60 cm"
            />
          </Label>
          <Label>
            Colour
            <Input
              className="mt-1"
              name="colour"
              defaultValue={p.colour ?? ""}
              placeholder="e.g. Warm white"
            />
          </Label>
          <div>
            {hasProductImage ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isPublic"
                  defaultChecked={p.is_public}
                />{" "}
                Publicly visible
              </label>
            ) : (
              <>
                <input name="isPublic" type="hidden" value="false" />
                <p className="text-sm text-muted-foreground">
                  Upload a product image before publishing this product to the
                  website.
                </p>
              </>
            )}
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="showPriceOnline"
              defaultChecked={p.show_price_online}
            />
            Show retail price online
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={p.is_featured}
            />
            Feature on public website
          </label>
          <div className="sm:col-span-2">
            <Button>Save product</Button>
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="font-bold">Lifecycle</h2>
        <p className="my-3 text-sm text-muted-foreground">
          Activation is rejected unless the category and unit are active and
          every active variant satisfies required attributes.
        </p>
        <div className="flex gap-2">
          {p.status !== "ACTIVE" ? (
            <form action={setProductStatus}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="ACTIVE" />
              <Button>Activate</Button>
            </form>
          ) : null}
          {p.status !== "DRAFT" ? (
            <form action={setProductStatus}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="DRAFT" />
              <Button variant="secondary">Return to draft</Button>
            </form>
          ) : null}
          {context.permissions.includes("products.archive") &&
          p.status !== "ARCHIVED" ? (
            <form action={setProductStatus}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="ARCHIVED" />
              <Button variant="danger">Archive</Button>
            </form>
          ) : null}
        </div>
      </Card>
      <Card>
        <h2 className="font-bold">Variants</h2>
        <div className="my-3 space-y-2">
          {p.product_variants?.map(
            (v: {
              id: string;
              name: string;
              sku: string;
              barcode: string | null;
              is_default: boolean;
              variant_attribute_values: {
                attribute_id: string;
                attribute_value_id: string | null;
                text_value: string | null;
                number_value: number | null;
                boolean_value: boolean | null;
              }[];
            }) => (
              <div key={v.id} className="rounded-lg border p-3">
                <p className="text-sm">
                  <strong>{v.name}</strong> · Item Code {v.sku}
                  {v.barcode ? ` · ${v.barcode}` : ""}
                  {v.is_default ? " · Default" : ""}
                </p>
                {mappings?.map((mapping) => {
                  const attribute = related(mapping.attribute);
                  if (!attribute) return null;
                  const current = v.variant_attribute_values.find(
                    (x) => x.attribute_id === attribute.id,
                  );
                  const currentValue =
                    current?.attribute_value_id ??
                    current?.text_value ??
                    current?.number_value?.toString() ??
                    current?.boolean_value?.toString() ??
                    "";
                  return (
                    <form
                      action={setVariantAttribute}
                      key={attribute.id}
                      className="mt-3 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="productId" value={id} />
                      <input type="hidden" name="variantId" value={v.id} />
                      <input
                        type="hidden"
                        name="attributeId"
                        value={attribute.id}
                      />
                      <input
                        type="hidden"
                        name="dataType"
                        value={attribute.data_type}
                      />
                      <Label className="min-w-48 flex-1">
                        {attribute.name}
                        {mapping.is_required ? " *" : ""}
                        {attribute.data_type === "SELECT" ? (
                          <select
                            name="value"
                            defaultValue={currentValue}
                            required
                            className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
                          >
                            <option value="">Choose…</option>
                            {attribute.attribute_values
                              .filter((x) => x.is_active)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.value}
                                </option>
                              ))}
                          </select>
                        ) : attribute.data_type === "BOOLEAN" ? (
                          <select
                            name="value"
                            defaultValue={currentValue}
                            className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : (
                          <Input
                            name="value"
                            type={
                              attribute.data_type === "NUMBER"
                                ? "number"
                                : "text"
                            }
                            step={
                              attribute.data_type === "NUMBER"
                                ? "any"
                                : undefined
                            }
                            defaultValue={currentValue}
                            required
                          />
                        )}
                      </Label>
                      <Button variant="secondary">Save attribute</Button>
                    </form>
                  );
                })}
              </div>
            ),
          )}
        </div>
        {p.status === "DRAFT" ? (
          <VariantForm productId={id} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Return the product to draft before adding a variant, so required
            attributes can be completed before activation.
          </p>
        )}
      </Card>
    </div>
  );
}
