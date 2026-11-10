import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Mail, MessageCircle, Phone } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { siteConfig, whatsappHref } from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact SAT-J Ent about products and building-material quotations.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  if (!isPublicWebsiteEnabled()) redirect("/login");
  const config = await siteConfig();
  const whatsapp = whatsappHref(
    config.whatsapp_number,
    "Hello SAT-J Ent, I would like to make an enquiry.",
  );
  const contacts = [
    config.phone
      ? {
          href: `tel:${config.phone}`,
          icon: Phone,
          title: "Call SAT-J Ent",
          detail: config.phone,
        }
      : null,
    config.email
      ? {
          href: `mailto:${config.email}`,
          icon: Mail,
          title: "Email the team",
          detail: config.email,
        }
      : null,
    whatsapp
      ? {
          href: whatsapp,
          icon: MessageCircle,
          title: "Chat on WhatsApp",
          detail: "Start a product conversation",
          external: true,
        }
      : null,
  ].filter(Boolean) as {
    href: string;
    icon: typeof Phone;
    title: string;
    detail: string;
    external?: boolean;
  }[];
  return (
    <>
      <PublicHeader />
      <main className="min-h-[70vh] bg-[#f5f1e8] px-4 py-14 text-[#1d1e19] sm:px-6 lg:px-10 lg:py-[72px]">
        <div className="mx-auto max-w-[1120px]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6d695f]">
            Contact SAT-J Ent
          </p>
          <h1 className="public-editorial-title mt-4 max-w-3xl text-5xl leading-[1.02] tracking-[-0.05em] sm:text-6xl">
            Let&apos;s talk about your project.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#6d695f] sm:text-lg">
            Browse products first, then use an available contact channel to
            speak with the SAT-J team about your project.
          </p>
          <section className="mt-14 grid gap-5 sm:grid-cols-2">
            {contacts.map((contact) => {
              const Icon = contact.icon;
              return (
                <a
                  className="group border-t border-[#d8d0c4] py-6"
                  href={contact.href}
                  key={contact.title}
                  rel={contact.external ? "noreferrer" : undefined}
                  target={contact.external ? "_blank" : undefined}
                >
                  <Icon
                    aria-hidden="true"
                    className="text-[#28372c]"
                    size={22}
                    strokeWidth={1.6}
                  />
                  <h2 className="mt-8 flex items-center gap-2 text-xl font-semibold tracking-[-0.025em]">
                    {contact.title}
                    <ArrowRight
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-1"
                      size={16}
                    />
                  </h2>
                  <p className="mt-2 text-sm text-[#6d695f]">
                    {contact.detail}
                  </p>
                </a>
              );
            })}
            <Link
              className="group border-t border-[#d8d0c4] py-6"
              href="/products"
            >
              <span className="inline-flex rounded-full bg-[#28372c] p-2.5 text-[#f8f5ef]">
                <ArrowRight aria-hidden="true" size={18} strokeWidth={1.7} />
              </span>
              <h2 className="mt-8 flex items-center gap-2 text-xl font-semibold tracking-[-0.025em]">
                Browse the catalogue
                <ArrowRight
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-1"
                  size={16}
                />
              </h2>
              <p className="mt-2 text-sm text-[#6d695f]">
                Find products for your project and get in touch with the team.
              </p>
            </Link>
          </section>
          {!contacts.length ? (
            <section className="mt-12 border-t border-[#d8d0c4] py-8">
              <p className="max-w-xl leading-7 text-[#6d695f]">
                Public contact details are being configured. Please check back
                soon for the latest SAT-J contact information.
              </p>
            </section>
          ) : null}
          <section className="mt-16 border-t border-[#d8d0c4] pt-10">
            <Link
              className="inline-flex rounded-full bg-[#20221f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#aa4924]"
              href="/products"
            >
              Browse products
            </Link>
          </section>
        </div>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
