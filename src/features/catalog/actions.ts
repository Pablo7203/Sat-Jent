"use server";
/**
 * Catalog actions validate product, variant, category, attribute, and image changes before saving them.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireBranchAccess,
  requirePermission,
} from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { idSchema, productSchema, referenceSchema } from "./schemas";

export type CatalogActionState = { success: boolean; message?: string };
const fail = (message: string): CatalogActionState => ({
  success: false,
  message,
});
const messageFor = (error: { message: string } | null) =>
  error?.message ?? "The change could not be saved.";
const itemCodeError = (message: string | undefined) =>
  message?.includes("product_variants_sku_ci_unique")
    ? "This item code is already assigned to another product."
    : (message ?? "The item code could not be saved.");

export async function createProduct(
  _state: CatalogActionState,
  data: FormData,
): Promise<CatalogActionState> {
  await requirePermission("products.create");
  const parsed = productSchema.safeParse({
    name: data.get("name"),
    description: data.get("description") ?? "",
    categoryId: data.get("categoryId"),
    productTypeId: data.get("productTypeId") ?? "",
    brandId: data.get("brandId") ?? "",
    unitId: data.get("unitId"),
    status: data.get("status"),
    isPublic: false,
    variantName: data.get("variantName"),
    sku: String(data.get("itemCode") ?? data.get("sku") ?? "").trim(),
    barcode: data.get("barcode") ?? "",
    retailPrice: data.get("retailPrice") ?? "",
    wholesalePrice: data.get("wholesalePrice") ?? "",
    size: data.get("size") ?? "",
    colour: data.get("colour") ?? "",
  });
  if (!parsed.success)
    return fail(
      parsed.error.issues[0]?.message ?? "Check the product details.",
    );
  const v = parsed.data;
  const supabase = await createClient();
  const { data: productId, error } = await supabase.rpc(
    "create_product_with_default_variant",
    {
      product_name: v.name,
      product_description: v.description,
      product_category_id: v.categoryId,
      selected_product_type_id: v.productTypeId,
      product_brand_id: v.brandId,
      product_unit_id: v.unitId,
      product_is_public: v.isPublic,
      product_status: v.status,
      variant_name: v.variantName || "Standard",
      variant_sku: v.sku,
      variant_barcode: v.barcode,
      retail_amount: v.retailPrice ?? null,
      wholesale_amount: v.wholesalePrice ?? null,
    },
  );
  if (error || !productId) return fail(itemCodeError(error?.message));
  await supabase.rpc("set_new_product_details", {
    target_product_id: productId,
    product_size: v.size || null,
    product_colour: v.colour || null,
  });
  revalidatePath("/app/products");
  redirect(`/app/products/${productId}`);
}

export async function updateProduct(data: FormData) {
  await requirePermission("products.update");
  const id = idSchema.safeParse(data.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const isPublic = data.get("isPublic") === "on";
  if (isPublic) {
    const { count, error: imageError } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id.data);
    if (imageError || !count) return;
  }
  const categoryId = idSchema.safeParse(data.get("categoryId"));
  const productTypeId = idSchema.safeParse(data.get("productTypeId") || "");
  if (
    !categoryId.success ||
    (data.get("productTypeId") && !productTypeId.success)
  )
    redirect(`/app/products/${id.data}/edit?error=classification`);
  const { error: updateError } = await supabase
    .from("products")
    .update({
      name: String(data.get("name") ?? "").trim(),
      description: String(data.get("description") ?? "").trim() || null,
      category_id: categoryId.data,
      product_type_id: productTypeId.success ? productTypeId.data : null,
      brand_id: data.get("brandId") || null,
      unit_of_measure_id: data.get("unitId"),
      size: String(data.get("size") ?? "").trim() || null,
      colour: String(data.get("colour") ?? "").trim() || null,
      is_public: isPublic,
      show_price_online: data.get("showPriceOnline") === "on",
      is_featured: data.get("isFeatured") === "on",
    })
    .eq("id", id.data);
  if (updateError)
    redirect(`/app/products/${id.data}/edit?error=classification`);
  revalidatePath(`/app/products/${id.data}`);
  revalidatePath("/app/products");
  revalidatePath("/products");
  redirect(`/app/products/${id.data}`);
}

export async function setProductStatus(data: FormData) {
  const status = data.get("status");
  await requirePermission(
    status === "ARCHIVED" ? "products.archive" : "products.update",
  );
  const id = idSchema.safeParse(data.get("id"));
  if (!id.success || !["DRAFT", "ACTIVE", "ARCHIVED"].includes(String(status)))
    return;
  const supabase = await createClient();
  await supabase.from("products").update({ status }).eq("id", id.data);
  revalidatePath(`/app/products/${id.data}`);
  revalidatePath("/app/products");
}

export async function changePrice(data: FormData) {
  const context = await requirePermission("product_prices.manage");
  const variantId = idSchema.safeParse(data.get("variantId"));
  const amount = Number(data.get("amount"));
  const priceType = String(data.get("priceType"));
  const branchId = idSchema.safeParse(data.get("branchId") || "");
  if (
    !variantId.success ||
    (data.get("branchId") && !branchId.success) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !["RETAIL", "WHOLESALE"].includes(priceType)
  )
    return;
  if (branchId.success) {
    await requireBranchAccess(branchId.data);
    if (
      !context.accessibleBranches.some(
        (branch) => branch.id === branchId.data && branch.isActive,
      )
    )
      return;
  }
  const supabase = await createClient();
  await supabase.rpc("change_product_price", {
    target_variant_id: variantId.data,
    target_branch_id: branchId.success ? branchId.data : null,
    target_price_type: priceType,
    new_amount: amount,
  });
  revalidatePath("/app/products");
  revalidatePath("/app/catalog/pricing");
}

export async function createReference(
  _state: CatalogActionState,
  data: FormData,
): Promise<CatalogActionState> {
  const parsed = referenceSchema.safeParse({
    kind: data.get("kind"),
    name: data.get("name"),
    code: data.get("code") ?? "",
    slug: data.get("slug") ?? "",
    parentId: data.get("parentId") ?? "",
    symbol: data.get("symbol") ?? "",
    dataType: data.get("dataType") ?? "TEXT",
  });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const v = parsed.data;
  const supabase = await createClient();
  let error;
  if (v.kind === "category") {
    await requirePermission("categories.manage");
    ({ error } = await supabase
      .from("categories")
      .insert({ name: v.name, slug: v.slug, parent_id: v.parentId }));
  } else if (v.kind === "brand") {
    await requirePermission("brands.manage");
    ({ error } = await supabase
      .from("brands")
      .insert({ name: v.name, slug: v.slug }));
  } else if (v.kind === "unit") {
    await requirePermission("units.manage");
    ({ error } = await supabase
      .from("units_of_measure")
      .insert({ name: v.name, code: v.code.toUpperCase(), symbol: v.symbol }));
  } else {
    await requirePermission("product_attributes.manage");
    ({ error } = await supabase.from("attributes").insert({
      name: v.name,
      code: v.code.toUpperCase(),
      data_type: v.dataType,
    }));
  }
  if (error) return fail(messageFor(error));
  revalidatePath("/app/catalog", "layout");
  return { success: true, message: `${v.name} created.` };
}

export async function toggleReference(data: FormData) {
  const table = String(data.get("table"));
  const id = idSchema.safeParse(data.get("id"));
  if (!id.success) return;
  const allowed = {
    categories: "categories.manage",
    brands: "brands.manage",
    units_of_measure: "units.manage",
    attributes: "product_attributes.manage",
  } as const;
  if (!(table in allowed)) return;
  await requirePermission(allowed[table as keyof typeof allowed]);
  const supabase = await createClient();
  await supabase
    .from(table)
    .update({ is_active: data.get("active") === "true" })
    .eq("id", id.data);
  revalidatePath("/app/catalog", "layout");
}

export async function updateCategory(data: FormData) {
  await requirePermission("categories.manage");
  const id = idSchema.safeParse(data.get("id"));
  const parsed = referenceSchema.safeParse({
    kind: "category",
    name: data.get("name"),
    code: "",
    slug: data.get("slug"),
    parentId: data.get("parentId") ?? "",
    symbol: "",
    dataType: "TEXT",
  });
  if (!id.success || !parsed.success) return;
  const category = parsed.data;
  if (category.parentId === id.data) return;
  const { error } = await (
    await createClient()
  )
    .from("categories")
    .update({
      name: category.name,
      slug: category.slug,
      parent_id: category.parentId,
    })
    .eq("id", id.data);
  if (error) return;
  revalidatePath("/app/catalog", "layout");
  revalidatePath("/products");
  revalidatePath("/");
}

export async function createProductType(
  _state: CatalogActionState,
  data: FormData,
): Promise<CatalogActionState> {
  await requirePermission("categories.manage");
  const categoryId = idSchema.safeParse(data.get("categoryId"));
  const name = String(data.get("name") ?? "").trim();
  if (!categoryId.success || name.length < 2 || name.length > 100)
    return fail(
      "Choose a category and enter a type name between 2 and 100 characters.",
    );
  const s = await createClient();
  const { error } = await s.from("product_types").insert({
    category_id: categoryId.data,
    name,
  });
  if (error)
    return fail(
      error.code === "23505"
        ? "That type already exists under this category."
        : messageFor(error),
    );
  revalidatePath("/app/catalog", "layout");
  revalidatePath("/app/products", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/", "layout");
  return { success: true, message: `${name} added as a product type.` };
}

export async function updateProductType(data: FormData) {
  await requirePermission("categories.manage");
  const id = idSchema.safeParse(data.get("id"));
  const name = String(data.get("name") ?? "").trim();
  if (!id.success || name.length < 2 || name.length > 100) return;
  const s = await createClient();
  const { error } = await s
    .from("product_types")
    .update({ name })
    .eq("id", id.data);
  if (error) return;
  revalidatePath("/app/catalog", "layout");
  revalidatePath("/app/products", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/", "layout");
}

export async function toggleProductType(data: FormData) {
  await requirePermission("categories.manage");
  const id = idSchema.safeParse(data.get("id"));
  if (!id.success) return;
  const s = await createClient();
  const { error } = await s
    .from("product_types")
    .update({ is_active: data.get("active") === "true" })
    .eq("id", id.data);
  if (error) return;
  revalidatePath("/app/catalog", "layout");
  revalidatePath("/app/products", "layout");
  revalidatePath("/products", "layout");
  revalidatePath("/", "layout");
}

export async function deleteProduct(data: FormData) {
  await requirePermission("products.delete");
  const id = idSchema.safeParse(data.get("id"));
  if (!id.success || data.get("confirmDelete") !== "yes") return;
  const s = await createClient();
  const { data: paths, error } = await s.rpc("delete_unused_product", {
    target_product_id: id.data,
  });
  if (error) return;
  if (paths?.length) await s.storage.from("product-images").remove(paths);
  revalidatePath("/app/products");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/app/products");
}

const supportedImageTypes = {
  jpeg: { extension: "jpg", mime: "image/jpeg" },
  png: { extension: "png", mime: "image/png" },
  webp: { extension: "webp", mime: "image/webp" },
  avif: { extension: "avif", mime: "image/avif" },
} as const;

async function detectImageType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.slice(from, to));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return supportedImageTypes.jpeg;
  if (
    bytes[0] === 0x89 &&
    ascii(1, 4) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return supportedImageTypes.png;
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    return supportedImageTypes.webp;
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12)))
    return supportedImageTypes.avif;
  return null;
}
export async function uploadProductImage(
  _state: CatalogActionState,
  data: FormData,
): Promise<CatalogActionState> {
  await requirePermission("product_images.manage");
  const productId = idSchema.safeParse(data.get("productId"));
  const file = data.get("image");
  if (!productId.success || !(file instanceof File))
    return fail("Choose an image.");
  const imageType = await detectImageType(file);
  if (!imageType || file.size > 5 * 1024 * 1024)
    return fail("Use a JPG, PNG, WebP, or AVIF image up to 5 MB.");
  const s = await createClient();
  const path = `products/${productId.data}/${crypto.randomUUID()}.${imageType.extension}`;
  const { error: uploadError } = await s.storage
    .from("product-images")
    .upload(path, file, { contentType: imageType.mime, upsert: false });
  if (uploadError) return fail(messageFor(uploadError));
  if (data.get("isPrimary") === "on") {
    const { error: primaryError } = await s
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId.data)
      .eq("is_primary", true);
    if (primaryError) {
      await s.storage.from("product-images").remove([path]);
      return fail(messageFor(primaryError));
    }
  }
  const { error } = await s.from("product_images").insert({
    product_id: productId.data,
    storage_path: path,
    alt_text: String(data.get("altText") ?? "").trim() || null,
    is_primary: data.get("isPrimary") === "on",
  });
  if (error) {
    await s.storage.from("product-images").remove([path]);
    return fail(messageFor(error));
  }
  revalidatePath(`/app/products/${productId.data}`);
  revalidatePath("/products");
  return { success: true, message: "Image uploaded." };
}
export async function deleteProductImage(data: FormData) {
  await requirePermission("product_images.manage");
  const productId = idSchema.safeParse(data.get("productId"));
  const imageId = idSchema.safeParse(data.get("imageId"));
  if (!productId.success || !imageId.success) return;
  const s = await createClient();
  const { data: image } = await s
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId.data)
    .eq("product_id", productId.data)
    .single();
  if (!image?.storage_path.startsWith(`products/${productId.data}/`)) return;
  const [{ data: product }, { count: imageCount }] = await Promise.all([
    s.from("products").select("is_public").eq("id", productId.data).single(),
    s
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId.data),
  ]);
  if (product?.is_public && (imageCount ?? 0) <= 1) return;
  const { error } = await s.storage
    .from("product-images")
    .remove([image.storage_path]);
  if (error) return;
  await s
    .from("product_images")
    .delete()
    .eq("id", imageId.data)
    .eq("product_id", productId.data);
  revalidatePath(`/app/products/${productId.data}`);
  revalidatePath("/products");
}

export async function addVariant(
  _state: CatalogActionState,
  data: FormData,
): Promise<CatalogActionState> {
  await requirePermission("products.update");
  const productId = idSchema.safeParse(data.get("productId"));
  if (!productId.success) return fail("Choose a valid product.");
  const name = String(data.get("name") ?? "").trim();
  const sku = String(data.get("itemCode") ?? data.get("sku") ?? "").trim();
  const barcode = String(data.get("barcode") ?? "").trim();
  if (!name || !sku) return fail("Enter a variant description and Item Code.");
  const s = await createClient();
  const { data: product } = await s
    .from("products")
    .select("status")
    .eq("id", productId.data)
    .single();
  if (product?.status !== "DRAFT")
    return fail("Return the product to draft before adding a variant.");
  const { error } = await s.from("product_variants").insert({
    product_id: productId.data,
    name,
    sku,
    barcode: barcode || null,
    is_default: false,
  });
  if (error) return fail(itemCodeError(error.message));
  revalidatePath(`/app/products/${productId.data}`);
  return { success: true, message: "Variant added." };
}

export async function updateVariantItemCode(
  _state: CatalogActionState,
  data: FormData,
): Promise<CatalogActionState> {
  await requirePermission("products.update");
  const variantId = idSchema.safeParse(data.get("variantId"));
  const productId = idSchema.safeParse(data.get("productId"));
  const itemCode = String(data.get("itemCode") ?? "").trim();
  if (!variantId.success || !productId.success)
    return fail("Choose a valid product variant.");
  if (!itemCode || itemCode.length > 80)
    return fail("Item Code must be between 1 and 80 characters.");
  const s = await createClient();
  const { error } = await s.rpc("update_variant_item_code", {
    target_variant_id: variantId.data,
    new_item_code: itemCode,
    confirm_history: data.get("confirmHistory") === "on",
  });
  if (error) return fail(itemCodeError(error.message));
  revalidatePath(`/app/products/${productId.data}`);
  revalidatePath(`/app/products/${productId.data}/edit`);
  revalidatePath("/app/products");
  revalidatePath("/app/inventory", "layout");
  return {
    success: true,
    message:
      "Item Code updated. Existing transaction snapshots remain unchanged.",
  };
}

export async function createAttributeValue(data: FormData) {
  await requirePermission("product_attributes.manage");
  const attributeId = idSchema.safeParse(data.get("attributeId"));
  const value = String(data.get("value") ?? "").trim();
  if (!attributeId.success || !value) return;
  const s = await createClient();
  await s
    .from("attribute_values")
    .insert({ attribute_id: attributeId.data, value });
  revalidatePath("/app/catalog/attributes");
}
export async function mapCategoryAttribute(data: FormData) {
  await requirePermission("product_attributes.manage");
  const attributeId = idSchema.safeParse(data.get("attributeId"));
  const categoryId = idSchema.safeParse(data.get("categoryId"));
  if (!attributeId.success || !categoryId.success) return;
  const s = await createClient();
  await s.from("category_attributes").upsert({
    attribute_id: attributeId.data,
    category_id: categoryId.data,
    is_required: data.get("isRequired") === "on",
  });
  revalidatePath("/app/catalog/attributes");
}

export async function setVariantAttribute(data: FormData) {
  await requirePermission("products.update");
  const variantId = idSchema.safeParse(data.get("variantId"));
  const attributeId = idSchema.safeParse(data.get("attributeId"));
  const productId = idSchema.safeParse(data.get("productId"));
  if (!variantId.success || !attributeId.success || !productId.success) return;
  const type = String(data.get("dataType"));
  const raw = String(data.get("value") ?? "").trim();
  if (!raw) return;
  const row: {
    variant_id: string;
    attribute_id: string;
    attribute_value_id?: string;
    text_value?: string;
    number_value?: number;
    boolean_value?: boolean;
  } = { variant_id: variantId.data, attribute_id: attributeId.data };
  if (type === "SELECT") {
    const value = idSchema.safeParse(raw);
    if (!value.success) return;
    row.attribute_value_id = value.data;
  } else if (type === "NUMBER") {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    row.number_value = value;
  } else if (type === "BOOLEAN") row.boolean_value = raw === "true";
  else row.text_value = raw;
  const s = await createClient();
  await s
    .from("variant_attribute_values")
    .upsert(row, { onConflict: "variant_id,attribute_id" });
  revalidatePath(`/app/products/${productId.data}`);
}
