import type { Metadata } from "next";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { CheckoutComplete } from "@/components/public/checkout-complete";
import { siteConfig } from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Order payment",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  if (!isPublicWebsiteEnabled()) {
    return null;
  }

  const [{ reference = "" }, config] = await Promise.all([
    searchParams,
    siteConfig(),
  ]);

  return (
    <>
      <PublicHeader />
      <main className="min-h-[70vh] bg-[#fbfaf7] px-4 py-12 text-[#20221f] sm:px-6 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-3xl">
          <CheckoutComplete reference={reference} />
        </div>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
