/**
 * Provides shared read queries and data shapes for the public storefront catalogue and product pages.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SiteConfig = {
  hero_eyebrow: string;
  hero_title: string;
  hero_description: string;
  phone: string | null;
  email: string | null;
  whatsapp_number: string | null;
};
export type PublicCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  image_path: string | null;
  image_url?: string | null;
};
export type PublicBranch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string | null;
  opening_hours: string | null;
};
export type PublicProductCard = {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  category_slug: string;
  product_type?: string | null;
  brand: string | null;
  image_path: string | null;
  image_url?: string | null;
  price: number | null;
  availability: string;
};
export type PublicVariant = {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  attributes: Record<string, string>;
};
export type PublicProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: { name: string; slug: string };
  product_type: string | null;
  brand: string | null;
  unit: string;
  size: string | null;
  colour: string | null;
  show_price_online: boolean;
  images: {
    path: string;
    alt: string;
    variant_id: string | null;
    url?: string | null;
  }[];
  variants: PublicVariant[];
  availability: string;
  related: PublicProductCard[];
};
export type Catalogue = { total: number; items: PublicProductCard[] };
export type PublicAttributeFilter = {
  key: string;
  code: string;
  name: string;
  values: { key: string; label: string }[];
};

async function sign(path: string | null) {
  if (!path) return null;
  const db = await createClient();
  const { data } = await db.storage
    .from("product-images")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
export async function siteConfig() {
  const { data } = await (await createClient()).rpc("public_site_config");
  return (data ?? {
    hero_eyebrow: "Building materials for every stage",
    hero_title: "Build with confidence.",
    hero_description: "Explore SAT-J Ent products.",
    phone: null,
    email: null,
    whatsapp_number: null,
  }) as SiteConfig;
}
export async function publicCategories() {
  const { data, error } = await (await createClient()).rpc("public_categories");
  if (error) throw error;
  return Promise.all(
    ((data ?? []) as PublicCategory[]).map(async (c) => ({
      ...c,
      image_url: await sign(c.image_path),
    })),
  );
}
export async function publicBranches() {
  const { data, error } = await (await createClient()).rpc("public_branches");
  if (error) throw error;
  return (data ?? []) as PublicBranch[];
}
export async function publicQuoteProducts() {
  const { data, error } = await (
    await createClient()
  ).rpc("public_quote_products");
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; category: string }[];
}
export async function publicBrands() {
  const { data, error } = await (await createClient()).rpc("public_brands");
  if (error) throw error;
  return (data ?? []) as { name: string; slug: string }[];
}
export async function publicAttributeFilters(category: string | undefined) {
  if (!category) return [];
  const { data, error } = await (
    await createClient()
  ).rpc("public_attribute_filters", { target_category_slug: category });
  if (error) throw error;
  return (data ?? []) as PublicAttributeFilter[];
}
export async function publicCatalogue(
  filters: {
    q?: string;
    category?: string;
    brand?: string;
    sort?: string;
    page?: number;
    size?: number;
    attributes?: Record<string, string>;
  } = {},
) {
  const { data, error } = await (
    await createClient()
  ).rpc("public_catalogue", {
    search_text: filters.q || null,
    category_slug: filters.category || null,
    brand_slug: filters.brand || null,
    sort_by: filters.sort || "recommended",
    page_number: filters.page || 1,
    page_size: filters.size || 12,
    attribute_filters: filters.attributes ?? {},
  });
  if (error) throw error;
  const result = data as unknown as Catalogue;
  result.items = await Promise.all(
    result.items.map(async (p) => ({
      ...p,
      image_url: await sign(p.image_path),
    })),
  );
  return result;
}
export async function publicBestSellers(size = 4) {
  const { data, error } = await (
    await createClient()
  ).rpc("public_best_sellers", { item_limit: size });
  if (error) throw error;
  return Promise.all(
    ((data ?? []) as PublicProductCard[]).map(async (product) => ({
      ...product,
      image_url: await sign(product.image_path),
    })),
  );
}
export async function publicProduct(slug: string) {
  const { data, error } = await (
    await createClient()
  ).rpc("public_product", { product_slug: slug });
  if (error) throw error;
  if (!data) return null;
  const product = data as unknown as PublicProduct;
  product.images = await Promise.all(
    product.images.map(async (i) => ({ ...i, url: await sign(i.path) })),
  );
  product.related = await Promise.all(
    product.related.map(async (related) => ({
      ...related,
      image_url: await sign(related.image_path),
    })),
  );
  return product;
}
export { whatsappHref } from "@/lib/public-website";
