import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/public/public-shell";
import { publicBranches, siteConfig } from "@/lib/public-data";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

export const metadata: Metadata = {
  title: "Branches",
  description: "Find approved SAT-J Ent branch contact information.",
  alternates: { canonical: "/branches" },
};

export default async function BranchesPage() {
  if (!isPublicWebsiteEnabled()) redirect("/login");
  const [branches, config] = await Promise.all([
    publicBranches(),
    siteConfig(),
  ]);
  return (
    <>
      <PublicHeader />
      <main className="min-h-[70vh] bg-[#f5f1e8] px-4 py-14 text-[#1d1e19] sm:px-6 lg:px-10 lg:py-[72px]">
        <div className="mx-auto max-w-[1440px]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6d695f]">
            Visit SAT-J Ent
          </p>
          <h1 className="public-editorial-title mt-4 text-5xl leading-[1.02] tracking-[-0.05em] sm:text-6xl">
            Our branch network.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#6d695f] sm:text-lg">
            Visit an approved SAT-J Ent location for materials, product guidance
            and help with your project.
          </p>
          <section className="mt-14 grid gap-x-10 gap-y-12 lg:grid-cols-2 lg:gap-y-16">
            {branches.map((branch) => (
              <article
                className="border-t border-[#d8d0c4] pt-6"
                key={branch.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                    {branch.name}
                  </h2>
                  <a
                    aria-label={`Get directions to ${branch.name}`}
                    className="flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[#d8d0c4] text-[#28372c] hover:border-[#28372c]"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ArrowUpRight
                      aria-hidden="true"
                      size={17}
                      strokeWidth={1.7}
                    />
                  </a>
                </div>
                <dl className="mt-7 grid gap-5 text-sm leading-6 text-[#5e5a52]">
                  <div className="grid grid-cols-[20px_1fr] gap-3">
                    <MapPin
                      aria-hidden="true"
                      className="mt-0.5 text-[#28372c]"
                      size={18}
                      strokeWidth={1.7}
                    />
                    <dd>{branch.address}</dd>
                  </div>
                  <div className="grid grid-cols-[20px_1fr] gap-3">
                    <Phone
                      aria-hidden="true"
                      className="mt-0.5 text-[#28372c]"
                      size={18}
                      strokeWidth={1.7}
                    />
                    <dd>
                      <a
                        className="font-semibold text-[#28372c] hover:underline"
                        href={`tel:${branch.phone}`}
                      >
                        {branch.phone}
                      </a>
                    </dd>
                  </div>
                  {branch.email ? (
                    <div className="grid grid-cols-[20px_1fr] gap-3">
                      <Mail
                        aria-hidden="true"
                        className="mt-0.5 text-[#28372c]"
                        size={18}
                        strokeWidth={1.7}
                      />
                      <dd>
                        <a
                          className="font-semibold text-[#28372c] hover:underline"
                          href={`mailto:${branch.email}`}
                        >
                          {branch.email}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {branch.opening_hours ? (
                    <div className="grid grid-cols-[20px_1fr] gap-3">
                      <Clock
                        aria-hidden="true"
                        className="mt-0.5 text-[#28372c]"
                        size={18}
                        strokeWidth={1.7}
                      />
                      <dd>{branch.opening_hours}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
            {!branches.length ? (
              <section className="border-t border-[#d8d0c4] py-10">
                <h2 className="public-editorial-title text-3xl tracking-[-0.035em]">
                  Branch details are being prepared.
                </h2>
                <p className="mt-3 max-w-lg leading-7 text-[#6d695f]">
                  Please use the contact page and the SAT-J team will guide you.
                </p>
              </section>
            ) : null}
          </section>
        </div>
      </main>
      <PublicFooter email={config.email} phone={config.phone} />
    </>
  );
}
