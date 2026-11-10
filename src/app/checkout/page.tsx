import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { CheckoutForm } from "@/components/public/checkout-form";
import { publicBranches, siteConfig } from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export const metadata: Metadata = {
  title: "Send your order request",
  robots: { index: false },
};

export default async function CheckoutPage() {
  if (!isPublicWebsiteEnabled()) redirect("/login");
  const [branches, config] = await Promise.all([
    publicBranches(),
    siteConfig(),
  ]);
  return (
    <>
      <PublicHeader />
      <main className="min-h-[70vh] bg-[#fbfaf7] px-4 py-12 text-[#20221f] sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#aa4924]">
            Order request
          </p>
          <h1 className="public-editorial-title mt-3 text-5xl tracking-[-.04em] sm:text-6xl">
            Almost ready.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#696b64]">
            Share the best way to reach you, and choose which of our three
            branches should review your request.
          </p>
          <div className="mt-8">
            <CheckoutForm
              branches={branches.map(({ id, name, address }) => ({
                id,
                name,
                address,
              }))}
            />
          </div>
        </div>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
