import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { ProductCard } from "@/components/public/product-card";
import {
  breadcrumbs,
  StructuredData,
} from "@/components/public/structured-data";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import {
  publicCatalogue,
  publicCategories,
  siteConfig,
} from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  if (!isPublicWebsiteEnabled()) return {};
  const { slug } = await params;
  const category = (await publicCategories()).find(
    (item) => item.slug === slug,
  );
  if (!category) return {};
  return {
    title: category.name,
    description:
      category.description ??
      `Explore ${category.name} available from SAT-J Ent.`,
    alternates: { canonical: `/categories/${slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isPublicWebsiteEnabled()) redirect("/login");
  const { slug } = await params;
  const [categories, products, config] = await Promise.all([
    publicCategories(),
    publicCatalogue({ category: slug }),
    siteConfig(),
  ]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  return (
    <>
      <StructuredData
        data={breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Products", path: "/products" },
          { name: category.name, path: `/categories/${category.slug}` },
        ])}
      />
      <PublicHeader />
      <main className="bg-[#f5f1e8] px-4 pb-16 pt-4 text-[#1d1e19] sm:px-6 lg:px-10 lg:pb-24 lg:pt-6">
        <div className="mx-auto max-w-[1440px]">
          <nav className="text-sm text-[#6d695f]">
            <Link className="hover:text-[#28372c]" href="/products">
              Products
            </Link>
            <span className="mx-2">/</span>
            {category.name}
          </nav>
          <section className="mt-8 grid gap-8 border-b border-[#d8d0c4] pb-12 lg:grid-cols-[minmax(0,1fr)_minmax(330px,.82fr)] lg:items-end lg:pb-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6d695f]">
                Collection
              </p>
              <h1 className="public-editorial-title mt-4 text-5xl leading-[1.02] tracking-[-0.05em] sm:text-6xl">
                {category.name}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#6d695f] sm:text-lg">
                {category.description ??
                  `Explore ${category.name} selected for building and finishing projects.`}
              </p>
              <Link
                className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[#28372c] hover:text-[#1d1e19]"
                href={`/products?category=${encodeURIComponent(category.slug)}`}
              >
                Refine this collection{" "}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
            <div className="relative aspect-[1.3/1] overflow-hidden rounded-xl bg-[#e7ded0]">
              {category.image_url ? (
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  src={category.image_url}
                />
              ) : (
                <Image
                  alt="Materials selected by SAT-J Ent"
                  className="object-cover"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  src="/images/satj-hero-materials.png"
                />
              )}
            </div>
          </section>
          <section className="pt-12 lg:pt-16">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <h2 className="public-editorial-title text-3xl tracking-[-0.04em] sm:text-4xl">
                {products.total} {products.total === 1 ? "product" : "products"}{" "}
                in this collection.
              </h2>
              <Link
                className="text-sm font-semibold text-[#28372c] hover:text-[#1d1e19]"
                href={`/products?category=${encodeURIComponent(category.slug)}`}
              >
                View all filters
              </Link>
            </div>
            {products.items.length ? (
              <div className="mt-10 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {products.items.map((product) => (
                  <ProductCard key={product.slug} product={product} />
                ))}
              </div>
            ) : (
              <div className="mt-10 border-t border-[#d8d0c4] py-10">
                <h2 className="public-editorial-title text-3xl tracking-[-0.035em]">
                  Products will appear here soon.
                </h2>
                <p className="mt-3 text-[#6d695f]">
                  The SAT-J team is preparing this collection for public
                  viewing.
                </p>
                <Link
                  className="mt-6 inline-flex rounded-full bg-[#28372c] px-5 py-3 text-sm font-semibold text-[#f8f5ef]"
                  href="/products"
                >
                  Browse all products
                </Link>
              </div>
            )}
          </section>
        </div>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
