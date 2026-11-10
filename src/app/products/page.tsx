import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react";
import { CatalogueFilters } from "@/components/public/catalogue-filters";
import { ProductCard } from "@/components/public/product-card";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import {
  publicAttributeFilters,
  publicBrands,
  publicCatalogue,
  publicCategories,
  siteConfig,
  whatsappHref,
} from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Browse SAT-J Ent doors, tiles, sanitary ware and finishing materials.",
  alternates: { canonical: "/products" },
};

function pageHref(q: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([key, value]) => {
    if (value && key !== "page") params.set(key, value);
  });
  params.set("page", String(page));
  return `/products?${params.toString()}`;
}

function CataloguePagination({
  current,
  pages,
  q,
}: {
  current: number;
  pages: number;
  q: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;
  const visible = Array.from({ length: pages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === pages || Math.abs(page - current) <= 1,
  );
  const items: Array<number | "ellipsis"> = visible.flatMap((page, index) =>
    index > 0 && page - visible[index - 1] > 1 ? ["ellipsis", page] : [page],
  );
  return (
    <nav
      aria-label="Catalogue pages"
      className="mt-14 flex flex-wrap items-center justify-center gap-2 text-sm"
    >
      {current > 1 ? (
        <Link
          className="inline-flex min-h-11 items-center gap-2 px-3 font-semibold text-[#28372c]"
          href={pageHref(q, current - 1)}
        >
          <ArrowLeft aria-hidden="true" size={16} /> Previous
        </Link>
      ) : (
        <span className="hidden min-h-11 items-center gap-2 px-3 text-[#8a8478] sm:inline-flex">
          <ArrowLeft aria-hidden="true" size={16} /> Previous
        </span>
      )}
      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span
            className="flex min-h-11 min-w-8 items-center justify-center text-[#6d695f]"
            key={`ellipsis-${index}`}
          >
            ...
          </span>
        ) : (
          <Link
            aria-current={item === current ? "page" : undefined}
            className={`flex min-h-11 min-w-11 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${item === current ? "border-[#28372c] bg-[#28372c] text-[#f8f5ef]" : "border-[#d8d0c4] text-[#28372c] hover:border-[#28372c]"}`}
            href={pageHref(q, item)}
            key={item}
          >
            {item}
          </Link>
        ),
      )}
      {current < pages ? (
        <Link
          className="inline-flex min-h-11 items-center gap-2 px-3 font-semibold text-[#28372c]"
          href={pageHref(q, current + 1)}
        >
          Next <ArrowRight aria-hidden="true" size={16} />
        </Link>
      ) : (
        <span className="hidden min-h-11 items-center gap-2 px-3 text-[#8a8478] sm:inline-flex">
          Next <ArrowRight aria-hidden="true" size={16} />
        </span>
      )}
    </nav>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isPublicWebsiteEnabled()) redirect("/login");
  const raw = await searchParams;
  const q = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  ) as Record<string, string | undefined>;
  const page = Math.max(1, Number(q.page) || 1);
  const attributeDefinitions = await publicAttributeFilters(q.category);
  const attributes = Object.fromEntries(
    attributeDefinitions.flatMap((definition) =>
      definition.values.some((value) => value.key === q[definition.key])
        ? [[definition.key, q[definition.key]!]]
        : [],
    ),
  );
  const [catalogue, categories, brands, config] = await Promise.all([
    publicCatalogue({
      q: q.q,
      category: q.category,
      brand: q.brand,
      sort: q.sort,
      page,
      attributes,
    }),
    publicCategories(),
    publicBrands(),
    siteConfig(),
  ]);
  const pages = Math.ceil(catalogue.total / 12);
  const whatsapp = whatsappHref(
    config.whatsapp_number,
    "Hello SAT-J Ent, I would like help finding a product.",
  );

  return (
    <>
      <PublicHeader />
      <main className="min-h-[70vh] bg-[#f5f1e8] px-4 pb-4 pt-14 text-[#1d1e19] sm:px-6 lg:px-10 lg:pb-10 lg:pt-[72px]">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6d695f]">
            Product catalogue
          </p>
          <h1 className="public-editorial-title mt-4 max-w-3xl text-4xl leading-[1.02] tracking-[-0.05em] sm:text-5xl lg:text-6xl">
            Find the right material for your project.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#6d695f] sm:text-lg">
            Explore SAT-J Ent&apos;s collection of doors, tiles, sanitary ware,
            sinks and finishing materials.
          </p>

          <CatalogueFilters
            attributes={attributeDefinitions}
            brands={brands}
            categories={categories}
            q={q}
            total={catalogue.total}
          >
            {catalogue.items.length ? (
              <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                {catalogue.items.map((product) => (
                  <ProductCard key={product.slug} product={product} />
                ))}
              </div>
            ) : (
              <section className="border-t border-[#d8d0c4] py-12">
                <h2 className="public-editorial-title text-3xl tracking-[-0.035em]">
                  No products match these filters.
                </h2>
                <p className="mt-3 max-w-md leading-7 text-[#6d695f]">
                  Try removing a filter or browse another category to find a
                  suitable material.
                </p>
                <Link
                  className="mt-6 inline-flex rounded-full bg-[#28372c] px-5 py-3 text-sm font-semibold text-[#f8f5ef] transition-colors hover:bg-[#1d1e19]"
                  href="/products"
                >
                  Clear filters
                </Link>
              </section>
            )}
            <CataloguePagination current={page} pages={pages} q={q} />
          </CatalogueFilters>

          <section className="relative isolate mt-20 overflow-hidden rounded-xl bg-[#28372c] px-6 py-12 text-[#f8f5ef] sm:px-10 lg:mt-28 lg:px-14 lg:py-16">
            <div className="max-w-2xl">
              <h2 className="public-editorial-title text-4xl leading-[1.03] tracking-[-0.045em] sm:text-5xl">
                Can&apos;t find exactly what you need?
              </h2>
              <p className="mt-4 max-w-xl leading-7 text-[#f8f5ef]/78">
                Tell us what you&apos;re looking for and we&apos;ll help you
                find the right option for your project.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  className="rounded-full bg-[#f8f5ef] px-5 py-3 text-sm font-semibold text-[#1d1e19] transition-colors hover:bg-white"
                  href="/contact"
                >
                  Contact SAT-J
                </Link>
                {whatsapp ? (
                  <a
                    className="inline-flex items-center gap-2 rounded-full border border-[#f8f5ef]/45 px-5 py-3 text-sm font-semibold text-[#f8f5ef] transition-colors hover:border-[#f8f5ef] hover:bg-white/10"
                    href={whatsapp}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <MessageCircle
                      aria-hidden="true"
                      size={16}
                      strokeWidth={1.7}
                    />{" "}
                    WhatsApp us
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
