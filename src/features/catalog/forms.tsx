"use client";
import { ImageUp } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProduct,
  createProductType,
  createReference,
  toggleProductType,
  updateProductType,
  uploadProductImage,
  addVariant,
  updateVariantItemCode,
  type CatalogActionState,
} from "./actions";

const initial: CatalogActionState = { success: false };
const Select = ({
  name,
  label,
  children,
  required = true,
}: {
  name: string;
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) => (
  <Label>
    {label}
    <select
      name={name}
      required={required}
      className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
    >
      {children}
    </select>
  </Label>
);
const Field = ({
  name,
  label,
  required,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) => (
  <Label>
    {label}
    <Input
      className="mt-1 font-normal"
      name={name}
      required={required}
      type={type}
      placeholder={placeholder}
      step={type === "number" ? "0.01" : undefined}
      min={type === "number" ? "0" : undefined}
    />
  </Label>
);

export type ProductTypeOption = {
  id: string;
  category_id: string;
  name: string;
  is_active: boolean;
};

export function ProductTypeCreateForm({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createProductType, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <Label>
        Category
        <select
          name="categoryId"
          required
          defaultValue={categories[0]?.id ?? ""}
          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Label>
      <Label>
        Type name
        <Input
          name="name"
          required
          minLength={2}
          maxLength={100}
          placeholder="e.g. Floor tile"
        />
      </Label>
      <div className="self-end">
        <Button disabled={pending}>{pending ? "Adding…" : "Add type"}</Button>
      </div>
      {state.message ? (
        <p role="status" className="text-sm sm:col-span-3">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function ProductTypeList({
  items,
}: {
  items: (ProductTypeOption & { category_name: string })[];
}) {
  if (!items.length)
    return (
      <p className="text-sm text-muted-foreground">
        No product types yet. Add types only for categories that need them; type
        is optional on each product.
      </p>
    );
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {item.category_name}
              </p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs">
              {item.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <form
              action={updateProductType}
              className="flex min-w-0 flex-1 items-end gap-2"
            >
              <input type="hidden" name="id" value={item.id} />
              <Label className="min-w-0 flex-1">
                Type name
                <Input
                  name="name"
                  defaultValue={item.name}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </Label>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>
            <form action={toggleProductType}>
              <input type="hidden" name="id" value={item.id} />
              <input
                type="hidden"
                name="active"
                value={String(!item.is_active)}
              />
              <Button type="submit" variant="secondary">
                {item.is_active ? "Deactivate" : "Activate"}
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProductClassificationFields({
  categories,
  productTypes,
  defaultCategoryId,
  defaultProductTypeId = "",
}: {
  categories: { id: string; name: string }[];
  productTypes: ProductTypeOption[];
  defaultCategoryId?: string;
  defaultProductTypeId?: string;
}) {
  const [categoryId, setCategoryId] = useState(
    defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [productTypeId, setProductTypeId] = useState(defaultProductTypeId);
  const applicableTypes = productTypes.filter(
    (type) =>
      type.category_id === categoryId &&
      (type.is_active || type.id === defaultProductTypeId),
  );
  return (
    <>
      <Label>
        Category
        <select
          name="categoryId"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setProductTypeId("");
          }}
          required
          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Label>
      <Label>
        Product type{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
        <select
          name="productTypeId"
          value={productTypeId}
          onChange={(event) => setProductTypeId(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
        >
          <option value="">No specific type</option>
          {applicableTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
              {!type.is_active ? " (inactive)" : ""}
            </option>
          ))}
        </select>
        {applicableTypes.length === 0 ? (
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            No types are configured for this category.
          </span>
        ) : null}
      </Label>
    </>
  );
}

export function ProductForm({
  categories,
  productTypes,
  brands,
  units,
}: {
  categories: { id: string; name: string }[];
  productTypes: {
    id: string;
    category_id: string;
    name: string;
    is_active: boolean;
  }[];
  brands: { id: string; name: string }[];
  units: { id: string; name: string; code: string }[];
}) {
  const [state, action, pending] = useActionState(createProduct, initial);
  return (
    <form action={action} className="grid gap-5 sm:grid-cols-2">
      <Field name="name" label="Product name" required />
      <Field
        name="variantName"
        label="Sellable variant description"
        required
        placeholder="Standard or 60 × 60 · White"
      />
      <Label className="sm:col-span-2">
        Description
        <textarea
          name="description"
          rows={4}
          className="mt-1 w-full rounded-lg border bg-surface p-3"
        />
      </Label>
      <ProductClassificationFields
        categories={categories}
        productTypes={productTypes}
      />
      <Select name="brandId" label="Brand" required={false}>
        <option value="">No brand</option>
        {brands.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
      <Select name="unitId" label="Unit of measure">
        {units.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name} ({x.code})
          </option>
        ))}
      </Select>
      <Select name="status" label="Initial status">
        <option value="DRAFT">Draft</option>
        <option value="ACTIVE">Active</option>
      </Select>
      <Field
        name="itemCode"
        label="Item Code"
        required
        placeholder="e.g. TIL-001"
      />
      <Field name="barcode" label="Barcode (optional)" />
      <Field
        name="size"
        label="Size (optional)"
        placeholder="e.g. 60 × 60 cm"
      />
      <Field
        name="colour"
        label="Colour (optional)"
        placeholder="e.g. Warm white"
      />
      <Field name="retailPrice" label="Retail price (GHS)" type="number" />
      <Field
        name="wholesalePrice"
        label="Wholesale price (GHS)"
        type="number"
      />
      <p className="sm:col-span-2 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
        Item Codes are unique across the business. New products start as
        internal; images and public visibility can be managed later.
      </p>
      <div className="sm:col-span-2">
        {state.message ? (
          <p role="status" className="mb-3 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
        <Button disabled={pending}>
          {pending ? "Creating…" : "Create product"}
        </Button>
      </div>
    </form>
  );
}

export function VariantForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(addVariant, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="productId" value={productId} />
      <Label>
        Variant description
        <Input name="name" required placeholder="e.g. 60 × 60 · White" />
      </Label>
      <Label>
        Item Code
        <Input name="itemCode" required placeholder="e.g. TIL-002" />
      </Label>
      <Label>
        Barcode (optional)
        <Input name="barcode" />
      </Label>
      <div className="sm:col-span-3">
        {state.message ? (
          <p role="status" className="mb-2 text-sm text-muted-foreground">
            {state.message}
          </p>
        ) : null}
        <Button disabled={pending}>
          {pending ? "Adding…" : "Add variant"}
        </Button>
      </div>
    </form>
  );
}

export function ItemCodeForm({
  productId,
  variantId,
  itemCode,
}: {
  productId: string;
  variantId: string;
  itemCode: string;
}) {
  const [state, action, pending] = useActionState(
    updateVariantItemCode,
    initial,
  );
  return (
    <form
      action={action}
      className="mt-3 space-y-3 border-t border-border pt-3"
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variantId} />
      <Label>
        Item Code
        <Input
          className="mt-1 max-w-sm"
          name="itemCode"
          defaultValue={itemCode}
          required
          maxLength={80}
        />
      </Label>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input className="mt-1" name="confirmHistory" type="checkbox" />
        <span>
          I understand changing this code does not rewrite historical sales,
          purchases or stock movement snapshots.
        </span>
      </label>
      {state.message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      ) : null}
      <Button disabled={pending} variant="secondary">
        {pending ? "Saving…" : "Update Item Code"}
      </Button>
    </form>
  );
}

export function ReferenceForm({
  kind,
  categories = [],
}: {
  kind: "category" | "brand" | "unit" | "attribute";
  categories?: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createReference, initial);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <Field name="name" label="Name" required />
      {kind === "category" || kind === "brand" ? (
        <Field name="slug" label="Slug" required />
      ) : null}
      {kind === "category" ? (
        <Select name="parentId" label="Parent" required={false}>
          <option value="">Top level</option>
          {categories.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
      ) : null}
      {kind === "unit" || kind === "attribute" ? (
        <Field name="code" label="Code" required />
      ) : null}
      {kind === "unit" ? <Field name="symbol" label="Symbol" required /> : null}
      {kind === "attribute" ? (
        <Select name="dataType" label="Data type">
          <option>TEXT</option>
          <option>NUMBER</option>
          <option>BOOLEAN</option>
          <option>SELECT</option>
        </Select>
      ) : null}
      <div className="sm:col-span-2">
        {state.message ? (
          <p role="status" className="mb-2 text-sm">
            {state.message}
          </p>
        ) : null}
        <Button disabled={pending}>{pending ? "Saving…" : "Create"}</Button>
      </div>
    </form>
  );
}

export function ProductImageForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(uploadProductImage, initial);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="productId" value={productId} />
      <div>
        <p className="text-sm font-semibold">Image</p>
        <label
          className="mt-1 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/45 bg-secondary/75 px-4 text-center transition-colors hover:border-primary hover:bg-secondary focus-within:outline-3 focus-within:outline-focus focus-within:outline-offset-3"
          htmlFor="product-image"
        >
          <ImageUp aria-hidden="true" className="size-6 text-primary" />
          <span className="mt-2 text-sm font-semibold text-foreground">
            {fileName ?? "Choose a product image"}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            JPG, PNG, WebP or AVIF, up to 5 MB
          </span>
        </label>
        <input
          className="sr-only"
          id="product-image"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif"
          disabled={pending}
          onChange={(event) =>
            setFileName(event.currentTarget.files?.[0]?.name ?? null)
          }
          required
        />
      </div>
      <Field name="altText" label="Alternative text" />
      <label className="flex items-center gap-2">
        <input type="checkbox" name="isPrimary" defaultChecked /> Primary
        product image
      </label>
      <div className="sm:col-span-2">
        {state.message ? (
          <p role="status" className="mb-2 text-sm">
            {state.message}
          </p>
        ) : null}
        <Button disabled={pending}>
          {pending ? "Uploading…" : "Upload image"}
        </Button>
      </div>
    </form>
  );
}
