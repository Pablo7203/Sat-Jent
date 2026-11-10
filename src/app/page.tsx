import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, PackageCheck } from "lucide-react";
import { ProductCard } from "@/components/public/product-card";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import {
  publicBestSellers,
  publicCategories,
  publicBranches,
  siteConfig,
} from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export const metadata: Metadata = {
  title: "Building materials, chosen with confidence",
  description:
    "Browse doors, tiles, sanitary ware and finishing materials from SAT-J Ent across our three branches.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  if (!isPublicWebsiteEnabled()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 text-[#1d1e19]">
        <div className="max-w-lg text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#aa4924]">
            SAT-J Ent
          </p>
          <h1 className="public-editorial-title mt-4 text-5xl">
            We’ll be back shortly.
          </h1>
          <p className="mt-4 text-[#6d695f]">
            Our online catalogue is temporarily unavailable.
          </p>
          <Link
            className="mt-7 inline-flex rounded-full bg-[#1d1e19] px-5 py-3 text-sm font-semibold text-white"
            href="/login"
          >
            Staff login
          </Link>
        </div>
      </main>
    );
  }

  const [config, categories, products, branches] = await Promise.all([
    siteConfig(),
    publicCategories(),
    publicBestSellers(4),
    publicBranches(),
  ]);
  const visibleCategories = categories.slice(0, 4);

  return (
    <>
      <PublicHeader />
      <main className="bg-[#fbfaf7] text-[#20221f]">
        <section className="px-4 pb-14 pt-4 sm:px-6 lg:px-10 lg:pb-20">
          <div className="relative isolate mx-auto flex min-h-[580px] max-w-[1440px] items-end overflow-hidden rounded-[1.4rem] bg-[#272a25] px-6 py-9 text-white sm:min-h-[660px] sm:px-10 sm:py-12 lg:px-16 lg:py-16">
            <Image
              alt="A contemporary finished bathroom showcasing quality building materials"
              className="-z-20 object-cover object-center"
              fill
              priority
              sizes="(max-width: 1440px) 100vw, 1440px"
              src="/images/satj-hero-materials.png"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#151714]/90 via-[#151714]/55 to-[#151714]/10" />
            <div className="max-w-[720px]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f1a27a]">
                {config.hero_eyebrow || "Materials for homes and projects"}
              </p>
              <h1 className="public-editorial-title mt-5 text-5xl leading-[.98] tracking-[-.045em] sm:text-6xl lg:text-8xl">
                {config.hero_title || "Build a space that feels like yours."}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
                {config.hero_description ||
                  "Browse doors, tiles, sanitary ware and finishing materials with SAT-J Ent."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#aa4924] px-6 text-sm font-semibold text-white transition hover:bg-[#8f3c1f]"
                  href="/products"
                >
                  Shop the catalogue <ArrowRight aria-hidden="true" size={17} />
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center rounded-full border border-white/55 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
                  href="/branches"
                >
                  Find a branch
                </Link>
              </div>
              <div className="mt-9 flex items-center gap-2 text-sm text-white/75">
                <MapPin aria-hidden="true" size={16} /> Serving customers across
                three SAT-J branches
              </div>
            </div>
            <div className="absolute bottom-6 right-7 hidden max-w-56 border-l border-white/45 pl-4 text-xs leading-5 text-white/75 xl:block">
              A better way to explore materials for the spaces you are building.
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-10 lg:pb-24">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#aa4924]">
                Shop by category
              </p>
              <h2 className="public-editorial-title mt-3 text-4xl tracking-[-.04em] sm:text-5xl">
                Start with what you need.
              </h2>
            </div>
            <Link
              className="hidden items-center gap-2 pb-1 text-sm font-semibold text-[#343831] hover:text-[#aa4924] sm:inline-flex"
              href="/products"
            >
              All products <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </div>
          {visibleCategories.length ? (
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {visibleCategories.map((category, index) => (
                <Link
                  className="group relative isolate flex min-h-[260px] items-end overflow-hidden rounded-2xl bg-[#20221f] p-5 text-white sm:min-h-[320px]"
                  href={`/categories/${category.slug}`}
                  key={category.id}
                >
                  {category.image_url ? (
                    <Image
                      alt=""
                      className="-z-20 object-cover transition duration-500 group-hover:scale-[1.04]"
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      src={category.image_url}
                    />
                  ) : (
                    <Image
                      alt=""
                      className="-z-20 object-cover"
                      fill
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      src={
                        index % 2
                          ? "/images/satj-gallery-bathroom.png"
                          : "/images/satj-hero-materials.png"
                      }
                    />
                  )}
                  <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <div className="flex w-full items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-white/75">
                        Explore collection
                      </p>
                      <h3 className="mt-2 text-xl font-semibold tracking-[-.025em]">
                        {category.name}
                      </h3>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/60 transition group-hover:bg-white group-hover:text-[#20221f]">
                      <ArrowUpRight aria-hidden="true" size={18} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-9 rounded-2xl bg-[#f0eee8] p-8 text-sm text-[#696b64]">
              Our product collections are being prepared. Browse the full
              catalogue for current listings.
            </div>
          )}
          <Link
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#343831] sm:hidden"
            href="/products"
          >
            See all products <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>

        <section className="border-y border-[#e7e5df] bg-white px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#aa4924]">
                  A few customer favourites
                </p>
                <h2 className="public-editorial-title mt-3 text-4xl tracking-[-.04em] sm:text-5xl">
                  Good places to begin.
                </h2>
              </div>
              <Link
                className="hidden items-center gap-2 pb-1 text-sm font-semibold text-[#343831] hover:text-[#aa4924] sm:inline-flex"
                href="/products"
              >
                Explore products <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
            {products.length ? (
              <div className="mt-9 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product.slug} product={product} compact />
                ))}
              </div>
            ) : (
              <div className="mt-9 rounded-2xl bg-[#f7f6f2] p-8 text-sm text-[#696b64]">
                Products will appear here as the SAT-J catalogue is prepared for
                online browsing.
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto grid max-w-[1440px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-10 lg:py-24">
          <div className="relative min-h-[340px] overflow-hidden rounded-2xl bg-[#e9e5dc] sm:min-h-[480px]">
            <Image
              alt="Finishing details for a thoughtfully planned home project"
              className="object-cover"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              src="/images/satj-project-cta.png"
            />
          </div>
          <div className="lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#aa4924]">
              From browsing to building
            </p>
            <h2 className="public-editorial-title mt-4 text-4xl leading-[1.04] tracking-[-.04em] sm:text-6xl">
              The right materials make the whole project feel closer.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#696b64]">
              Compare what is available online, then speak with our team for
              help choosing products and checking the details for your project.
            </p>
            <Link
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#20221f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3a3d37]"
              href="/about"
            >
              Get to know SAT-J <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </section>

        <section className="bg-[#efeee8] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
          <div className="mx-auto grid max-w-[1440px] gap-8 md:grid-cols-[1.1fr_.9fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#aa4924]">
                Close to your project
              </p>
              <h2 className="public-editorial-title mt-3 text-4xl tracking-[-.04em] sm:text-5xl">
                Three branches. One SAT-J team.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[#696b64]">
                Choose the SAT-J location that works best for you and get in
                touch before you visit.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-[#42453f]">
                <PackageCheck
                  aria-hidden="true"
                  size={17}
                  className="text-[#aa4924]"
                />{" "}
                Local product support
              </span>
              <span className="rounded-full bg-white px-4 py-3 text-sm font-medium text-[#42453f]">
                {branches.length === 3
                  ? "Three locations"
                  : "Branch details online"}
              </span>
              <Link
                className="inline-flex items-center gap-2 rounded-full bg-[#20221f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3a3d37]"
                href="/branches"
              >
                Visit our branches <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
