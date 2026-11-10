import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { BasketPageContent } from "@/components/public/basket-controls";
import { siteConfig } from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export const metadata: Metadata = {
  title: "Your basket",
  robots: { index: false },
};

export default async function BasketPage() {
  if (!isPublicWebsiteEnabled()) redirect("/login");
  const config = await siteConfig();
  return (
    <>
      <PublicHeader />
      <main className="min-h-[70vh] bg-[#fbfaf7] px-4 py-12 text-[#20221f] sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#aa4924]">
            Your selection
          </p>
          <h1 className="public-editorial-title mt-3 text-5xl tracking-[-.04em] sm:text-6xl">
            Your basket.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#696b64]">
            Check your items before sending a request to your chosen SAT-J
            branch.
          </p>
          <div className="mt-8">
            <BasketPageContent />
          </div>
          <Link
            className="mt-7 inline-flex text-sm font-semibold text-[#454840] hover:text-[#aa4924]"
            href="/products"
          >
            ← Back to products
          </Link>
        </div>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
