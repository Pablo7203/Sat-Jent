import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { siteConfig } from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";
export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How SAT-J Ent uses information submitted through order requests and enquiries.",
  alternates: { canonical: "/privacy" },
};
export default async function PrivacyPage() {
  if (!isPublicWebsiteEnabled()) redirect("/login");
  const c = await siteConfig();
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-4xl font-black">Privacy</h1>
        <div className="mt-8 space-y-6 leading-8 text-muted-foreground">
          <p>
            When you send an order request or contact SAT-J Ent, the business
            records the contact and project information you provide so its team
            can review the request and respond.
          </p>
          <p>
            The public website does not provide public access to submitted order
            request records. An online request does not take payment or reserve
            stock. Do not include payment-card details, passwords, or other
            unnecessary sensitive information in a message.
          </p>
          <p>
            Contact SAT-J Ent through the configured contact details if you need
            to correct information supplied in an enquiry.
          </p>
        </div>
      </main>
      <PublicFooter phone={c.phone} email={c.email} />
    </>
  );
}
