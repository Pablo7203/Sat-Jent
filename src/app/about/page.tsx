import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { siteConfig } from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about SAT-J Ent and its building-material product range.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  if (!isPublicWebsiteEnabled()) redirect("/login");
  const config = await siteConfig();
  return (
    <>
      <PublicHeader />
      <main className="bg-[#f5f1e8] px-4 pb-4 pt-4 text-[#1d1e19] sm:px-6 lg:px-10 lg:pb-10 lg:pt-6">
        <section className="relative isolate mx-auto flex min-h-[520px] max-w-[1440px] items-end overflow-hidden rounded-xl bg-[#28372c] px-6 py-10 text-[#f8f5ef] sm:px-10 sm:py-14 lg:min-h-[600px] lg:px-14 lg:py-16">
          <Image
            alt="A considered, finished interior built with lasting materials"
            className="-z-20 object-cover"
            fill
            preload
            sizes="(max-width: 1440px) 100vw, 1440px"
            src="/images/satj-project-cta.png"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#1d1e19]/88 via-[#1d1e19]/60 to-[#1d1e19]/10" />
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e7ded0]">
              About SAT-J Ent
            </p>
            <h1 className="public-editorial-title mt-5 text-5xl leading-[1.01] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Materials for the spaces people build and live in.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#f8f5ef]/82 sm:text-lg">
              We help customers find doors, tiles, sanitary ware and finishing
              materials that suit their project, their space and their budget.
            </p>
          </div>
        </section>
        <section className="mx-auto grid max-w-[1120px] gap-14 px-1 py-20 lg:grid-cols-[.9fr_1.1fr] lg:py-28">
          <div>
            <h2 className="public-editorial-title text-4xl leading-[1.04] tracking-[-0.045em] sm:text-5xl">
              Practical choices, made easier.
            </h2>
          </div>
          <div className="grid gap-10 text-base leading-8 text-[#6d695f]">
            <p>
              SAT-J Ent supplies doors, tiles, tiling materials, sanitary ware,
              bathroom accessories and other building materials for homes,
              renovations and commercial projects.
            </p>
            <p>
              Our public catalogue gives customers a clearer way to compare
              approved products before they make an enquiry. For final guidance,
              pricing and availability, the SAT-J team is ready to help.
            </p>
            <Link
              className="inline-flex items-center gap-2 self-start text-sm font-semibold text-[#28372c] hover:text-[#1d1e19]"
              href="/products"
            >
              Explore products <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </section>
        <section className="border-y border-[#d8d0c4] bg-[#fcfaf6] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
          <div className="mx-auto grid max-w-[1440px] gap-8 md:grid-cols-3 md:gap-10">
            <article>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                Browse the catalogue
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#6d695f]">
                Start with products and categories that fit the room or project
                you have in mind.
              </p>
            </article>
            <article>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                Compare options
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#6d695f]">
                Review publicly available product information before you
                shortlist an option.
              </p>
            </article>
            <article>
              <h2 className="text-xl font-semibold tracking-[-0.025em]">
                Get project support
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#6d695f]">
                Send an order request or speak with a SAT-J branch about your
                requirements.
              </p>
            </article>
          </div>
        </section>
        <section className="mx-auto flex max-w-[1120px] flex-col justify-between gap-7 px-1 py-20 sm:flex-row sm:items-end lg:py-28">
          <div>
            <h2 className="public-editorial-title text-4xl tracking-[-0.045em] sm:text-5xl">
              Ready to start your project?
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-[#6d695f]">
              Browse the catalogue first or tell us what you need and we will
              point you in the right direction.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              className="rounded-full bg-[#28372c] px-5 py-3 text-sm font-semibold text-[#f8f5ef] hover:bg-[#1d1e19]"
              href="/products"
            >
              Browse products
            </Link>
            <Link
              className="rounded-full border border-[#28372c] px-5 py-3 text-sm font-semibold text-[#28372c] hover:bg-[#e7ded0]"
              href="/contact"
            >
              Contact SAT-J
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
