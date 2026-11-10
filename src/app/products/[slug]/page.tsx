/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { AddToBasketButton } from "@/components/public/basket-controls";
import { ProductCard } from "@/components/public/product-card";
import {
  breadcrumbs,
  StructuredData,
} from "@/components/public/structured-data";
import { publicSiteUrl } from "@/lib/env/site-url";
import { formatGhs } from "@/lib/format";
import { publicProduct, siteConfig, whatsappHref } from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  if (!isPublicWebsiteEnabled()) return {};
  const { slug } = await params;
  const product = await publicProduct(slug);
  if (!product) return {};
  return {
    title: product.name,
    description:
      product.description?.slice(0, 155) ?? `${product.name} from SAT-J Ent.`,
    alternates: { canonical: `/products/${slug}` },
    openGraph: {
      title: product.name,
      description: product.description ?? `Explore ${product.name}.`,
      type: "website",
      url: `/products/${slug}`,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isPublicWebsiteEnabled()) redirect("/login");
  const { slug } = await params;
  const [product, config] = await Promise.all([
    publicProduct(slug),
    siteConfig(),
  ]);
  if (!product) notFound();

  const prices = product.variants
    .map((variant) => variant.price)
    .filter((price): price is number => price != null);
  const minimumPrice = prices.length ? Math.min(...prices) : null;
  const maximumPrice = prices.length ? Math.max(...prices) : null;
  const priceLabel =
    minimumPrice == null
      ? "Request price"
      : minimumPrice === maximumPrice
        ? formatGhs(minimumPrice)
        : `From ${formatGhs(minimumPrice)}`;
  const productDetails = [
    { label: "Size", value: product.size },
    { label: "Colour", value: product.colour },
    { label: "Unit", value: product.unit },
  ].filter((detail): detail is { label: string; value: string } =>
    Boolean(detail.value),
  );
  const specificationGroups = new Map<string, Set<string>>();
  for (const option of product.variants) {
    for (const [label, value] of Object.entries(option.attributes)) {
      if (!value) continue;
      const values = specificationGroups.get(label) ?? new Set<string>();
      values.add(value);
      specificationGroups.set(label, values);
    }
  }
  const whatsapp = whatsappHref(
    config.whatsapp_number,
    `Hello SAT-J Ent, I am interested in ${product.name}. ${publicSiteUrl(`/products/${product.slug}`)}`,
  );
  const availabilitySchema = {
    Available: "https://schema.org/InStock",
    "Limited availability": "https://schema.org/LimitedAvailability",
    "Currently unavailable": "https://schema.org/OutOfStock",
  }[product.availability];
  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: publicSiteUrl(`/products/${product.slug}`),
    ...(product.description ? { description: product.description } : {}),
    ...(product.brand
      ? { brand: { "@type": "Brand", name: product.brand } }
      : {}),
  };
  if (minimumPrice != null && minimumPrice === maximumPrice)
    productJsonLd.offers = {
      "@type": "Offer",
      price: minimumPrice,
      priceCurrency: "GHS",
      url: publicSiteUrl(`/products/${product.slug}`),
      ...(availabilitySchema ? { availability: availabilitySchema } : {}),
    };

  return (
    <>
      <StructuredData data={productJsonLd} />
      <StructuredData
        data={breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
          {
            name: product.category.name,
            path: `/categories/${product.category.slug}`,
          },
          { name: product.name, path: `/products/${product.slug}` },
        ])}
      />
      <PublicHeader />
      <main className="bg-[#f1ece2] px-4 py-5 text-[#1d1e19] sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[1440px]">
          <nav aria-label="Breadcrumb" className="text-sm text-[#6d695f]">
            <Link
              className="transition-colors hover:text-[#28372c]"
              href="/products"
            >
              Products
            </Link>
            <span className="px-2">/</span>
            <Link
              className="transition-colors hover:text-[#28372c]"
              href={`/categories/${product.category.slug}`}
            >
              {product.category.name}
            </Link>
          </nav>
          <section className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)] lg:gap-14">
            <div>
              <div className="relative aspect-[4/4.7] overflow-hidden rounded-xl bg-[#e7ded0] sm:aspect-[4/3.8]">
                {product.images[0]?.url ? (
                  <img
                    alt={product.images[0].alt}
                    className="h-full w-full object-cover"
                    src={product.images[0].url}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-8 text-center text-sm leading-6 text-[#6d695f]">
                    Product photography will be added soon.
                  </div>
                )}
              </div>
              {product.images.length > 1 ? (
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {product.images.slice(1, 5).map((image) => (
                    <div
                      className="aspect-square overflow-hidden rounded-lg bg-[#ded6c8]"
                      key={image.path}
                    >
                      {image.url ? (
                        <img
                          alt={image.alt}
                          className="h-full w-full object-cover"
                          src={image.url}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col justify-center py-2 lg:py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6d695f]">
                {product.category.name}
                {product.product_type ? ` · ${product.product_type}` : ""}
              </p>
              <h1 className="public-editorial-title mt-4 text-5xl leading-[1.02] tracking-[-0.055em] sm:text-6xl">
                {product.name}
              </h1>
              {product.brand ? (
                <p className="mt-4 text-sm text-[#6d695f]">{product.brand}</p>
              ) : null}
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#40513d]">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${product.availability === "Available" ? "bg-[#567151]" : product.availability === "Limited availability" ? "bg-[#9a712e]" : "bg-[#8b574d]"}`}
                  />
                  {product.availability}
                </span>
                <span className="text-lg font-semibold tracking-[-0.02em]">
                  {priceLabel}
                </span>
              </div>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#5e5a52]">
                {product.description ??
                  "Speak with SAT-J Ent for product specifications, availability and project guidance."}
              </p>
              <section className="mt-8 grid gap-3" aria-label="Product options">
                {product.variants.map((variant) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#dcd8ce] bg-white/60 p-4"
                    key={variant.id}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#20221f]">
                        {variant.name}
                      </p>
                      <p className="mt-1 text-xs text-[#6d695f]">
                        SKU {variant.sku} · sold by {product.unit}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#454840]">
                        {variant.price == null
                          ? "Price confirmed by branch"
                          : `${formatGhs(variant.price)} / ${product.unit}`}
                      </p>
                    </div>
                    <AddToBasketButton
                      line={{
                        variantId: variant.id,
                        slug: product.slug,
                        name: product.name,
                        variant: variant.name,
                        sku: variant.sku,
                        unit: product.unit,
                        price: variant.price,
                      }}
                    />
                  </div>
                ))}
              </section>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#28372c]/30 px-5 text-sm font-semibold text-[#28372c] transition-colors hover:border-[#aa4924] hover:text-[#aa4924]"
                  href="/contact"
                >
                  Ask SAT-J a question{" "}
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
                {whatsapp ? (
                  <a
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#28372c]/30 px-6 text-sm font-semibold text-[#28372c] transition-colors hover:border-[#28372c] hover:bg-[#e7ded0]/70 active:translate-y-px"
                    href={whatsapp}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <MessageCircle
                      aria-hidden="true"
                      className="mr-2"
                      size={17}
                    />{" "}
                    WhatsApp us
                  </a>
                ) : null}
              </div>
            </div>
          </section>
          {productDetails.length || specificationGroups.size ? (
            <section className="mt-16 border-y border-[#1d1e19]/15 py-10 lg:mt-20 lg:py-12">
              <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr]">
                <div>
                  <h2 className="public-editorial-title text-3xl tracking-[-0.04em] sm:text-4xl">
                    Product details
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-[#6d695f]">
                    Use these details as a guide. Our team can help you confirm
                    the right fit for your project.
                  </p>
                </div>
                <dl className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
                  {productDetails.map((detail) => (
                    <div key={detail.label}>
                      <dt className="text-xs font-semibold uppercase tracking-[0.13em] text-[#6d695f]">
                        {detail.label}
                      </dt>
                      <dd className="mt-2 text-lg font-semibold tracking-[-0.02em]">
                        {detail.value}
                      </dd>
                    </div>
                  ))}
                  {Array.from(specificationGroups.entries()).map(
                    ([label, values]) => (
                      <div key={label}>
                        <dt className="text-xs font-semibold uppercase tracking-[0.13em] text-[#6d695f]">
                          {label}
                        </dt>
                        <dd className="mt-2 text-lg font-semibold tracking-[-0.02em]">
                          {Array.from(values).join(", ")}
                        </dd>
                      </div>
                    ),
                  )}
                </dl>
              </div>
            </section>
          ) : null}
          {product.related.length ? (
            <section className="py-16 lg:py-20">
              <h2 className="public-editorial-title text-3xl tracking-[-0.04em] sm:text-4xl">
                Explore similar materials
              </h2>
              <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {product.related.map((related) => (
                  <ProductCard key={related.slug} product={related} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
